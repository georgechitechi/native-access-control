import { assertCan } from '../assertions';

export interface TrpcGuardOptions<TContext = any> {
  createError?: (message: string) => Error;
  getContext?: (ctx: TContext) => Record<string, any>;
}

/**
 * Creates a middleware function compatible with tRPC procedure chains.
 *
 * @example
 * ```ts
 * const requirePerm = (act: string, res: string) => t.middleware(createTrpcGuard(act, res, (ctx) => ctx.evaluator));
 * ```
 */
export function createTrpcGuard<TContext = any>(
  evaluatorOrGetter:
    | { can: (action: string, resource: string, context?: any) => boolean }
    | ((ctx: TContext) => { can: (action: string, resource: string, context?: any) => boolean }),
  actionOrPermission: string,
  resourceOrOptions?: string | TrpcGuardOptions<TContext>,
  maybeOptions?: TrpcGuardOptions<TContext>
) {
  let action: string;
  let resource: string;
  let options: TrpcGuardOptions<TContext> = {};

  if (typeof resourceOrOptions === 'string') {
    action = actionOrPermission;
    resource = resourceOrOptions;
    options = maybeOptions || {};
  } else {
    if (actionOrPermission.includes(':')) {
      const [r, a] = actionOrPermission.split(':');
      resource = r;
      action = a;
    } else {
      action = actionOrPermission;
      resource = '*';
    }
    options = (resourceOrOptions as TrpcGuardOptions<TContext>) || {};
  }

  return async ({ ctx, next }: { ctx: TContext; next: () => Promise<any> }) => {
    const evaluator =
      typeof evaluatorOrGetter === 'function' ? evaluatorOrGetter(ctx) : evaluatorOrGetter;
    const context = options.getContext ? options.getContext(ctx) : { ctx };

    try {
      assertCan(evaluator, action, resource, context);
    } catch (err: any) {
      if (options.createError) {
        throw options.createError(err.message);
      }
      throw err;
    }

    return next();
  };
}
