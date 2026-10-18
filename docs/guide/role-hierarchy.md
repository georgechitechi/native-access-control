# Role Hierarchy & Inheritance

Role hierarchies allow higher-privilege roles to inherit permissions from subordinate roles without duplicating policy definitions.

---

## Defining a Hierarchy

Pass a `hierarchy` map to `createAccessEvaluator` or `createAccessControl`:

```typescript
import { createAccessEvaluator } from 'native-access-control';

const ac = createAccessEvaluator({
  roles: ['owner', 'admin', 'editor', 'viewer'],
  hierarchy: {
    owner: ['admin'],
    admin: ['editor'],
    editor: ['viewer'],
  },
  policies: {
    viewer: ['project:read'],
    editor: ['project:update'],
    admin: ['project:delete', 'members:invite'],
    owner: ['billing:*'],
  },
});
```

### Inheritance Tree

```
  owner
    └── admin
          └── editor
                └── viewer
```

With this hierarchy:
- An **`owner`** has access to `billing:*`, `project:delete`, `members:invite`, `project:update`, and `project:read`.
- An **`admin`** inherits from `editor` and `viewer`.
- An **`editor`** inherits from `viewer`.

```typescript
ac.can(['owner'], 'project:read');  // true (inherited through admin -> editor -> viewer)
ac.can(['editor'], 'project:read'); // true (inherited from viewer)
ac.can(['viewer'], 'project:update'); // false
```

---

## Multiple Inheritance

Roles can inherit from more than one child role:

```typescript
const ac = createAccessEvaluator({
  hierarchy: {
    lead_dev: ['developer', 'reviewer'],
    developer: ['code:write'],
    reviewer: ['pull_request:merge'],
  },
});

ac.can(['lead_dev'], 'code:write');          // true
ac.can(['lead_dev'], 'pull_request:merge');  // true
```

---

## Checking Roles with `hasRole`

`ac.hasRole` checks if an active role set includes a target role, including through inheritance:

```typescript
// Does an 'owner' have the privileges of an 'editor'?
ac.hasRole(['owner'], 'editor'); // true

// Does a 'viewer' have the privileges of an 'admin'?
ac.hasRole(['viewer'], 'admin'); // false
```

---

## Cycle Protection

`native-access-control` includes built-in cycle detection with an active traversal set. If a circular reference exists in the hierarchy (e.g. `A -> B -> A`), the engine will safely evaluate permissions without infinite recursion or stack overflows.
