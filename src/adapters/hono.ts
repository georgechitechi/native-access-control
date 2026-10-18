import { assertCan, AccessDeniedError } from '../assertions';

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
  let action: string;
  let resource: string;
  let options: HonoGuardOptions = {};

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
    options = (resourceOrOptions as HonoGuardOptions) || {};
  }

  return async (c: any, next: () => Promise<void>) => {
    try {
      const evaluator =
        typeof evaluatorOrGetter === 'function' ? evaluatorOrGetter(c) : evaluatorOrGetter;
      const context = options.getContext ? options.getContext(c) : { c };

      assertCan(evaluator, action, resource, context, options.errorMessage);

      await next();
    } catch (err) {
      if (err instanceof AccessDeniedError) {
        return c.json(
          {
            statusCode: 403,
            error: 'Forbidden',
            message: err.message,
            action: err.action,
            resource: err.resource,
          },
          403
        );
      }
      throw err;
    }
  };
}
