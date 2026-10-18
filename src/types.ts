export type WildcardPermission = '*';
export type ResourceWildcard<TResource extends string> = `${TResource}:*`;
export type ActionWildcard<TAction extends string> = `*:${TAction}`;
export type SpecificPermission<TResource extends string, TAction extends string> = `${TResource}:${TAction}`;

export type Permission<TResource extends string = string, TAction extends string = string> =
  | WildcardPermission
  | ResourceWildcard<TResource>
  | ActionWildcard<TAction>
  | SpecificPermission<TResource, TAction>
  | string;

export type AttributeRule<TContext = any> = (context: TContext) => boolean;

export interface RuleObject<
  TResource extends string = string,
  TAction extends string = string,
  TContext = any
> {
  action: TAction | TAction[] | string;
  resource: TResource | TResource[] | string;
  condition?: AttributeRule<TContext>;
  effect?: 'allow' | 'deny';
  description?: string;
}

export type RoleRule<
  TResource extends string = string,
  TAction extends string = string,
  TContext = any
> =
  | Permission<TResource, TAction>
  | RuleObject<TResource, TAction, TContext>
  | AttributeRule<TContext>;

export type RoleHierarchy<TRole extends string = string> = Partial<Record<TRole, string[]>>;

export type Policies<
  TRole extends string = string,
  TResource extends string = string,
  TAction extends string = string,
  TContext = any
> = Partial<Record<TRole, RoleRule<TResource, TAction, TContext>[]>>;

export interface AccessControlConfig<
  TRole extends string = string,
  TResource extends string = string,
  TAction extends string = string,
  TContext = any
> {
  policies: Policies<TRole, TResource, TAction, TContext>;
  roleHierarchy?: RoleHierarchy<TRole>;
  superRoles?: string[];
  normalizeRole?: (role: string) => string;
}

export interface AccessEvaluator<
  TRole extends string = string,
  TResource extends string = string,
  TAction extends string = string,
  TContext = any
> {
  can: (action: TAction | string, resource: TResource | string, context?: TContext) => boolean;
  cannot: (action: TAction | string, resource: TResource | string, context?: TContext) => boolean;
  canAll: (checks: Array<{ action: TAction | string; resource: TResource | string }>, context?: TContext) => boolean;
  canAny: (checks: Array<{ action: TAction | string; resource: TResource | string }>, context?: TContext) => boolean;
  hasRole: (role: TRole | TRole[] | string) => boolean;
  hasAllRoles: (roles: (TRole | string)[]) => boolean;
  hasAnyRole: (roles: (TRole | string)[]) => boolean;
  roles: TRole[];
  effectiveRoles: TRole[];
}
