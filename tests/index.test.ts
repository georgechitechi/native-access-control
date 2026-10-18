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
  toSupabaseMatch,
  applySupabaseScope,
  toPostgresWhere,
  generateRlsPolicy,
  toDrizzleWhere,
  toPrismaWhere,
  createPrismaScopeExtension,
  protectAction,
  protectRouteHandler,
  expressGuard,
  honoGuard,
  createTrpcGuard,
  toMongoFilter,
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

test('Supabase adapter: toSupabaseMatch and applySupabaseScope', () => {
  const match = toSupabaseMatch({
    scopeId: 'biz_abc',
    scopeKey: 'business_id',
    userId: 'usr_xyz',
    userKey: 'author_id',
    isRestrictedRole: true,
  });

  assert.deepEqual(match, {
    business_id: 'biz_abc',
    author_id: 'usr_xyz',
  });

  // Mock Supabase QueryBuilder
  const appliedFilters: Record<string, any> = {};
  const mockQuery = {
    eq(col: string, val: any) {
      appliedFilters[col] = val;
      return this;
    },
  };

  applySupabaseScope(mockQuery, {
    scopeId: 'biz_abc',
    scopeKey: 'business_id',
    userId: 'usr_xyz',
    userKey: 'author_id',
    isRestrictedRole: true,
  });

  assert.deepEqual(appliedFilters, {
    business_id: 'biz_abc',
    author_id: 'usr_xyz',
  });
});

test('PostgreSQL adapter: toPostgresWhere and generateRlsPolicy', () => {
  const { where, clause, params, nextIndex } = toPostgresWhere({
    scopeId: 'org_1',
    scopeKey: 'org_id',
    userId: 'u_1',
    userKey: 'user_id',
    isRestrictedRole: true,
    startIndex: 1,
  });

  assert.equal(where, 'org_id = $1 AND user_id = $2');
  assert.equal(clause, 'WHERE org_id = $1 AND user_id = $2');
  assert.deepEqual(params, ['org_1', 'u_1']);
  assert.equal(nextIndex, 3);

  // Unrestricted check (only scope)
  const unrestricted = toPostgresWhere({
    scopeId: 'org_1',
    scopeKey: 'org_id',
    userId: 'u_1',
    isRestrictedRole: false,
  });

  assert.equal(unrestricted.clause, 'WHERE org_id = $1');
  assert.deepEqual(unrestricted.params, ['org_1']);

  // RLS SQL generation
  const rls = generateRlsPolicy({
    table: 'documents',
    scopeKey: 'workspace_id',
    userKey: 'creator_id',
  });

  assert.match(rls, /ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;/);
  assert.match(rls, /workspace_id::text/);
  assert.match(rls, /creator_id = auth\.uid\(\)/);
});

test('Drizzle adapter: toDrizzleWhere', () => {
  const table = {
    workspaceId: 'col_workspace_id',
    creatorId: 'col_creator_id',
  };

  const operators = {
    eq: (col: any, val: any) => ({ op: 'eq', col, val }),
    and: (...conds: any[]) => ({ op: 'and', conds }),
  };

  // Both scope and user
  const res1 = toDrizzleWhere(
    table,
    {
      scopeId: 'ws_1',
      scopeKey: 'workspaceId',
      userId: 'usr_1',
      userKey: 'creatorId',
      isRestrictedRole: true,
    },
    operators
  );

  assert.deepEqual(res1, {
    op: 'and',
    conds: [
      { op: 'eq', col: 'col_workspace_id', val: 'ws_1' },
      { op: 'eq', col: 'col_creator_id', val: 'usr_1' },
    ],
  });

  // Unrestricted: only scopeId
  const res2 = toDrizzleWhere(
    table,
    {
      scopeId: 'ws_1',
      scopeKey: 'workspaceId',
      userId: 'usr_1',
      userKey: 'creatorId',
      isRestrictedRole: false,
    },
    operators
  );

  assert.deepEqual(res2, { op: 'eq', col: 'col_workspace_id', val: 'ws_1' });
});

