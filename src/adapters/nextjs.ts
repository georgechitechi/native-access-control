import { assertCan } from '../assertions';

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
  let action: string;
  let resource: string;
  let actionFn: (...args: TArgs) => Promise<TReturn>;
  let getContext: ((...args: TArgs) => Promise<NextActionContext> | NextActionContext) | undefined;

  if (typeof resourceOrActionFn === 'function') {
    if (actionOrPermission.includes(':')) {
      const [r, a] = actionOrPermission.split(':');
      resource = r;
      action = a;
    } else {
      action = actionOrPermission;
      resource = '*';
    }
    actionFn = resourceOrActionFn;
    getContext = actionFnOrContext as any;
  } else {
    action = actionOrPermission;
    resource = resourceOrActionFn;
    actionFn = actionFnOrContext as any;
    getContext = getContextFn;
  }

  return async (...args: TArgs): Promise<TReturn> => {
    const ctx = getContext ? await getContext(...args) : {};
    const evaluator =
      typeof evaluatorOrGetter === 'function' ? evaluatorOrGetter(...args) : evaluatorOrGetter;

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
  let action: string;
  let resource: string;
  let handler: (req: TRequest, context?: any) => Promise<TResponse>;

  if (typeof resourceOrHandler === 'function') {
    if (actionOrPermission.includes(':')) {
      const [r, a] = actionOrPermission.split(':');
      resource = r;
      action = a;
    } else {
      action = actionOrPermission;
      resource = '*';
    }
    handler = resourceOrHandler;
  } else {
    action = actionOrPermission;
    resource = resourceOrHandler;
    handler = handlerOrUndefined!;
  }

  return async (req: TRequest, context?: any): Promise<TResponse> => {
    const evaluator = getEvaluator(req);
    assertCan(evaluator, action, resource, { req, context });
    return handler(req, context);
  };
}
