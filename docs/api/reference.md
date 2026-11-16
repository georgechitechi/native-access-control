# API Reference

Comprehensive reference for all functions, types, components, and classes in `native-access-control`.

---

## Core (`native-access-control`)

### `createAccessEngine<TRole, TResource, TAction, TContext>(config)`

Creates an access-control engine instance.

#### Parameters: `AccessControlConfig<TRole, TResource, TAction, TContext>`
- `policies: Policies<TRole, TResource, TAction, TContext>` — Mapping of roles to permission strings or `RuleObject`s.
- `roleHierarchy?: RoleHierarchy<TRole>` — Role inheritance mapping.
- `superRoles?: string[]` — Roles that bypass all checks.
- `normalizeRole?: (role: string) => string` — Custom role normalizer (defaults to `trim().toLowerCase()`).
- `defaultFallback?: any` — Default fallback node for `<Protect>` and `createRoleGuard`.

#### Engine Methods
- `.evaluate(userRoles, action, resource, context?, isSuperUser?)`: `boolean`
- `.buildEvaluator(userRoles, isSuperUser?)`: `AccessEvaluator<TRole, TResource, TAction, TContext>`
- `.addPolicy(role, rule)`: `void`
- `.setPolicies(policies)`: `void`
- `.getPolicies()`: `Policies<...>`

---

### `AccessEvaluator<TRole, TResource, TAction, TContext>`

- `.can(action, resource, context?)`: `boolean`
- `.cannot(action, resource, context?)`: `boolean`
- `.canAll(checks, context?)`: `boolean`
- `.canAny(checks, context?)`: `boolean`
- `.hasRole(roleOrRoles)`: `boolean`
- `.hasAllRoles(roles)`: `boolean`
- `.hasAnyRole(roles)`: `boolean`
- `.roles`: `TRole[]`
- `.effectiveRoles`: `TRole[]`

---

### `scopeRecords<TRecord>(records, options)`
Filters an in-memory array of records by partition and/or user ownership.

#### Options: `ScopeRecordsOptions<TRecord>`
- `scopeId?: any` — Partition value.
- `scopeKey?: keyof TRecord` — Partition property name (defaults to `'scopeId'`).
- `userId?: any` — User ownership value.
- `userKey?: keyof TRecord` — User ownership property name (defaults to `'userId'`).
- `isRestrictedRole?: boolean | ((roles?: string[]) => boolean)` — Applies ownership check when `true`.
- `roles?: string[]` — Passed to `isRestrictedRole` when it is a function.
- `predicate?: (record: TRecord) => boolean` — Optional custom filter.
- `fallbackToEmpty?: boolean` — Returns `[]` if restricted and `userId` is missing (defaults to `true`).

---

### `buildScopeFilter(options)`
Returns an object suitable for ORM query `where` clauses (e.g. Prisma, Drizzle, Mongoose). Throws `AccessDeniedError` if `isRestrictedRole` is `true` and `userId` is `undefined` or `null`.

---

### `filterRecord<TRecord>(record, options)`
Projects `allowedFields` (or `'*'`) and omits `omitFields` from a record object, returning `Partial<TRecord>`.

---

### `checkRouteAccess(pathname, userRoles, routes, options?)`
Matches a URL path against a routing policy table. Normalizes query strings, hashes, trailing slashes, and roles, and evaluates the longest matching `/*` prefix first.
- Returns `{ allowed: boolean; redirectTo?: string }`.

---

### `assertCan(evaluator, action, resource, context?, customMessage?)`
Throws `AccessDeniedError` (HTTP 403) if `evaluator` is missing or `evaluator.can(action, resource, context)` is `false`.

---

### `assertHasRole(evaluator, roleOrRoles, customMessage?)`
Throws `AccessDeniedError` (HTTP 403) if `evaluator` is missing or `evaluator.hasRole(roleOrRoles)` is `false`.

---

### `AccessDeniedError`
Custom Error class.
- `statusCode`: `403`
- `action`: `string | undefined`
- `resource`: `string | undefined`

---

## React (`native-access-control/react`)

### `createAccessControl<TRole, TResource, TAction, TContext>(config)`
Returns a typed React suite:
- `engine`
- `AccessProvider`
- `useAccess`
- `Can`
- `Cannot`
- `Protect`
- `createRoleGuard`
- `scopeRecords`

---

### `<AccessProvider>`
Props:
- `roles?: TRole[]` — Active user's roles.
- `isSuperUser?: boolean` — Bypass all checks.
- `loading?: boolean` — Loading state flag.
- `children: ReactNode`

---

### `<Can>`
Props (fails closed if no guard prop or partial `action`/`resource` is provided):
- `action?: TAction | string`
- `resource?: TResource | string`
- `roles?: TRole | TRole[] | string`
- `condition?: boolean`
- `context?: TContext`
- `not?: boolean`
- `fallback?: ReactNode`
- `children?: ReactNode | ((allowed: boolean) => ReactNode)`

---

### `<Cannot>`
Same props as `<Can>` (without `not`); renders `children` when access is NOT granted.

---

### `<Protect>`
Props (fails closed if no guard prop or partial `action`/`resource` is provided):
- `action?: TAction | string`
- `resource?: TResource | string`
- `roles?: TRole | TRole[] | string`
- `condition?: boolean`
- `context?: TContext`
- `fallback?: ReactNode`
- `loadingFallback?: ReactNode`
- `children: ReactNode`

---

### `useAccess<TRole, TResource, TAction, TContext>()`
Returns `AccessEvaluator` methods/fields plus `loading: boolean` and `isSuperUser: boolean`.

---

### `createRoleGuard(allowedRoles, defaultFallback?)`
Returns a React guard component `({ children, fallback? }) => ReactElement | null`.

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

