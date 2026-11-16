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

// Define your roles, resources, and actions as union types for full autocompletion
export type AppRole = 'superadmin' | 'admin' | 'editor' | 'viewer';
export type AppResource = 'posts' | 'users' | 'settings';
export type AppAction = 'read' | 'create' | 'update' | 'delete' | 'manage';

export const {
  engine,
  AccessProvider,
  useAccess,
  Can,
  Cannot,
  Protect,
  createRoleGuard,
} = createAccessControl<AppRole, AppResource, AppAction>({
  roleHierarchy: {
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
  // Obtain the active user's roles from your auth state/session
  const user = {
    id: 'usr_456',
    roles: ['editor'] as const,
  };

  return (
    <AccessProvider roles={[...user.roles]}>
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
  const { can } = useAccess();

  return (
    <div>
      <h1>Workspace Dashboard</h1>

      {/* Declarative component check */}
      <Can action="create" resource="posts">
        <button>Create New Post</button>
      </Can>

      <Can action="delete" resource="posts">
        <button style={{ color: 'red' }}>Delete Post</button>
      </Can>

      <Cannot action="delete" resource="posts">
        <span className="text-muted">You do not have permission to delete posts.</span>
      </Cannot>

      {/* Programmatic hook check */}
      {can('manage', 'settings') && (
        <a href="/settings">Workspace Settings</a>
      )}
    </div>
  );
}
```

---

## 4. Using in Node.js / Server Routes

On your server (Node, Express, Fastify, Next.js Route Handlers, tRPC), build a per-user evaluator from `engine` and evaluate or assert permissions:

```typescript
import { engine } from './shared/access';
import { assertCan } from 'native-access-control';

export async function handleUpdatePost(req, res) {
  const evaluator = engine.buildEvaluator(req.user.roles);

  // 1. Boolean check
  if (!evaluator.can('update', 'posts')) {
    return res.status(403).json({ error: 'Access Denied' });
  }

  // 2. Or throw AccessDeniedError (HTTP 403) automatically:
  assertCan(evaluator, 'update', 'posts');

  // Proceed with safe update...
}
```
