# Database & ORM Adapters

`native-access-control/adapters` provides zero-overhead helpers for database query scoping, ORM integration, and Row-Level Security (RLS) generation with **zero external dependencies**.

---

## 1. Drizzle ORM

Integrate partition and ownership scoping directly into your Drizzle `select()`, `update()`, and `delete()` queries.

### `toDrizzleWhere()`

```typescript
import { toDrizzleWhere } from 'native-access-control/adapters';
import { eq, and } from 'drizzle-orm';
import { posts } from './schema';
import { db } from './db';

export async function getPosts(userContext: { orgId: string; userId: string; isAdmin: boolean }) {
  const where = toDrizzleWhere(
    posts,
    {
      scopeId: userContext.orgId,
      scopeKey: 'workspaceId',
      userId: userContext.userId,
      userKey: 'authorId',
      isRestrictedRole: !userContext.isAdmin,
    },
    { eq, and }
  );

  return db.select().from(posts).where(where);
}
```

---

## 2. Prisma Client

### A. Filter Object (`toPrismaWhere`)

Generates a typed `where` clause filter object:

```typescript
import { toPrismaWhere } from 'native-access-control/adapters';
import { prisma } from './prisma';

const where = toPrismaWhere({
  scopeId: activeOrgId,
  scopeKey: 'organizationId',
  userId: activeUserId,
  userKey: 'authorId',
  isRestrictedRole: !currentUser.isAdmin,
});

const documents = await prisma.document.findMany({ where });
```

### B. Prisma Client Extension (`createPrismaScopeExtension`)

Automatically inject partition scoping into every query across specified models:

```typescript
import { PrismaClient } from '@prisma/client';
import { createPrismaScopeExtension } from 'native-access-control/adapters';

export function getScopedPrisma(session: { orgId: string; userId: string }) {
  const basePrisma = new PrismaClient();

  return basePrisma.$extends(
    createPrismaScopeExtension({
      scopeId: session.orgId,
      scopeKey: 'orgId',
      userId: session.userId,
      userKey: 'authorId',
      models: ['Document', 'Invoice', 'Ticket'],
    })
  );
}

// In your application logic:
const prisma = getScopedPrisma(session);

// Automatically scoped with { orgId: session.orgId, authorId: session.userId }
const docs = await prisma.document.findMany();
```

---

## 3. MongoDB & Mongoose

### `toMongoFilter()`

Generates MongoDB query filter objects:

```typescript
import { toMongoFilter } from 'native-access-control/adapters';
import { NoteModel } from './models';

const filter = toMongoFilter({
  scopeId: workspaceId,
  scopeKey: 'teamId',
  userId: currentUserId,
  userKey: 'ownerId',
  isRestrictedRole: !isAdmin,
});

// Use directly in Mongoose or Mongo driver
const notes = await NoteModel.find(filter);
```

---

## 4. Supabase

The Supabase adapter attaches partition and ownership scoping filters directly to Supabase client queries.

### A. `applySupabaseScope()`

```typescript
import { applySupabaseScope } from 'native-access-control/adapters';
import { supabase } from './supabaseClient';

export async function fetchProjects(userContext: { orgId: string; userId?: string; isAdmin: boolean }) {
  let query = supabase.from('projects').select('*');

  query = applySupabaseScope(query, {
    scopeId: userContext.orgId,
    scopeKey: 'organization_id',
    userId: userContext.isAdmin ? undefined : userContext.userId,
    userKey: 'author_id',
    isRestrictedRole: !userContext.isAdmin,
  });

  const { data, error } = await query;
  return data;
}
```

### B. `toSupabaseMatch()`

```typescript
import { toSupabaseMatch } from 'native-access-control/adapters';

const matchCriteria = toSupabaseMatch({
  scopeId: 'org_123',
  scopeKey: 'team_id',
  userId: 'usr_abc',
  userKey: 'creator_id',
  isRestrictedRole: true,
});
// => { team_id: 'org_123', creator_id: 'usr_abc' }

const { data } = await supabase.from('tickets').select('*').match(matchCriteria);
```

---

## 5. PostgreSQL

Parameterized SQL fragments and Row-Level Security (RLS) policies.

### A. Parameterized WHERE Clauses: `toPostgresWhere()`

```typescript
import { toPostgresWhere } from 'native-access-control/adapters';

const { clause, params } = toPostgresWhere(
  {
    scopeId: 'org_99',
    scopeKey: 'organization_id',
    userId: 'usr_42',
    userKey: 'owner_id',
    isRestrictedRole: true,
  },
  1 // Start parameter index at $1
);
// => clause: 'WHERE organization_id = $1 AND owner_id = $2'
// => params: ['org_99', 'usr_42']

const result = await db.query(
  `SELECT * FROM documents ${clause}`,
  params
);
```

### B. Row-Level Security (RLS) Generator: `generateRlsPolicy()`

```typescript
import { generateRlsPolicy } from 'native-access-control/adapters';

const sql = generateRlsPolicy({
  table: 'invoices',
  scopeKey: 'organization_id',
  userKey: 'author_id',
  jwtClaim: 'app.current_org_id',
});
```
