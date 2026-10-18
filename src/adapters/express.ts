import { assertCan, AccessDeniedError } from '../assertions';

export interface ExpressGuardOptions {
  /**
   * Custom error message
   */
  errorMessage?: string;
  /**
   * Build custom ABAC context from request
   */
  getContext?: (req: any) => Record<string, any>;
}

/**
 * Express / Connect middleware that verifies caller has required permission.
 * Returns 403 status code if access is denied.
 */
export function expressGuard(
  evaluatorOrOptions:
    | { can: (action: string, resource: string, context?: any) => boolean }
    | ((req: any) => { can: (action: string, resource: string, context?: any) => boolean }),
  actionOrPermission: string,
  resourceOrOptions?: string | ExpressGuardOptions,
  maybeOptions?: ExpressGuardOptions
) {
  let action: string;
  let resource: string;
  let options: ExpressGuardOptions = {};

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
    options = (resourceOrOptions as ExpressGuardOptions) || {};
  }

  return (req: any, res: any, next: (err?: any) => void) => {
    try {
      const evaluator =
        typeof evaluatorOrOptions === 'function' ? evaluatorOrOptions(req) : evaluatorOrOptions;
      const context = options.getContext ? options.getContext(req) : { req };

      assertCan(evaluator, action, resource, context, options.errorMessage);

      next();
    } catch (err) {
      if (err instanceof AccessDeniedError) {
        if (typeof res.status === 'function' && typeof res.json === 'function') {
          return res.status(403).json({
            statusCode: 403,
            error: 'Forbidden',
            message: err.message,
            action: err.action,
            resource: err.resource,
          });
        }
      }
      next(err);
    }
  };
}