test('Prisma adapter: toPrismaWhere and createPrismaScopeExtension', async () => {
  const where = toPrismaWhere({
    scopeId: 'org_1',
    scopeKey: 'orgId',
    userId: 'u_1',
    userKey: 'userId',
    isRestrictedRole: true,
  });

  assert.deepEqual(where, { orgId: 'org_1', userId: 'u_1' });

  // Test extension query interception
  const ext = createPrismaScopeExtension({
    scopeId: 'org_100',
    models: ['Document'],
  });

  let interceptedArgs: any = null;
  const mockQuery = async (args: any) => {
    interceptedArgs = args;
    return [{ id: 1 }];
  };

  await ext.query.$allModels.$allOperations({
    model: 'Document',
    operation: 'findMany',
    args: { where: { status: 'published' } },
    query: mockQuery,
  });

  assert.deepEqual(interceptedArgs, {
    where: {
      status: 'published',
      scopeId: 'org_100',
    },
  });
});

test('MongoDB adapter: toMongoFilter', () => {
  const filter = toMongoFilter({
    scopeId: 'tenant_1',
    scopeKey: 'tenantId',
    userId: 'user_1',
    userKey: 'authorId',
    isRestrictedRole: true,
  });

  assert.deepEqual(filter, { tenantId: 'tenant_1', authorId: 'user_1' });
});

test('Next.js adapter: protectAction and protectRouteHandler', async () => {
  const engine = createAccessEngine({
    policies: {
      admin: ['*'],
      viewer: ['posts:read'],
    },
  });

  const viewerEvaluator = engine.buildEvaluator(['viewer']);

  // protectAction
  const safeAction = protectAction(
    viewerEvaluator,
    'posts:read',
    async (id: string) => `post_${id}`
  );

  const result = await safeAction('123');
  assert.equal(result, 'post_123');

  const unsafeAction = protectAction(
    viewerEvaluator,
    'posts:delete',
    async (id: string) => `deleted_${id}`
  );

  await assert.rejects(
    async () => unsafeAction('123'),
    (err: any) => err instanceof AccessDeniedError && err.action === 'delete'
  );

  // protectRouteHandler
  const handler = protectRouteHandler(
    () => viewerEvaluator,
    'posts:read',
    async () => ({ status: 200 })
  );

  const res = await handler({} as any);
  assert.deepEqual(res, { status: 200 });
});

test('Express adapter: expressGuard', () => {
  const engine = createAccessEngine({
    policies: { admin: ['*'], member: ['docs:read'] },
  });

  const memberEval = engine.buildEvaluator(['member']);

  let nextCalled = false;
  const req = {};
  const res: any = {
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.body = body;
      return this;
    },
  };

  // Allowed
  const guardPass = expressGuard(memberEval, 'docs:read');
  guardPass(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);

  // Denied
  let nextErr: any = null;
  const guardFail = expressGuard(memberEval, 'docs:delete');
  guardFail(req, res, (err) => {
    nextErr = err;
  });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.error, 'Forbidden');
});

test('Hono adapter: honoGuard', async () => {
  const engine = createAccessEngine({
    policies: { admin: ['*'] },
  });
  const guestEval = engine.buildEvaluator(['guest']);

  let nextCalled = false;
  const mockC: any = {
    json(body: any, status: number) {
      return { body, status };
    },
  };

  const guard = honoGuard(guestEval, 'admin:access');
  const response = await guard(mockC, async () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(response.status, 403);
});

test('tRPC adapter: createTrpcGuard', async () => {
  const engine = createAccessEngine({
    policies: { user: ['profile:view'] },
  });

  const evalUser = engine.buildEvaluator(['user']);

  const guard = createTrpcGuard(evalUser, 'profile:view');

  let nextCalled = false;
  await guard({
    ctx: {},
    next: async () => {
      nextCalled = true;
      return 'ok';
    },
  });

  assert.equal(nextCalled, true);

  const guardDeny = createTrpcGuard(evalUser, 'profile:delete');
  await assert.rejects(
    async () =>
      guardDeny({
        ctx: {},
        next: async () => 'ok',
      }),
    (err: any) => err instanceof AccessDeniedError
  );
});

