import { assertCan } from '../assertions';
import { parsePermission } from './shared';

export interface NextActionContext {
  [key: string]: any;
}

/**
 * Wraps a Next.js Server Action with an authorization check.
 * Throws AccessDeniedError (HTTP 403) if unauthorized before executing the action.
 */
export function protectAction<TArgs extends any[], TReturn>(
  evaluatorOrGetter:
    | { can: (action: string, resource: string, context?: any) => boolean }
    | ((...args: TArgs) => { can: (action: string, resource: string, context?: any) => boolean }),
  actionOrPermission: string,
  resourceOrActionFn: string | ((...args: TArgs) => Promise<TReturn>),
  actionFnOrContext?:
    | ((...args: TArgs) => Promise<TReturn>)
    | ((...args: TArgs) => Promise<NextActionContext> | NextActionContext),
  getContextFn?: (...args: TArgs) => Promise<NextActionContext> | NextActionContext
): (...args: TArgs) => Promise<TReturn> {
  const { action, resource } = parsePermission(
    actionOrPermission,
    typeof resourceOrActionFn === 'string' ? resourceOrActionFn : undefined
  );
  const actionFn: (...args: TArgs) => Promise<TReturn> =
    typeof resourceOrActionFn === 'function' ? resourceOrActionFn : (actionFnOrContext as any);
  const getContext: ((...args: TArgs) => Promise<NextActionContext> | NextActionContext) | undefined =
    typeof resourceOrActionFn === 'function' ? (actionFnOrContext as any) : getContextFn;

  if (typeof actionFn !== 'function') {
    throw new Error('protectAction requires an action handler function.');
  }

  return async (...args: TArgs): Promise<TReturn> => {
    const evaluator =
      typeof evaluatorOrGetter === 'function' ? evaluatorOrGetter(...args) : evaluatorOrGetter;
    const ctx = getContext ? await getContext(...args) : {};

    assertCan(evaluator, action, resource, ctx);

    return actionFn(...args);
  };
}

/**
 * Wraps Next.js App Router API route handlers (GET, POST, etc.) with permission enforcement.
 */
export function protectRouteHandler<TRequest = any, TResponse = any>(
  getEvaluator: (req: TRequest) => { can: (action: string, resource: string, context?: any) => boolean },
  actionOrPermission: string,
  resourceOrHandler: string | ((req: TRequest, context?: any) => Promise<TResponse>),
  handlerOrUndefined?: (req: TRequest, context?: any) => Promise<TResponse>
): (req: TRequest, context?: any) => Promise<TResponse> {
  const { action, resource } = parsePermission(
    actionOrPermission,
    typeof resourceOrHandler === 'string' ? resourceOrHandler : undefined
  );
  const handler: (req: TRequest, context?: any) => Promise<TResponse> =
    typeof resourceOrHandler === 'function' ? resourceOrHandler : handlerOrUndefined!;

  if (typeof handler !== 'function') {
    throw new Error('protectRouteHandler requires a route handler function.');
  }

  return async (req: TRequest, context?: any): Promise<TResponse> => {
    const evaluator = getEvaluator(req);
    assertCan(evaluator, action, resource, { req, context });
    return handler(req, context);
  };
}
