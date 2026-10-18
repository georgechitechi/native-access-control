# Quick Start

Get up and running with `native-access-control` in minutes.

---

## 1. Installation

```bash
npm install native-access-control
```

If you plan to use React or React Native components, make sure `react` is installed in your application (`react` is an optional peer dependency).

---

## 2. Setting Up Access Control

Create a shared configuration module in your project (for example, `src/shared/access.ts` or `lib/auth/access.ts`):

```typescript
import { createAccessControl } from 'native-access-control/react';

// Define your roles and permissions as union types for full autocompletion
export type AppRole = 'superadmin' | 'admin' | 'editor' | 'viewer';
export type AppPermission =
  | 'posts:read'
  | 'posts:create'
  | 'posts:update'
  | 'posts:delete'
  | 'users:manage'
  | 'settings:*';

export const {
  AccessProvider,
  useAccess,
  Can,
  Cannot,
  Protect,
  createRoleGuard,
  evaluator,
} = createAccessControl<AppRole, AppPermission>({
  roles: ['superadmin', 'admin', 'editor', 'viewer'],
  hierarchy: {
    superadmin: ['admin'],
    admin: ['editor'],
    editor: ['viewer'],
  },
  policies: {
    viewer: ['posts:read'],
    editor: ['posts:create', 'posts:update'],
    admin: ['posts:delete', 'settings:*'],
    superadmin: ['*'], // Superadmin wildcard can do everything
  },
  superRoles: ['superadmin'],
});
```

---

## 3. Using in React / Next.js / React Native

Wrap your application root with `<AccessProvider>`:

```tsx
// App.tsx or RootLayout.tsx
import React from 'react';
import { AccessProvider } from './shared/access';

export function App() {
  // Obtain the active user's roles and scope from your auth state/session
  const user = {
    id: 'usr_456',
    roles: ['editor'],
    organizationId: 'org_99',
  };

  return (
    <AccessProvider
      roles={user.roles}
      scopeId={user.organizationId}
      userId={user.id}
    >
      <Dashboard />
    </AccessProvider>
  );
}
```

Now render conditional UI seamlessly with `<Can>`:

```tsx
import React from 'react';
import { Can, Cannot, useAccess } from './shared/access';

export function Dashboard() {
  const { can, hasRole } = useAccess();

  return (
    <div>
      <h1>Workspace Dashboard</h1>

      {/* Declarative component check */}
      <Can perform="posts:create">
        <button>Create New Post</button>
      </Can>

      <Can perform="posts:delete">
        <button style={{ color: 'red' }}>Delete Post</button>
      </Can>

      <Cannot perform="posts:delete">
        <span className="text-muted">You do not have permission to delete posts.</span>
      </Cannot>

      {/* Programmatic hook check */}
      {can('settings:*') && (
        <a href="/settings">Workspace Settings</a>
      )}
    </div>
  );
}
```

---

## 4. Using in Node.js / Server Routes

On your server (Node, Express, Fastify, Next.js Route Handlers, tRPC), evaluate permissions directly with the evaluator or assertions:

```typescript
import { evaluator } from './shared/access';
import { assertCan } from 'native-access-control';

export async function handleUpdatePost(req, res) {
  const user = req.user; // e.g. { roles: ['editor'], id: 'usr_1' }

  // 1. Boolean check
  if (!evaluator.can(user.roles, 'posts:update')) {
    return res.status(403).json({ error: 'Access Denied' });
  }

  // 2. Or throw AccessDeniedError automatically:
  assertCan(evaluator, user.roles, 'posts:update');

  // Proceed with safe update...
}
```
