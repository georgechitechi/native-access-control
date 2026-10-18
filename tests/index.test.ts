import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAccessEngine,
  createAccessControl,
  scopeRecords,
  buildScopeFilter,
  filterRecord,
  assertCan,
  assertHasRole,
  AccessDeniedError,
  checkRouteAccess,
} from '../dist/index.js';

test('RBAC: basic direct permissions and wildcards', () => {
  const engine = createAccessEngine({
    policies: {
      admin: ['*'],
      editor: ['posts:write', 'posts:read', 'comments:*'],
      viewer: ['posts:read'],
    },
  });

  const viewer = engine.buildEvaluator(['viewer']);
  assert.equal(viewer.can('read', 'posts'), true);
  assert.equal(viewer.can('write', 'posts'), false);
  assert.equal(viewer.cannot('write', 'posts'), true);

  const editor = engine.buildEvaluator(['editor']);
  assert.equal(editor.can('write', 'posts'), true);
  assert.equal(editor.can('delete', 'comments'), true);
  assert.equal(editor.can('delete', 'posts'), false);

  const admin = engine.buildEvaluator(['admin']);
  assert.equal(admin.can('delete', 'posts'), true);
  assert.equal(admin.can('purge', 'database'), true);
});

test('Role Hierarchy & Inheritance', () => {
  const engine = createAccessEngine({
    policies: {
      guest: ['docs:read'],
      member: ['comments:create'],
      admin: ['docs:delete'],
    },
    roleHierarchy: {
      admin: ['member'],
      member: ['guest'],
    },
  });

  const admin = engine.buildEvaluator(['admin']);
  assert.equal(admin.can('delete', 'docs'), true);
  assert.equal(admin.can('create', 'comments'), true);
  assert.equal(admin.can('read', 'docs'), true);
  assert.equal(admin.hasRole('member'), true);
});

test('ABAC: Dynamic conditions and explicit deny overrides', () => {
  interface Context {
    userId: string;
    ownerId: string;
    isSuspended?: boolean;
  }

  const engine = createAccessEngine<string, string, string, Context>({
    policies: {
      user: [
        {
          action: 'edit',
          resource: 'doc',
          condition: (ctx) => ctx.userId === ctx.ownerId,
        },
        {
          action: '*',
          resource: '*',
          effect: 'deny',
          condition: (ctx) => Boolean(ctx.isSuspended),
        },
      ],
    },
  });

  const evaluator = engine.buildEvaluator(['user']);
  // Owner can edit
  assert.equal(evaluator.can('edit', 'doc', { userId: 'u1', ownerId: 'u1' }), true);
  // Non-owner cannot
  assert.equal(evaluator.can('edit', 'doc', { userId: 'u1', ownerId: 'u2' }), false);
  // Suspended user is denied even if owner
  assert.equal(
    evaluator.can('edit', 'doc', { userId: 'u1', ownerId: 'u1', isSuspended: true }),
    false
  );
});

test('SuperRoles bypass', () => {
  const engine = createAccessEngine({
    policies: {
      guest: ['read:home'],
    },
    superRoles: ['owner'],
  });

  const owner = engine.buildEvaluator(['owner']);
  assert.equal(owner.can('destroy', 'anything'), true);
  assert.equal(owner.hasRole('admin'), true);
});

test('scopeRecords: Partition scope and ownership filtering', () => {
  const records = [
    { id: 1, orgId: 'org_A', authorId: 'u1', title: 'Doc 1' },
    { id: 2, orgId: 'org_A', authorId: 'u2', title: 'Doc 2' },
    { id: 3, orgId: 'org_B', authorId: 'u1', title: 'Doc 3' },
  ];

  // Scoped to partition / organization
  const orgDocs = scopeRecords(records, { scopeId: 'org_A', scopeKey: 'orgId' });
  assert.equal(orgDocs.length, 2);

  // Scoped to restricted user in partition
  const userDocs = scopeRecords(records, {
    scopeId: 'org_A',
    scopeKey: 'orgId',
    userId: 'u1',
    userKey: 'authorId',
    isRestrictedRole: true,
  });
  assert.equal(userDocs.length, 1);
  assert.equal(userDocs[0].id, 1);
});

