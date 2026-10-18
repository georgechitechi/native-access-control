# Server & API Adapters

`native-access-control/adapters` provides middleware and guard wrappers for modern backend and fullstack frameworks with **zero runtime dependencies**.

---

## 1. Next.js Server Actions & Route Handlers

Protect Next.js App Router mutations and API endpoints with automatic 403 `AccessDeniedError` handling.

### A. Protecting Server Actions (`protectAction`)

Guarantees that an action only executes if the caller satisfies permissions:

```typescript
'use server';
import { protectAction } from 'native-access-control/adapters';
import { evaluator } from '@/lib/access';

// Action: 'delete', Resource: 'posts' (or 'posts:delete')
export const deletePostAction = protectAction(
  evaluator,
  'posts:delete',
  async (postId: string) => {
    // Only runs if authorized
    await db.post.delete({ where: { id: postId } });
    return { success: true };
  }
);
```

### B. Protecting App Router Route Handlers (`protectRouteHandler`)

```typescript
// app/api/documents/[id]/route.ts
import { NextResponse } from 'next/server';
import { protectRouteHandler } from 'native-access-control/adapters';
import { getEvaluatorForUser } from '@/lib/access';

export const DELETE = protectRouteHandler(
  (req) => getEvaluatorForUser(req),
  'documents:delete',
  async (req, { params }) => {
    await db.document.delete({ where: { id: params.id } });
    return NextResponse.json({ deleted: true });
  }
);
```

---

## 2. Express & Connect Middleware

### `expressGuard()`

Standard `(req, res, next)` middleware that automatically returns HTTP 403 JSON responses when access is denied:

```typescript
import express from 'express';
import { expressGuard } from 'native-access-control/adapters';
import { evaluator } from './access';

const app = express();

// Protect a single route (supports 'posts:create' or ('create', 'posts'))
app.post(
  '/api/posts',
  expressGuard(evaluator, 'posts:create'),
  async (req, res) => {
    res.json({ message: 'Post created successfully' });
  }
);

// Dynamic evaluator per request (e.g. from req.user)
app.delete(
  '/api/posts/:id',
  expressGuard((req) => req.user.evaluator, 'posts:delete'),
  async (req, res) => {
    res.json({ message: 'Post deleted' });
  }
);
```

---

## 3. Hono (Cloudflare Workers, Bun, Node)

### `honoGuard()`

Zero-dependency middleware for modern edge runtimes:

```typescript
import { Hono } from 'hono';
import { honoGuard } from 'native-access-control/adapters';
import { evaluator } from './access';

const app = new Hono();

app.post(
  '/api/projects',
  honoGuard(evaluator, 'projects:create'),
  async (c) => {
    return c.json({ created: true });
  }
);
```

---

## 4. tRPC Procedure Middleware

### `createTrpcGuard()`

Attach typed procedure guards to any tRPC router:

```typescript
import { initTRPC } from '@trpc/server';
import { createTrpcGuard } from 'native-access-control/adapters';

const t = initTRPC.context<{ evaluator: any }>().create();

const requirePerm = (permission: string) =>
  t.middleware(createTrpcGuard((ctx) => ctx.evaluator, permission));

export const protectedProcedure = t.procedure;
export const adminProcedure = protectedProcedure.use(requirePerm('admin:access'));

export const appRouter = t.router({
  listUsers: adminProcedure.query(async () => {
    return db.users.findMany();
  }),
});
```
