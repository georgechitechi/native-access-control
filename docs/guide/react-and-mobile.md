# React & React Native Bindings

`native-access-control/react` provides declarative components and hooks designed for both web (React, Next.js) and mobile (React Native, Expo).

---

## Setup: `createAccessControl`

The cleanest way to set up access control in React is using `createAccessControl`, which produces pre-typed components and hooks:

```tsx
// lib/access.ts
import { createAccessControl } from 'native-access-control/react';

export type Role = 'admin' | 'editor' | 'viewer';
export type Resource = 'articles' | 'settings';
export type Action = 'read' | 'write' | 'publish' | 'manage';

export const {
  engine,
  AccessProvider,
  useAccess,
  Can,
  Cannot,
  Protect,
  createRoleGuard,
} = createAccessControl<Role, Resource, Action>({
  roleHierarchy: {
    admin: ['editor'],
    editor: ['viewer'],
  },
  policies: {
    viewer: ['articles:read'],
    editor: ['articles:write'],
    admin: ['articles:publish', 'settings:manage'],
  },
});
```

---

## `<AccessProvider>`

Wrap your component tree to provide the active user's roles, super-user flag, and loading state:

```tsx
import { AccessProvider } from './lib/access';

export function RootLayout({ children }) {
  const session = useSession(); // e.g. NextAuth, Supabase, Clerk, Firebase

  return (
    <AccessProvider
      roles={session.roles}
      isSuperUser={session.isSuperAdmin}
      loading={session.isLoading}
    >
      {children}
    </AccessProvider>
  );
}
```

---

## Declarative Components

> [!NOTE]
> `<Can>` and `<Protect>` fail closed (`false`) if no guard prop is provided or if only one of `action` / `resource` is passed.

### `<Can>`

Renders its children only if the active user satisfies the check:

```tsx
import { Can } from './lib/access';

// 1. Basic permission check
<Can action="write" resource="articles">
  <button onClick={handleCreate}>New Article</button>
</Can>

// 2. With fallback UI
<Can
  action="manage"
  resource="settings"
  fallback={<p className="text-gray-500">Contact admin for settings</p>}
>
  <SettingsPanel />
</Can>

// 3. Dynamic ABAC context
<Can
  action="write"
  resource="articles"
  context={{ record: article }}
>
  <button onClick={handleEdit}>Edit Article</button>
</Can>
```

### `<Cannot>`

Inverted condition: renders its children when the user does **not** have permission:

```tsx
import { Cannot } from './lib/access';

<Cannot action="publish" resource="articles">
  <div className="banner">
    You do not have permission to publish this article. An editor must approve it.
  </div>
</Cannot>
```

### `<Protect>`

Restricts rendering based on a required role, capability, or condition (evaluates role inheritance automatically):

```tsx
import { Protect } from './lib/access';

<Protect
  roles="admin"
  fallback={<AccessDeniedScreen />}
  loadingFallback={<Spinner />}
>
  <AdminDashboard />
</Protect>
```

---

## `useAccess()` Hook

Use the hook inside any child component to programmatically evaluate permissions:

```tsx
import React from 'react';
import { useAccess } from './lib/access';

export function ArticleToolbar({ article }) {
  const { can, hasRole, roles } = useAccess();

  const canEdit = can('write', 'articles', { record: article });
  const isAdmin = hasRole('admin');

  return (
    <div className="toolbar">
      <span>Roles: {roles.join(', ')}</span>

      {canEdit && <button>Edit</button>}
      {isAdmin && <button>Audit Logs</button>}
    </div>
  );
}
```

> [!NOTE]
> `useAccess()` enforces strict context safety: calling it outside of `<AccessProvider>` throws a descriptive error immediately.

---

## Role Guard Component: `createRoleGuard`

Useful for creating reusable role-gated wrapper components for screens or layouts:

```tsx
import { createRoleGuard } from './lib/access';

function UnauthorizedFallback() {
  return <div>Please ask an administrator for billing access.</div>;
}

const AdminOnly = createRoleGuard('admin', <UnauthorizedFallback />);

export function BillingPage() {
  return (
    <AdminOnly>
      <div>Sensitive Billing Information</div>
    </AdminOnly>
  );
}
```
