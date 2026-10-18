# native-access-control

> Zero-overhead, type-safe Role & Attribute-Based Access Control (RBAC + ABAC) for React, React Native, Node.js, and TypeScript.

[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](#)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## Why native-access-control?

Access control in modern applications is often either too simplistic (basic boolean role checks) or excessively bloated with massive dependencies and complex setup.

**`native-access-control`** is engineered to be:

- ⚡ **Zero Runtime Dependencies** — Lightweight, pure TypeScript. No bloated graph engines or heavy libraries.
- 🎯 **Universal Architecture** — Works consistently on the backend (Node.js, Express, Fastify, Next.js API, NestJS), frontend (React, Next.js), and mobile (React Native, Expo).
- 🔐 **RBAC & ABAC Combined** — Roles, permissions (`posts:read`, `users:*`), wildcards, explicit denies, and dynamic context-aware attribute conditions.
- 🌳 **Transitive Role Inheritance** — Define `admin` inheriting from `editor` inheriting from `viewer`; permissions resolve automatically without circular reference bugs.
- 🛡️ **Partition & Ownership Scoping** — Built-in helpers to isolate tenant/organization/workspace data (`scopeId`) and user ownership (`userId`).
- 🔌 **Database Adapters** — Pre-built zero-overhead adapters for **PostgreSQL** (WHERE clauses, RLS SQL generator) and **Supabase** (query scoping and match objects).
- ⚛️ **First-Class React / React Native Bindings** — Declarative `<Can>`, `<Cannot>`, and `<Protect>` components, plus `useAccess()` hook with strict context guarantees.

---

## Installation

```bash
npm install native-access-control
```

Or with yarn / pnpm / bun:

```bash
pnpm add native-access-control
# or
bun add native-access-control
```

---

## 30-Second Overview

```typescript
import { createAccessEvaluator } from 'native-access-control';

// 1. Define roles and permissions
const ac = createAccessEvaluator({
  roles: ['admin', 'manager', 'member'],
  hierarchy: {
    admin: ['manager'],
    manager: ['member'],
  },
  policies: {
    member: ['documents:read'],
    manager: ['documents:create', 'documents:update'],
    admin: ['documents:delete', 'settings:*'],
  },
});

// 2. Evaluate permissions with role inheritance
ac.can(['manager'], 'documents:read'); // true (inherited from member)
ac.can(['member'], 'documents:delete'); // false
ac.can(['admin'], 'settings:billing');  // true (wildcard match)

// 3. Dynamic Attribute-Based Conditions (ABAC)
const acWithAbac = createAccessEvaluator({
  policies: {
    member: [
      {
        action: 'documents:update',
        // User can only update if they own the record or it's a draft
        condition: (ctx) => ctx.user?.id === ctx.record?.authorId || ctx.record?.status === 'draft',
      },
    ],
  },
});

acWithAbac.can(['member'], 'documents:update', {
  user: { id: 'usr_123' },
  record: { authorId: 'usr_123', status: 'published' },
}); // true
```

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│               native-access-control                    │
├──────────────────────────┬─────────────────────────────┤
│ Core Engine              │ Adapters & Integrations     │
│ • RBAC & ABAC Evaluator  │ • React / React Native      │
│ • Transitive Hierarchy   │ • PostgreSQL & Supabase     │
│ • Data Scoping & Masks   │ • Expo / Next.js Navigation │
│ • Assertions & Errors    │ • Zero Runtime Dependencies │
└──────────────────────────┴─────────────────────────────┘
```

Ready to explore? Continue with the [Quick Start Guide](guide/quick-start.md).
