# Navigation & Assertions

`native-access-control` includes dedicated utilities for route-level protection (Next.js, Expo Router, React Router) and strict assertions with standard HTTP error codes.

---

## Route-Level Access: `checkRouteAccess()`

Map routes to required roles and evaluate whether an active user can access a route:

```typescript
import { checkRouteAccess } from 'native-access-control';

// Define route permissions map
const routePermissions = {
  '/admin/*': 'admin',
  '/settings/billing': ['admin', 'billing_manager'],
  '/dashboard/*': ['admin', 'editor', 'viewer'],
  '/': '*', // Public access for any authenticated or anonymous role
};

// Check access
checkRouteAccess(routePermissions, ['editor'], '/admin/users'); // false
checkRouteAccess(routePermissions, ['admin'], '/admin/users');  // true
checkRouteAccess(routePermissions, ['editor'], '/dashboard/overview'); // true
```

### Route Wildcards

- `*` or `'*'` matches any role (public route).
- `/path/*` matches any sub-path (e.g. `/admin/*` matches `/admin`, `/admin/settings`, `/admin/users/123`).

### Next.js Middleware Example

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkRouteAccess } from 'native-access-control';

const ROUTE_ROLES = {
  '/admin/*': 'admin',
  '/account/*': ['admin', 'member'],
};

export function middleware(req: NextRequest) {
  const userRoles = req.cookies.get('user_roles')?.value.split(',') || [];
  const pathname = req.nextUrl.pathname;

  const allowed = checkRouteAccess(ROUTE_ROLES, userRoles, pathname);

  if (!allowed) {
    return NextResponse.redirect(new URL('/unauthorized', req.url));
  }

  return NextResponse.next();
}
```

### Expo Router Example

```tsx
// app/_layout.tsx
import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { checkRouteAccess } from 'native-access-control';
import { useAuth } from '../hooks/useAuth';

const ROUTE_PERMISSIONS = {
  '/(admin)/*': 'admin',
  '/(app)/*': ['admin', 'member'],
};

export default function RootLayout() {
  const { user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const currentRoute = `/${segments.join('/')}`;
    const allowed = checkRouteAccess(
      ROUTE_PERMISSIONS,
      user?.roles || [],
      currentRoute
    );

    if (!allowed) {
      router.replace('/unauthorized');
    }
  }, [segments, user]);

  return <Slot />;
}
```

---

## Strict Assertions & Errors

When building API endpoints, server actions, or mutation handlers, you often want to throw immediately if permission is denied.

### `assertCan()`

```typescript
import { assertCan, AccessDeniedError } from 'native-access-control';
import { evaluator } from './access';

export async function deleteUserMutation(actorRoles: string[], targetUserId: string) {
  try {
    assertCan(
      evaluator,
      actorRoles,
      'users:delete',
      undefined,
      'You are not permitted to delete users.'
    );

    // Perform database deletion...
  } catch (err) {
    if (err instanceof AccessDeniedError) {
      console.error(err.statusCode); // 403
      console.error(err.action);     // 'users:delete'
      console.error(err.roles);      // actorRoles
    }
    throw err;
  }
}
```

### `assertHasRole()`

```typescript
import { assertHasRole } from 'native-access-control';
import { evaluator } from './access';

export async function configureTenant(roles: string[]) {
  // Throws AccessDeniedError (403) if user does not have 'admin' or an inheriting role
  assertHasRole(evaluator, roles, 'admin');
}
```

### `AccessDeniedError` Properties

| Property | Type | Description |
|---|---|---|
| `message` | `string` | Error description (defaults to `"Access denied for action: <action>"`) |
| `name` | `'AccessDeniedError'` | Error name |
| `statusCode` | `403` | Standard HTTP forbidden status code |
| `action` | `string \| undefined` | The action that was denied (if triggered by `assertCan`) |
| `roles` | `string[]` | The active roles evaluated |
