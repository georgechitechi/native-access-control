# React & React Native Bindings

`native-access-control/react` provides declarative components and hooks designed for both web (React, Next.js) and mobile (React Native, Expo).

---

## Setup: `createAccessControl`

The cleanest way to set up access control in React is using `createAccessControl`, which produces pre-typed components and hooks:

```tsx
// lib/access.ts
import { createAccessControl } from 'native-access-control/react';

export type Role = 'admin' | 'editor' | 'viewer';
export type Action =
  | 'articles:read'
  | 'articles:write'
  | 'articles:publish'
  | 'settings:manage';

export const {
  AccessProvider,
  useAccess,
  Can,
  Cannot,
  Protect,
  createRoleGuard,
  evaluator,
} = createAccessControl<Role, Action>({
  roles: ['admin', 'editor', 'viewer'],
  hierarchy: {
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

Wrap your component tree to provide current roles and scoping context:

```tsx
import { AccessProvider } from './lib/access';

export function RootLayout({ children }) {
  const session = useSession(); // e.g. NextAuth, Supabase, Clerk, Firebase

  return (
    <AccessProvider
      roles={session.roles}         // e.g. ['editor']
      scopeId={session.orgId}       // partition/organization ID
      userId={session.user.id}      // active user ID
    >
      {children}
    </AccessProvider>
  );
}
```

---

## Declarative Components

### `<Can>`

Renders its children only if the active user has permission to perform the action:

```tsx
import { Can } from './lib/access';

// 1. Basic permission check
<Can perform="articles:write">
  <button onClick={handleCreate}>New Article</button>
</Can>

// 2. With fallback UI
<Can
  perform="settings:manage"
  fallback={<p className="text-gray-500">Contact admin for settings</p>}
>
  <SettingsPanel />
</Can>

// 3. Dynamic ABAC context
<Can
  perform="articles:write"
  context={{ record: article }}
>
  <button onClick={handleEdit}>Edit Article</button>
</Can>
```

### `<Cannot>`

Inverted condition: renders its children when the user does **not** have permission:

```tsx
import { Cannot } from './lib/access';

<Cannot perform="articles:publish">
  <div className="banner">
    You do not have permission to publish this article. An editor must approve it.
  </div>
</Cannot>
```

### `<Protect>`

Restricts rendering based on a required role (evaluates role inheritance automatically):

```tsx
import { Protect } from './lib/access';

<Protect
  role="admin"
  fallback={<AccessDeniedScreen />}
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
  const { can, hasRole, roles, scopeId, userId } = useAccess();

  const canEdit = can('articles:write', { record: article });
  const isAdmin = hasRole('admin');

  return (
    <div className="toolbar">
      <span>Logged in as: {userId} ({roles.join(', ')})</span>

      {canEdit && <button>Edit</button>}
      {isAdmin && <button>Audit Logs</button>}
    </div>
  );
}
```

> [!NOTE]
> `useAccess()` enforces strict context safety: calling it outside of `<AccessProvider>` throws a descriptive error immediately.

---

## Higher-Order Component: `createRoleGuard`

Useful for protecting entire page or screen components:

```tsx
import { createRoleGuard, evaluator } from './lib/access';

function BillingPage() {
  return <div>Sensitive Billing Information</div>;
}

function UnauthorizedFallback() {
  return <div>Please ask an administrator for billing access.</div>;
}

// Export the protected screen
export default createRoleGuard(evaluator, 'admin', UnauthorizedFallback)(BillingPage);
```
