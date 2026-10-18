import type { ScopeFilterOptions } from '../scoping';

export interface DrizzleOperators<TResult = any> {
  eq: (column: any, value: any) => TResult;
  and: (...conditions: (TResult | undefined)[]) => TResult;
}

/**
 * Generates a Drizzle ORM where condition combining partition scope and optional user ownership.
 *
 * @param table - The Drizzle table object or column mapping
 * @param options - Scope and ownership options
 * @param operators - Drizzle's `eq` and `and` operators
 * @returns Combined Drizzle condition expression or undefined if no criteria
 */
export function toDrizzleWhere<TTable extends Record<string, any>, TResult = any>(
  table: TTable,
  options: ScopeFilterOptions,
  operators: DrizzleOperators<TResult>
): TResult | undefined {
  const scopeKey = (options.scopeKey || 'scopeId') as string;
  const userKey = (options.userKey || 'userId') as string;
  const isRestricted = options.isRestrictedRole ?? true;

  const conditions: (TResult | undefined)[] = [];

  if (options.scopeId !== undefined && options.scopeId !== null && table[scopeKey] !== undefined) {
    conditions.push(operators.eq(table[scopeKey], options.scopeId));
  }

  if (isRestricted && options.userId !== undefined && options.userId !== null && table[userKey] !== undefined) {
    conditions.push(operators.eq(table[userKey], options.userId));
  }

  const validConditions = conditions.filter((c): c is TResult => c !== undefined);

  if (validConditions.length === 0) {
    return undefined;
  }

  if (validConditions.length === 1) {
    return validConditions[0];
  }

  return operators.and(...validConditions);
}
