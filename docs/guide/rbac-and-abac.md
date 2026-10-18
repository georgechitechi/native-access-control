# RBAC & ABAC Engine

`native-access-control` combines high-performance **Role-Based Access Control (RBAC)** with dynamic **Attribute-Based Access Control (ABAC)**.

---

## Permission Patterns

Permissions are strings that typically follow the format `resource:action` (e.g. `documents:read`, `users:invite`).

### 1. Exact Match
```typescript
policies: {
  member: ['documents:read', 'documents:create']
}
```

### 2. Wildcards
Wildcard `*` allows matching any sub-action under a resource, or universal access across all resources:

- `documents:*` — matches `documents:read`, `documents:write`, `documents:delete`, etc.
- `*` — matches every permission in the system (useful for `superadmin` or root roles).

```typescript
policies: {
  editor: ['documents:*'],
  superadmin: ['*'],
}
```

### 3. Explicit Deny

Explicit denies take highest precedence: if a role or inherited role has an explicit deny on an action, permission is denied even if another policy grants it.

You can specify explicit deny using the `!` prefix shorthand or full rule object:

```typescript
policies: {
  intern: [
    'documents:*',         // Grant all document permissions...
    '!documents:delete',   // ...EXCEPT delete
  ],
  contractor: [
    {
      action: 'billing:*',
      effect: 'deny',
    },
  ],
}
```

---

## Attribute-Based Access Control (ABAC)

Static role checks often fall short when authorization depends on dynamic context, such as:
- Is the user the author/creator of the document?
- Is the document in `draft` status?
- Is the request originating during business hours or within an approved IP block?

### Defining ABAC Rules

Rules can be defined as objects containing an `action` and a `condition` function:

```typescript
import { createAccessEvaluator } from 'native-access-control';

const ac = createAccessEvaluator({
  policies: {
    author: [
      {
        action: 'article:edit',
        condition: (context) => {
          // Grant access only if author matches current user
          return context.record?.authorId === context.user?.id;
        },
      },
      {
        action: 'article:publish',
        condition: (context) => {
          // Cannot publish if article is flagged for review
          return context.record?.flagged === false;
        },
      },
    ],
  },
});
```

### Evaluating ABAC Rules

Pass the runtime `context` object as the third argument to `.can()`:

```typescript
const user = { id: 'usr_100', role: 'author' };
const article = { id: 'art_1', authorId: 'usr_100', flagged: false };

const isAllowed = ac.can([user.role], 'article:edit', {
  user,
  record: article,
}); // true

const isDenied = ac.can([user.role], 'article:edit', {
  user,
  record: { authorId: 'usr_200' }, // different author
}); // false
```

---

## Super Roles

You can designate certain roles as `superRoles`. Super roles automatically bypass condition checks and explicit denies, receiving unrestricted access across the system:

```typescript
const ac = createAccessEvaluator({
  superRoles: ['superadmin'],
  policies: {
    superadmin: ['*'],
    member: ['profile:read'],
  },
});

ac.can(['superadmin'], 'anything:whatever'); // always true
```

---

## Dynamic Policy Mutation

In multi-tenant or plugin architectures, you might load custom permissions from a database or remote config after app initialization.

Use `.getPolicies()` and `.setPolicies()`:

```typescript
// Snapshot existing policies
const currentPolicies = ac.getPolicies();

// Update policies dynamically (e.g. after fetching tenant configuration)
ac.setPolicies({
  ...currentPolicies,
  custom_role: ['reports:export', 'analytics:view'],
});
```
