# Data Scoping & Filtering

Beyond verifying *actions*, modern applications must restrict *which data records* a user can access or modify based on **partition (tenant/workspace/organization)** and **ownership (author/creator)**.

`native-access-control` provides zero-overhead scoping utilities that work identically on server and client.

---

## Universal Scoping Concepts

1. **`scopeId`**: The partition identifier (e.g. `organizationId`, `workspaceId`, `teamId`).
2. **`userId`**: The individual user identifier (e.g. `ownerId`, `authorId`, `createdBy`).

By default:
- `scopeKey` defaults to `'scopeId'`
- `userKey` defaults to `'userId'`

You can customize both keys to match your database schema.

---

## 1. In-Memory Array Scoping: `scopeRecords()`

Filter an array of records to ensure users only see records matching their partition and ownership requirements:

```typescript
import { scopeRecords } from 'native-access-control';

const records = [
  { id: '1', organizationId: 'org_1', authorId: 'usr_A', title: 'Doc 1' },
  { id: '2', organizationId: 'org_1', authorId: 'usr_B', title: 'Doc 2' },
  { id: '3', organizationId: 'org_2', authorId: 'usr_A', title: 'Doc 3' },
];

// Organization admin (partition match only)
const org1Records = scopeRecords(records, {
  scopeId: 'org_1',
  scopeKey: 'organizationId',
});
// Returns docs 1 and 2

// Standard member (partition match + user ownership match)
const userARecords = scopeRecords(records, {
  scopeId: 'org_1',
  scopeKey: 'organizationId',
  userId: 'usr_A',
  userKey: 'authorId',
});
// Returns doc 1 only
```

---

## 2. ORM / Query Filter Builder: `buildScopeFilter()`

Generate filter objects ready to pass directly to ORMs like **Prisma**, **Drizzle**, **TypeORM**, or **Mongoose**:

```typescript
import { buildScopeFilter } from 'native-access-control';

// 1. Organization filter
const filter = buildScopeFilter({
  scopeId: 'workspace_123',
  scopeKey: 'workspaceId',
});
// => { workspaceId: 'workspace_123' }

// 2. Organization + User ownership filter
const userFilter = buildScopeFilter({
  scopeId: 'workspace_123',
  scopeKey: 'workspaceId',
  userId: 'user_456',
  userKey: 'ownerId',
});
// => { workspaceId: 'workspace_123', ownerId: 'user_456' }

// Use directly in Prisma:
const posts = await prisma.post.findMany({
  where: userFilter,
});
```

---

## 3. Field-Level Masking: `filterRecord()`

Prevent sensitive fields (e.g. `passwordHash`, `internalNotes`, `salary`) from leaking in API responses:

```typescript
import { filterRecord } from 'native-access-control';

const userRecord = {
  id: 'usr_1',
  name: 'Sarah Connor',
  email: 'sarah@example.com',
  passwordHash: '$2b$10$xyz...',
  ssn: '000-00-0000',
  role: 'member',
};

// Only expose safe fields
const safeUser = filterRecord(userRecord, ['id', 'name', 'email', 'role']);

// safeUser is:
// {
//   id: 'usr_1',
//   name: 'Sarah Connor',
//   email: 'sarah@example.com',
//   role: 'member'
// }
```
