export interface GuardCriteriaProps<
  TRole extends string = string,
  TResource extends string = string,
  TAction extends string = string,
  TContext = any
> {
  action?: TAction | string;
  resource?: TResource | string;
  roles?: TRole | TRole[] | string;
  condition?: boolean;
  context?: TContext;
}

export function evaluateGuardProps<
  TRole extends string = string,
  TResource extends string = string,
  TAction extends string = string,
  TContext = any
>(
  props: GuardCriteriaProps<TRole, TResource, TAction, TContext>,
  evaluator: {
    can: (action: TAction | string, resource: TResource | string, context?: TContext) => boolean;
    hasRole: (role: TRole | TRole[] | string) => boolean;
  }
): boolean {
  const { condition, action, resource, roles, context } = props;

  if (condition !== undefined) {
    return Boolean(condition);
  }

  if (action !== undefined || resource !== undefined) {
    return Boolean(action && resource && evaluator.can(action, resource, context));
  }

  if (roles !== undefined) {
    return evaluator.hasRole(roles as any);
  }

  return false;
}
