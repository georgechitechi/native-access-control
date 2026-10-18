# API Reference

Comprehensive reference for all functions, types, components, and classes in `native-access-control`.

---

## Core (`native-access-control`)

### `createAccessEvaluator<TRole, TPermission>(config)`

Creates an `AccessEvaluator` instance.

#### Parameters: `AccessControlConfig<TRole, TPermission>`
- `roles?: TRole[]` — Optional array of valid roles.
- `hierarchy?: Record<TRole, string[]>` — Role inheritance mapping.
- `policies?: Policies<TRole, TPermission>` — Mapping of roles to granted actions or ABAC rules.
- `superRoles?: string[]` — Roles that bypass checks and have global access.

---

### `AccessEvaluator<TRole, TPermission>`

#### `.can(roles, action, context?)`
Evaluates whether any role in `roles` (or inherited roles) grants `action`.
- Returns `boolean`.
- Evaluates explicit denies first (`!action` or `{ effect: 'deny' }`).
- Evaluates ABAC conditions (`condition(context)`).

#### `.hasRole(roles, targetRole)`
Checks if `roles` contains or transitively inherits `targetRole`.
- Returns `boolean`.

#### `.getPolicies()`
Returns a snapshot copy of current active policies.

#### `.setPolicies(policies)`
Updates the policies at runtime.

---

### `scopeRecords<T>(records, options)`
Filters an in-memory array of records by partition and/or user ownership.

#### Options: `ScopeOptions`
- `scopeId?: string` — Partition value.
- `scopeKey?: string` — Partition property name (defaults to `'scopeId'`).
- `userId?: string` — User ownership value.
- `userKey?: string` — User ownership property name (defaults to `'userId'`).

---

### `buildScopeFilter(options)`
Returns an object suitable for ORM query `where` clauses (e.g. Prisma, Drizzle, TypeORM).

---

### `filterRecord<T>(record, allowedFields)`
Picks only the specified keys from a record object.
- Returns `Partial<T>`.

---

### `checkRouteAccess(routeRoles, userRoles, currentRoute)`
Matches a URL path against a routing policy table. Supports sub-path wildcards (`/admin/*`) and global wildcards (`*`).
- Returns `boolean`.

---

### `assertCan(evaluator, roles, action, context?, message?)`
Throws `AccessDeniedError` (HTTP 403) if `evaluator.can(roles, action, context)` is `false`.

---

### `assertHasRole(evaluator, roles, targetRole, message?)`
Throws `AccessDeniedError` (HTTP 403) if `evaluator.hasRole(roles, targetRole)` is `false`.

---

### `AccessDeniedError`
Custom Error class.
- `statusCode`: `403`
- `action`: `string | undefined`
- `roles`: `string[]`

---

## React (`native-access-control/react`)

### `createAccessControl<TRole, TPermission>(config)`
Returns a typed React suite:
- `AccessProvider`
- `useAccess`
- `Can`
- `Cannot`
- `Protect`
- `createRoleGuard`
- `evaluator`

---

### `<AccessProvider>`
Props:
- `roles: string[]` — Active user's roles.
- `scopeId?: string` — Active partition/organization ID.
- `userId?: string` — Active user ID.
- `evaluator?: AccessEvaluator` — Optional evaluator instance (defaults to pre-configured instance).
- `children: ReactNode`

---

### `<Can>`
Props:
- `perform: TPermission` — The required permission.
- `context?: Record<string, any>` — Optional ABAC context.
- `fallback?: ReactNode` — Rendered if denied.
- `children: ReactNode` — Rendered if granted.

---

### `<Cannot>`
Props:
- `perform: TPermission` — Permission to check.
- `context?: Record<string, any>` — Optional ABAC context.
- `children: ReactNode` — Rendered if denied.

---

### `<Protect>`
Props:
- `role: TRole` — Required role.
- `fallback?: ReactNode` — Rendered if user lacks role.
- `children: ReactNode` — Rendered if role is present/inherited.

---

### `useAccess<TRole, TPermission>()`
Returns:
- `can(action, context?)`: `boolean`
- `hasRole(targetRole)`: `boolean`
- `roles`: `string[]`
- `scopeId`: `string | undefined`
- `userId`: `string | undefined`
- `evaluator`: `AccessEvaluator`

---

### `createRoleGuard(evaluator, requiredRole, FallbackComponent?)`
Higher-Order Component returning `(WrappedComponent) => React.FC`.

---

## Adapters (`native-access-control/adapters`)

### Drizzle ORM
- `toDrizzleWhere(table, options, operators)`: Generates composite Drizzle conditions combining partition scope and ownership.

### Prisma
- `toPrismaWhere(options)`: Generates Prisma `where` clause object.
- `createPrismaScopeExtension(config)`: Prisma Client extension auto-injecting scope filters on queries.

### MongoDB & Mongoose
- `toMongoFilter(options)`: Generates Mongo/Mongoose filter dictionary.

### Supabase
- `applySupabaseScope(query, options)`: Chains `.eq()` filters onto a Supabase query builder.
- `toSupabaseMatch(options)`: Returns an object formatted for Supabase `.match()`.

### PostgreSQL
- `toPostgresWhere(options, startIndex?)`: Returns `{ clause: string, values: string[] }`.
- `generateRlsPolicy(options)`: Returns standard PostgreSQL `ALTER TABLE ... ENABLE ROW LEVEL SECURITY; CREATE POLICY ...` SQL.

### Next.js (App Router)
- `protectAction(evaluator, action, fn, getContext?)`: Guard wrapper for Next.js Server Actions.
- `protectRouteHandler(getEvaluator, action, handler)`: Guard wrapper for App Router API route handlers (`GET`, `POST`, `DELETE`).

### Express & Connect
- `expressGuard(evaluator, action, options?)`: Middleware returning 403 on denied access.

### Hono (Edge / Bun / Cloudflare)
- `honoGuard(evaluator, action, options?)`: Middleware returning 403 JSON responses on denied access.

### tRPC
- `createTrpcGuard(evaluator, action, options?)`: Middleware for tRPC procedure chains.

