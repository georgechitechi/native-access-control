import React from 'react';
import { useAccess } from './context';
import { evaluateGuardProps, type GuardCriteriaProps } from './guard';

export interface CanProps<
  TRole extends string = string,
  TResource extends string = string,
  TAction extends string = string,
  TContext = any
> extends GuardCriteriaProps<TRole, TResource, TAction, TContext> {
  children?: React.ReactNode | ((allowed: boolean) => React.ReactNode);
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

  const isAllowed = evaluateGuardProps(
    { condition, action, resource, roles, context },
    { can, hasRole }
  );

  const finalAllowed = not ? !isAllowed : isAllowed;

  if (typeof children === 'function') {
    return children(finalAllowed) as React.ReactElement | null;
  }

  return (finalAllowed ? children : fallback) as React.ReactElement | null;
}
