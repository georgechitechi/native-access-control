# Database Adapters

`native-access-control/adapters` provides zero-overhead helpers for integrating access scoping with **Supabase** and **PostgreSQL**.

---

## Supabase Adapter

The Supabase adapter attaches partition and ownership scoping filters directly to Supabase client queries.

### 1. `applySupabaseScope()`

Chain scoping directly onto any `@supabase/supabase-js` query builder:

```typescript
import { applySupabaseScope } from 'native-access-control/adapters';
import { supabase } from './supabaseClient';

export async function fetchProjects(userContext: { orgId: string; userId?: string; isAdmin: boolean }) {
  let query = supabase.from('projects').select('*');

  // Automatically applies .eq('organization_id', orgId)
  // and optionally .eq('author_id', userId) if not admin
  query = applySupabaseScope(query, {
    scopeId: userContext.orgId,
    scopeKey: 'organization_id',
    userId: userContext.isAdmin ? undefined : userContext.userId,
    userKey: 'author_id',
  });

  const { data, error } = await query;
  return data;
}
```

### 2. `toSupabaseMatch()`

Generate a match object for `.match(obj)` queries:

```typescript
import { toSupabaseMatch } from 'native-access-control/adapters';

const matchCriteria = toSupabaseMatch({
  scopeId: 'org_123',
  scopeKey: 'team_id',
  userId: 'usr_abc',
  userKey: 'creator_id',
});
// => { team_id: 'org_123', creator_id: 'usr_abc' }

const { data } = await supabase.from('tickets').select('*').match(matchCriteria);
```

---

## PostgreSQL Adapter

The PostgreSQL adapter produces parameterized `WHERE` clauses and Row-Level Security (RLS) SQL policies.

### 1. Parameterized WHERE Clauses: `toPostgresWhere()`

Generate safe, parameterized SQL fragments for `pg`, `postgres.js`, `slonik`, or `node-postgres`:

```typescript
import { toPostgresWhere } from 'native-access-control/adapters';
import { sqlClient } from './db';

// Single partition filter
const singleFilter = toPostgresWhere({
  scopeId: 'org_99',
  scopeKey: 'organization_id',
});
// => { clause: 'WHERE "organization_id" = $1', values: ['org_99'] }

// Partition + User filter with custom param index
const complexFilter = toPostgresWhere(
  {
    scopeId: 'org_99',
    scopeKey: 'organization_id',
    userId: 'usr_42',
    userKey: 'owner_id',
  },
  1 // Start parameter index at $1
);
// => {
//   clause: 'WHERE "organization_id" = $1 AND "owner_id" = $2',
//   values: ['org_99', 'usr_42']
// }

// Execute with pg / node-postgres:
const result = await sqlClient.query(
  `SELECT * FROM documents ${complexFilter.clause}`,
  complexFilter.values
);
```

### 2. Row-Level Security (RLS) Generator: `generateRlsPolicy()`

Generate production-ready PostgreSQL Row-Level Security statements:

```typescript
import { generateRlsPolicy } from 'native-access-control/adapters';

// Generate RLS policy for organization isolation via JWT claims
const rlsSql = generateRlsPolicy({
  tableName: 'invoices',
  policyName: 'tenant_isolation_invoices',
  scopeColumn: 'organization_id',
  jwtClaim: 'app.current_org_id',
  command: 'SELECT', // or 'ALL', 'INSERT', 'UPDATE', 'DELETE'
});

console.log(rlsSql);
```

**Output SQL:**

```sql
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_invoices ON invoices
  FOR SELECT
  USING (organization_id = NULLIF(current_setting('app.current_org_id', true), ''));
```

### Generating RLS with User Ownership Check

```typescript
const ownershipRls = generateRlsPolicy({
  tableName: 'notes',
  policyName: 'user_notes_policy',
  scopeColumn: 'org_id',
  jwtClaim: 'app.current_org_id',
  userColumn: 'author_id',
  userJwtClaim: 'request.jwt.claim.sub',
  command: 'ALL',
});
```

**Output SQL:**

```sql
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_notes_policy ON notes
  FOR ALL
  USING (
    org_id = NULLIF(current_setting('app.current_org_id', true), '')
    AND author_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')
  );
```