test('buildScopeFilter generates correct database where objects', () => {
  const filter = buildScopeFilter({
    scopeId: 'biz_123',
    scopeKey: 'business_id',
    userId: 'user_456',
    userKey: 'user_id',
    isRestrictedRole: true,
  });

  assert.deepEqual(filter, {
    business_id: 'biz_123',
    user_id: 'user_456',
  });

  const adminFilter = buildScopeFilter({
    scopeId: 'biz_123',
    scopeKey: 'business_id',
    userId: 'user_456',
    userKey: 'user_id',
    isRestrictedRole: false,
  });

  assert.deepEqual(adminFilter, {
    business_id: 'biz_123',
  });
});

test('filterRecord masks and projects allowed fields', () => {
  const rawRecord = {
    id: 'rec_1',
    name: 'Office 101',
    rent: 500,
    ownerBankDetails: 'SECRET_IBAN',
  };

  const masked = filterRecord(rawRecord, {
    allowedFields: ['id', 'name', 'rent'],
  });
  assert.deepEqual(masked, { id: 'rec_1', name: 'Office 101', rent: 500 });

  const omitted = filterRecord(rawRecord, {
    omitFields: ['ownerBankDetails'],
  });
  assert.deepEqual(omitted, { id: 'rec_1', name: 'Office 101', rent: 500 });
});

test('assertCan and assertHasRole throw AccessDeniedError on failure', () => {
  const engine = createAccessEngine({
    policies: {
      editor: ['post:edit'],
    },
  });

  const evaluator = engine.buildEvaluator(['editor']);

  // Success should not throw
  assert.doesNotThrow(() => {
    assertCan(evaluator, 'edit', 'post');
    assertHasRole(evaluator, 'editor');
  });

  // Forbidden capability should throw AccessDeniedError
  assert.throws(
    () => {
      assertCan(evaluator, 'delete', 'post');
    },
    (err: any) => err instanceof AccessDeniedError && err.action === 'delete'
  );

  // Missing role should throw AccessDeniedError
  assert.throws(
    () => {
      assertHasRole(evaluator, 'admin');
    },
    (err: any) => err instanceof AccessDeniedError
  );
});

test('checkRouteAccess validates navigation paths and wildcards', () => {
  const routes = {
    '/admin/*': ['admin'],
    '/dashboard': '*',
    '/reports': ['admin', 'staff'],
  };

  // Staff user
  const staffRoles = ['staff'];

  const r1 = checkRouteAccess('/dashboard', staffRoles, routes);
  assert.equal(r1.allowed, true);

  const r2 = checkRouteAccess('/reports', staffRoles, routes);
  assert.equal(r2.allowed, true);

  const r3 = checkRouteAccess('/admin/settings', staffRoles, routes, {
    fallbackRoute: '/dashboard',
  });
  assert.equal(r3.allowed, false);
  assert.equal(r3.redirectTo, '/dashboard');
});

test('getPolicies and setPolicies', () => {
  const engine = createAccessEngine({
    policies: {
      user: ['doc:read'],
    },
  });

  const snapshot = engine.getPolicies();
  assert.deepEqual(snapshot, { user: ['doc:read'] });

  engine.setPolicies({
    user: ['doc:read', 'doc:edit'],
  });

  const evaluator = engine.buildEvaluator(['user']);
  assert.equal(evaluator.can('edit', 'doc'), true);
});

test('createAccessControl suite setup', () => {
  const suite = createAccessControl({
    policies: {
      admin: ['*'],
      editor: ['article:read', 'article:write'],
    },
  });

  assert.ok(suite.engine);
  assert.ok(suite.AccessProvider);
  assert.ok(suite.useAccess);
  assert.ok(suite.Can);
  assert.ok(suite.Cannot);
  assert.ok(suite.Protect);
  assert.ok(suite.createRoleGuard);
  assert.ok(suite.scopeRecords);
});
