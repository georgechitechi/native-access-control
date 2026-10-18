import React from 'react';
import { useAccess } from './context';

export interface CanProps<
  TRole extends string = string,
  TResource extends string = string,
  TAction extends string = string,
  TContext = any
> {
  children?: React.ReactNode | ((allowed: boolean) => React.ReactNode);
  action?: TAction | string;
  resource?: TResource | string;
  roles?: TRole | TRole[] | string;
  condition?: boolean;
  context?: TContext;
  not?: boolean;
  fallback?: React.ReactNode;
}

/**
 * Declarative capability guard for inline UI elements.
 */
export function Can<
  TRole extends string = string,
  TResource extends string = string,
  TAction extends string = string,
  TContext = any
>({
  children,
  action,
  resource,
  roles,
  condition,
  context,
  not = false,
  fallback = null,
}: CanProps<TRole, TResource, TAction, TContext>) {
  const { can, hasRole, loading } = useAccess<TRole, TResource, TAction, TContext>();

  if (loading) return null;

  let isAllowed = false;

  if (condition !== undefined) {
    isAllowed = condition;
  } else if (action && resource) {
    isAllowed = can(action, resource, context);
  } else if (roles) {
    isAllowed = hasRole(roles as any);
  } else {
    isAllowed = true;
  }

  const finalAllowed = not ? !isAllowed : isAllowed;

  if (typeof children === 'function') {
    return children(finalAllowed) as React.ReactElement | null;
  }

  return (finalAllowed ? children : fallback) as React.ReactElement | null;
}
