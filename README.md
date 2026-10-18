# native-access-control

Zero-overhead, type-safe Role & Attribute-Based Access Control (**RBAC & ABAC**) with role inheritance, multi-tenant data scoping, and declarative UI guards.

Universal: works across **React**, **React Native / Expo**, **Next.js**, **Node.js**, and any TypeScript project.

[![npm version](https://img.shields.io/badge/npm-v1.1.0-blue.svg)](https://www.npmjs.com/package/native-access-control)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Dependencies: 0](https://img.shields.io/badge/dependencies-0-green.svg)](package.json)
[![Type-Safe](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](src/types.ts)

---

## Features

- 🚀 **Zero Dependencies**: Lightweight, pure TypeScript core.
- 🎯 **Full Type-Safety**: Compile-time autocompletion for Roles, Resources, and Actions.
- 🌲 **Role Hierarchy**: Roles inherit parent permissions (`owner` ➔ `admin` ➔ `editor` ➔ `viewer`).
- 🚫 **Explicit Denials**: Deny rules override allow rules for security-critical restrictions.
- ⚡ **Dynamic ABAC**: Context-aware rule predicates `(context) => boolean`.
- 🏢 **Multi-Tenant Data Scoping**: `scopeRecords()` for tenant (`tenantId`) and ownership (`userId`) filtering.
- 📱 **Declarative UI Guards**: `<Can>`, `<Cannot>`, `<Protect>`, and `createRoleGuard()`.

---

## Installation

```bash
npm install native-access-control
```

*Note: `react` and `react-native` are optional peer dependencies. If using on the backend or in Node.js, no React packages are needed.*

---

## Usage Guide

### 1. Define Policies & Create Suite

Create an `access.ts` file in your project to define your application's roles, resources, actions, and policies:

```tsx
// access.ts
import { createAccessControl } from 'native-access-control';

export type Role = 'owner' | 'admin' | 'editor' | 'viewer';
export type Resource = 'post' | 'comment' | 'billing' | 'user';
export type Action = 'create' | 'read' | 'edit' | 'delete' | 'publish';

export interface AppContext {
  userId?: string;
  post?: { authorId: string; isLocked?: boolean };
}

export const {
  AccessProvider,
  useAccess,
  Can,
  Cannot,
  Protect,
  createRoleGuard,
  scopeRecords,
  engine,
} = createAccessControl<Role, Resource, Action, AppContext>({
  policies: {
    // Wildcard matches everything
    admin: ['*'],

    // Resource wildcards & ABAC rules
    editor: [
      'post:*',
      'comment:*',
      {
        action: 'delete',
        resource: 'post',
        effect: 'deny',
        condition: (ctx) => Boolean(ctx.post?.isLocked), // Explicit deny rule
      },
    ],

    // Read-only role
    viewer: ['post:read', 'comment:read'],
  },

  // Role inheritance (admin inherits editor, which inherits viewer)
  roleHierarchy: {
    owner: ['admin'],
    admin: ['editor'],
    editor: ['viewer'],
  },

  // Roles that automatically bypass all checks
  superRoles: ['owner'],
});

// Reusable role-specific guard components
export const AdminOnly = createRoleGuard('admin');
export const EditorOrAdmin = createRoleGuard(['admin', 'editor']);
```

---

### 2. Wrap App with `AccessProvider`

Provide the active user's roles and superuser status at the root of your application (e.g. `App.tsx`, `layout.tsx`, or `_app.tsx`):

```tsx
import { AccessProvider } from './access';

function App() {
  const userRoles = ['editor']; // Loaded from your auth / session
  const isOwner = false;

  return (
    <AccessProvider roles={userRoles} isSuperUser={isOwner}>
      <MainNavigator />
    </AccessProvider>
  );
}
```

---

### 3. Programmatic Checks with `useAccess()`

Use the `useAccess()` hook inside any React or React Native component for imperative logic:

```tsx
import { useAccess } from './access';

export function PostActions({ post, currentUser }) {
  const { can, cannot, hasRole, roles } = useAccess();

  const handleEdit = () => {
    if (cannot('edit', 'post', { post })) {
      alert('You do not have permission to edit this post.');
      return;
    }
    navigateToEdit(post.id);
  };

  return (
    <div>
      {can('edit', 'post', { post }) && (
        <button onClick={handleEdit}>Edit Post</button>
      )}

      {hasRole('admin') && (
        <button onClick={() => deletePost(post.id)}>Admin Delete</button>
      )}
    </div>
  );
}
```

#### Hook Methods:
- `can(action, resource, context?)`: Returns `true` if permitted.
- `cannot(action, resource, context?)`: Returns `true` if forbidden.
- `canAll(checks, context?)`: Returns `true` if **all** checks pass.
- `canAny(checks, context?)`: Returns `true` if **at least one** check passes.
- `hasRole(roleOrRoles)`: Checks if user has a role (respects inheritance).
- `hasAllRoles(roles)`: Checks if user has all specified roles.
- `roles`: Current active roles.
- `effectiveRoles`: Active roles plus all transitively inherited roles.

---

### 4. Declarative UI Guards (`<Can>` & `<Cannot>`)

#### Standard Guard
Renders children only when the permission check passes:

```tsx
import { Can } from './access';

<Can action="publish" resource="post">
  <PublishButton />
</Can>
```

#### Inverse Guard (`<Cannot>`)
Renders children when an action is **not** permitted (great for upgrade prompts, tooltips, or read-only indicators):

```tsx
import { Cannot } from './access';

<Cannot action="delete" resource="post" context={{ post }}>
  <span className="badge">Locked / Read Only</span>
</Cannot>
```

#### Render Prop Pattern
Pass a function as children to control element state (e.g. disabling buttons):

```tsx
<Can action="edit" resource="post" context={{ post }}>
  {(allowed) => (
    <button disabled={!allowed} onClick={onEdit}>
      {allowed ? 'Edit' : 'Edit (Locked)'}
    </button>
  )}
</Can>
```

#### Role Checks & Fallbacks
```tsx
<Can roles={['admin', 'editor']} fallback={<p>Editors only</p>}>
  <EditorPanel />
</Can>
```

---

### 5. Screen & Layout Protection (`<Protect>`)

Protect entire routes, screens, or navigation tabs:

```tsx
import { Protect } from './access';

export default function SettingsScreen() {
  return (
    <Protect
      roles="admin"
      fallback={<AccessDeniedView />}
      loadingFallback={<Spinner />}
    >
      <AdminSettingsList />
    </Protect>
  );
}
```

Or protect based on capabilities:

```tsx
<Protect action="read" resource="billing" fallback={<UnauthorizedScreen />}>
  <BillingDashboard />
</Protect>
```

---

### 6. Partition & Ownership Data Scoping (`scopeRecords`)

Filter raw arrays in state, services, or APIs to ensure restricted roles only see their permitted records (by workspace, org, or ownership), while privileged users see all records:

```ts
import { scopeRecords } from './access';

// Scopes records based on partition/scope and ownership:
const visiblePosts = scopeRecords(allPosts, {
  // 1. Scope partition isolation (workspace, org, account, project, etc.)
  scopeId: activeWorkspaceId,
  scopeKey: 'workspaceId',

  // 2. Ownership check (applied only if restricted)
  userId: currentUserId,
  userKey: 'authorId', // defaults to 'userId'
  isRestrictedRole: !currentUser.isAdmin,

  // 3. Optional custom predicate (ABAC)
  predicate: (post) => !post.isArchived,
});
```

---

### 7. Node.js, Express & Backend API Usage

You can use the engine directly on your backend with zero React dependencies:

```ts
import { createAccessEngine } from 'native-access-control';

const engine = createAccessEngine({
  policies: {
    admin: ['*'],
    editor: ['post:*'],
    viewer: ['post:read'],
  },
  roleHierarchy: {
    admin: ['editor'],
    editor: ['viewer'],
  },
});

// Express route handler
app.delete('/api/posts/:id', (req, res) => {
  const evaluator = engine.buildEvaluator(req.user.roles);

  if (evaluator.cannot('delete', 'post')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Proceed with deletion...
});
```

---

### 8. Database Query Filtering (`buildScopeFilter`)

Generate a WHERE filter object for databases or ORMs (Prisma, Supabase, Drizzle, Mongo):

```ts
import { buildScopeFilter } from 'native-access-control';

const where = buildScopeFilter({
  scopeId: activeWorkspaceId,
  scopeKey: 'workspace_id',
  userId: currentUserId,
  userKey: 'author_id',
  isRestrictedRole: !isAdmin,
});

// Prisma:   db.document.findMany({ where })
// Supabase: supabase.from('documents').select().match(where)
```

---

### 9. Fail-Fast Assertions (`assertCan` & `assertHasRole`)

Cleanly guard mutations, handlers, or background services without repetitive `if (cannot(...))` blocks:

```ts
import { assertCan, assertHasRole } from 'native-access-control';

async function deleteContract(id: string) {
  // Automatically throws AccessDeniedError (403) if unauthorized
  assertCan(evaluator, 'delete', 'contract');
  await api.deleteContract(id);
}
```

---

### 10. Route & Navigation Protection (`checkRouteAccess`)

Check navigation routes in Expo Router (`_layout.tsx`), React Navigation, or Next.js:

```ts
import { checkRouteAccess } from 'native-access-control';

const { allowed, redirectTo } = checkRouteAccess(pathname, userRoles, {
  '/admin/*': ['admin'],
  '/reports': ['admin', 'staff'],
  '/public': '*',
}, { fallbackRoute: '/dashboard' });

if (!allowed) {
  return <Redirect href={redirectTo} />;
}
```

---

### 11. Sensitive Field Masking (`filterRecord`)

Filter unauthorized fields before returning data to the client:

```ts
import { filterRecord } from 'native-access-control';

const safeProperty = filterRecord(property, {
  allowedFields: isTenant ? ['id', 'address', 'rent'] : '*',
  omitFields: isTenant ? ['owner_bank_details', 'internal_notes'] : [],
});
```

---

## API Summary

| Export | Type | Description |
|---|---|---|
| `createAccessControl(config)` | Factory | Creates typed React suite (`AccessProvider`, `useAccess`, `Can`, `Protect`, `engine`) |
| `createAccessEngine(config)` | Function | Creates standalone core engine (RBAC/ABAC) |
| `<AccessProvider>` | Component | React Context Provider for roles & permissions |
| `useAccess()` | Hook | Provides `can()`, `cannot()`, `hasRole()`, `roles` |
| `<Can>` | Component | Conditional render component based on permissions or roles |
| `<Cannot>` | Component | Inverted conditional render component |
| `<Protect>` | Component | Screen/route guard with fallback support |
| `createRoleGuard(roles)` | Helper | Creates custom single/multi-role components (e.g. `<AdminOnly>`) |
| `scopeRecords(records, options)` | Function | Filters in-memory arrays by tenant and ownership |
| `buildScopeFilter(options)` | Function | Generates database query WHERE filters (Prisma/Drizzle/Supabase) |
| `filterRecord(record, options)` | Function | Masks/omits sensitive object fields |
| `assertCan(eval, action, res)` | Function | Throws `AccessDeniedError` if capability check fails |
| `assertHasRole(eval, roles)` | Function | Throws `AccessDeniedError` if role check fails |
| `checkRouteAccess(path, roles, routes)` | Function | Validates route permissions for Expo Router / Next.js |
| `AccessDeniedError` | Error | Standard 403 error class with action/resource context |

---

## License

MIT © [EnvKit](https://envkit.dev)
