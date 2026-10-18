import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAccessEngine,
  createAccessControl,
  scopeRecords,
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

test('scopeRecords: Multi-tenant and ownership filtering', () => {
  const records = [
    { id: 1, orgId: 'org_A', authorId: 'u1', title: 'Doc 1' },
    { id: 2, orgId: 'org_A', authorId: 'u2', title: 'Doc 2' },
    { id: 3, orgId: 'org_B', authorId: 'u1', title: 'Doc 3' },
  ];

  // Scoped to tenant
  const orgDocs = scopeRecords(records, { tenantId: 'org_A' });
  assert.equal(orgDocs.length, 2);

  // Scoped to restricted user in tenant
  const userDocs = scopeRecords(records, {
    tenantId: 'org_A',
    userId: 'u1',
    userKey: 'authorId',
    isRestrictedRole: true,
  });
  assert.equal(userDocs.length, 1);
  assert.equal(userDocs[0].id, 1);
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
