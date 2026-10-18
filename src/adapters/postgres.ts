import type { ScopeFilterOptions } from '../scoping';

export interface PostgresWhereOptions extends ScopeFilterOptions {
  /**
   * The starting index for parameterized placeholders (default: 1 for $1, $2, etc.).
   */
  startIndex?: number;
}

export interface PostgresWhereResult {
  /**
   * The parameterized condition string (e.g. "business_id = $1 AND user_id = $2"), or "" if empty.
   */
  where: string;

  /**
   * Complete clause with "WHERE" prefix (e.g. "WHERE business_id = $1 AND user_id = $2"), or "" if empty.
   */
  clause: string;

  /**
   * Values array corresponding to parameterized placeholders.
   */
  params: any[];

  /**
   * The next parameter index for chaining additional filters.
   */
  nextIndex: number;
}

/**
 * Generates parameterized PostgreSQL WHERE clause and parameter array to prevent SQL injection.
 * Compatible with `pg`, `postgres.js`, `porsager`, or any PostgreSQL client.
 *
 * @example
 * const { clause, params } = toPostgresWhere({
 *   scopeId: activeWorkspaceId,
 *   scopeKey: 'workspace_id',
 *   userId: currentUserId,
 *   userKey: 'author_id',
 *   isRestrictedRole: !isAdmin,
 *   startIndex: 1,
 * });
 *
 * // Result:
 * // clause: "WHERE workspace_id = $1 AND author_id = $2"
 * // params: ['ws_123', 'usr_456']
 *
 * const res = await db.query(`SELECT * FROM documents ${clause}`, params);
 */
export function toPostgresWhere(options: PostgresWhereOptions): PostgresWhereResult {
  const { startIndex = 1 } = options;
  const conditions: string[] = [];
  const params: any[] = [];
  let currentIndex = startIndex;

  if (options.scopeId !== undefined && options.scopeId !== null) {
    const col = options.scopeKey || 'scopeId';
    conditions.push(`${col} = $${currentIndex++}`);
    params.push(options.scopeId);
  }

  if (options.isRestrictedRole && options.userId !== undefined && options.userId !== null) {
    const col = options.userKey || 'userId';
    conditions.push(`${col} = $${currentIndex++}`);
    params.push(options.userId);
  }

  const where = conditions.join(' AND ');
  const clause = where ? `WHERE ${where}` : '';

  return {
    where,
    clause,
    params,
    nextIndex: currentIndex,
  };
}

export interface RlsPolicyOptions {
  table: string;
  policyName?: string;
  scopeKey?: string;
  userKey?: string;
  scopeJwtPath?: string;
  bypassRoles?: string[];
  action?: 'ALL' | 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
}

/**
 * Generates standard PostgreSQL Row-Level Security (RLS) SQL statements for Supabase / PostgreSQL.
 *
 * @example
 * const sql = generateRlsPolicy({
 *   table: 'contracts',
 *   scopeKey: 'business_id',
 *   userKey: 'user_id',
 * });
 */
export function generateRlsPolicy(options: RlsPolicyOptions): string {
  const {
    table,
    policyName = `${table}_access_policy`,
    scopeKey = 'business_id',
    userKey = 'user_id',
    scopeJwtPath = "(auth.jwt() -> 'app_metadata' ->> 'business_id')",
    bypassRoles = ['admin', 'owner'],
    action = 'ALL',
  } = options;

  const bypassClause = bypassRoles
    .map(role => `(auth.jwt() -> 'app_metadata' ->> 'role') = '${role}'`)
    .join(' OR ');

  return [
    `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`,
    `DROP POLICY IF EXISTS "${policyName}" ON "${table}";`,
    `CREATE POLICY "${policyName}" ON "${table}"`,
    `FOR ${action}`,
    `USING (`,
    `  ${scopeKey}::text = ${scopeJwtPath}::text`,
    `  AND (`,
    `    ${bypassClause}`,
    `    OR ${userKey} = auth.uid()`,
    `  )`,
    `);`,
  ].join('\n');
}
