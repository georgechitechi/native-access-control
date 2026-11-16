import React from 'react';
import { useAccess } from './context';
import { evaluateGuardProps, type GuardCriteriaProps } from './guard';

export interface ProtectProps<
  TRole extends string = string,
  TResource extends string = string,
  TAction extends string = string,
  TContext = any
> extends GuardCriteriaProps<TRole, TResource, TAction, TContext> {
  children: React.ReactNode;
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

  const isAllowed = evaluateGuardProps(
    { condition, action, resource, roles, context },
    { can, hasRole }
  );

  return (isAllowed ? children : fallback) as React.ReactElement | null;
}
