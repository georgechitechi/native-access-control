import React, { createContext, useContext, useMemo } from 'react';
import type { AccessEvaluator } from '../types';

export interface AccessContextValue<
  TRole extends string = string,
  TResource extends string = string,
  TAction extends string = string,
  TContext = any
> extends AccessEvaluator<TRole, TResource, TAction, TContext> {
  loading: boolean;
  isSuperUser: boolean;
}

export const AccessControlContext = createContext<AccessContextValue<any, any, any, any> | null>(null);

export interface AccessProviderProps<TRole extends string = string, TContext = any> {
  children: React.ReactNode;
  roles?: TRole[];
  isSuperUser?: boolean;
  loading?: boolean;
  evaluator?: AccessEvaluator<TRole, any, any, TContext>;
}

export function AccessProvider<
  TRole extends string = string,
  TResource extends string = string,
  TAction extends string = string,
  TContext = any
>({
  children,
  roles = [],
  isSuperUser = false,
  loading = false,
  evaluator,
}: AccessProviderProps<TRole, TContext>) {
  const value = useMemo<AccessContextValue<TRole, TResource, TAction, TContext>>(() => {
    if (evaluator) {
      return {
        ...evaluator,
        loading,
        isSuperUser,
      };
    }

    return {
      can: () => isSuperUser,
      cannot: () => !isSuperUser,
      canAll: () => isSuperUser,
      canAny: () => isSuperUser,
      hasRole: (r: any) =>
        isSuperUser || (Array.isArray(r) ? r.some(x => roles.includes(x)) : roles.includes(r)),
      hasAllRoles: (r: any) => isSuperUser || r.every((x: any) => roles.includes(x)),
      hasAnyRole: (r: any) => isSuperUser || r.some((x: any) => roles.includes(x)),
      roles,
      effectiveRoles: roles,
      loading,
      isSuperUser,
    };
  }, [evaluator, roles, isSuperUser, loading]);

  return (
    <AccessControlContext.Provider value={value}>
      {children}
    </AccessControlContext.Provider>
  );
}

export function useAccess<
  TRole extends string = string,
  TResource extends string = string,
  TAction extends string = string,
  TContext = any
>(): AccessContextValue<TRole, TResource, TAction, TContext> {
  const ctx = useContext(AccessControlContext);
  if (!ctx) {
    return {
      can: () => false,
      cannot: () => true,
      canAll: () => false,
      canAny: () => false,
      hasRole: () => false,
      hasAllRoles: () => false,
      hasAnyRole: () => false,
      roles: [],
      effectiveRoles: [],
      loading: false,
      isSuperUser: false,
    };
  }
  return ctx;
}
