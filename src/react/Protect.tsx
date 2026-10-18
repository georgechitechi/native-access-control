import React from 'react';
import { useAccess } from './context';

export interface ProtectProps<
  TRole extends string = string,
  TResource extends string = string,
  TAction extends string = string,
  TContext = any
> {
  children: React.ReactNode;
  action?: TAction | string;
  resource?: TResource | string;
  roles?: TRole | TRole[] | string;
  condition?: boolean;
  context?: TContext;
  fallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
}

/**
 * Screen, route, and layout guard that protects views based on roles or capabilities.
 */
export function Protect<
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
  fallback = null,
  loadingFallback = null,
}: ProtectProps<TRole, TResource, TAction, TContext>) {
  const { can, hasRole, loading } = useAccess<TRole, TResource, TAction, TContext>();

  if (loading) {
    return loadingFallback as React.ReactElement | null;
  }

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

  return (isAllowed ? children : fallback) as React.ReactElement | null;
}
