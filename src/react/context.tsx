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
  evaluator: AccessEvaluator<TRole, any, any, TContext>;
  loading?: boolean;
  isSuperUser?: boolean;
}

export function AccessProvider<
  TRole extends string = string,
  TResource extends string = string,
  TAction extends string = string,
  TContext = any
>({
  children,
  evaluator,
  loading = false,
  isSuperUser = false,
}: AccessProviderProps<TRole, TContext>) {
  const value = useMemo<AccessContextValue<TRole, TResource, TAction, TContext>>(() => {
    return {
      ...evaluator,
      loading,
      isSuperUser,
    };
  }, [evaluator, loading, isSuperUser]);

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
    throw new Error('useAccess must be used within an AccessProvider');
  }
  return ctx;
}
