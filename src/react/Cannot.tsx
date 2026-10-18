import React from 'react';
import { Can, type CanProps } from './Can';

export type CannotProps<
  TRole extends string = string,
  TResource extends string = string,
  TAction extends string = string,
  TContext = any
> = Omit<CanProps<TRole, TResource, TAction, TContext>, 'not'>;

/**
 * Declarative negative guard component. Renders children only when access is NOT granted.
 *
 * @example
 * <Cannot action="delete" resource="account">
 *   <UpgradeNotice />
 * </Cannot>
 */
export function Cannot<
  TRole extends string = string,
  TResource extends string = string,
  TAction extends string = string,
  TContext = any
>(props: CannotProps<TRole, TResource, TAction, TContext>) {
  return <Can<TRole, TResource, TAction, TContext> {...props} not={true} />;
}
