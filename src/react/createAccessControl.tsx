import React, { useMemo } from 'react';
import { createAccessEngine } from '../engine';
import { scopeRecords as baseScopeRecords, type ScopeRecordsOptions } from '../scoping';
import type { AccessControlConfig } from '../types';
import { Can, type CanProps } from './Can';
import { Cannot, type CannotProps } from './Cannot';
import {
  AccessControlContext,
  type AccessContextValue,
  useAccess as useBaseAccess,
} from './context';
import { Protect, type ProtectProps } from './Protect';

export interface TypedAccessProviderProps<TRole extends string = string, TContext = any> {
  children: React.ReactNode;
  roles?: TRole[];
  isSuperUser?: boolean;
  loading?: boolean;
}

export interface RoleGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function createAccessControl<
  TRole extends string = string,
  TResource extends string = string,
  TAction extends string = string,
  TContext = any
>(config: AccessControlConfig<TRole, TResource, TAction, TContext>) {
  const engine = createAccessEngine<TRole, TResource, TAction, TContext>(config);

  function TypedAccessProvider({
    children,
    roles = [],
    isSuperUser = false,
    loading = false,
  }: TypedAccessProviderProps<TRole, TContext>) {
    const evaluator = useMemo(() => {
      return engine.buildEvaluator(roles, isSuperUser);
    }, [roles, isSuperUser]);

    const value: AccessContextValue<TRole, TResource, TAction, TContext> = useMemo(() => {
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

  function useTypedAccess() {
    return useBaseAccess<TRole, TResource, TAction, TContext>();
  }

  function TypedCan(props: CanProps<TRole, TResource, TAction, TContext>) {
    return <Can<TRole, TResource, TAction, TContext> {...props} />;
  }

  function TypedCannot(props: CannotProps<TRole, TResource, TAction, TContext>) {
    return <Cannot<TRole, TResource, TAction, TContext> {...props} />;
  }

  function TypedProtect(props: ProtectProps<TRole, TResource, TAction, TContext>) {
    const fallback = props.fallback !== undefined ? props.fallback : config.defaultFallback;
    return <Protect<TRole, TResource, TAction, TContext> {...props} fallback={fallback} />;
  }

  function createRoleGuard(
    allowedRoles: TRole | TRole[] | string,
    guardDefaultFallback?: React.ReactNode
  ) {
    const fallbackToUse =
      guardDefaultFallback !== undefined ? guardDefaultFallback : (config.defaultFallback ?? null);

    return function CustomRoleGuard({ children, fallback = fallbackToUse }: RoleGuardProps) {
      const { hasRole, loading } = useTypedAccess();
      if (loading) return null;
      return (hasRole(allowedRoles as any) ? children : fallback) as React.ReactElement | null;
    };
  }

  return {
    engine,
    AccessProvider: TypedAccessProvider,
    useAccess: useTypedAccess,
    Can: TypedCan,
    Cannot: TypedCannot,
    Protect: TypedProtect,
    createRoleGuard,
    scopeRecords: baseScopeRecords,
  };
}
