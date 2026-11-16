import { assertCan, AccessDeniedError } from '../assertions';
import { formatAccessDeniedBody, resolveGuardArgs } from './shared';

export interface HonoGuardOptions {
  /**
   * Custom error message
   */
  errorMessage?: string;
  /**
   * Custom context extractor
   */
  getContext?: (c: any) => Record<string, any>;
}

/**
 * Hono middleware that verifies permission before continuing down the handler chain.
 */
export function honoGuard(
  evaluatorOrGetter:
    | { can: (action: string, resource: string, context?: any) => boolean }
    | ((c: any) => { can: (action: string, resource: string, context?: any) => boolean }),
  actionOrPermission: string,
  resourceOrOptions?: string | HonoGuardOptions,
  maybeOptions?: HonoGuardOptions
) {
  const { action, resource, options } = resolveGuardArgs<HonoGuardOptions>(
    actionOrPermission,
    resourceOrOptions,
    maybeOptions
  );

  return async (c: any, next: () => Promise<void>) => {
    try {
      const evaluator =
        typeof evaluatorOrGetter === 'function' ? evaluatorOrGetter(c) : evaluatorOrGetter;
      const context = options.getContext ? options.getContext(c) : { c };

      assertCan(evaluator, action, resource, context, options.errorMessage);

      await next();
    } catch (err) {
      if (err instanceof AccessDeniedError) {
        return c.json(formatAccessDeniedBody(err), err.statusCode);
      }
      throw err;
    }
  };
}
