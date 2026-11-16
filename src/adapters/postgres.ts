import type { ScopeFilterOptions } from '../scoping';
import { buildScopeFilter } from '../scoping';

const SQL_IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function assertSqlIdentifier(name: string, label: string): string {
  if (!SQL_IDENTIFIER_RE.test(name)) {
    throw new Error(`Invalid SQL identifier for ${label}: "${name}"`);
  }
  return name;
}

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
  const filter = buildScopeFilter(options);
  const conditions: string[] = [];
  const params: any[] = [];
  let currentIndex = startIndex;

  for (const [key, value] of Object.entries(filter)) {
    const col = assertSqlIdentifier(key, 'column');
    conditions.push(`${col} = $${currentIndex++}`);
    params.push(value);
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

  const safeTable = assertSqlIdentifier(table, 'table');
  const safePolicyName = assertSqlIdentifier(policyName, 'policyName');
  const safeScopeKey = assertSqlIdentifier(scopeKey, 'scopeKey');
  const safeUserKey = assertSqlIdentifier(userKey, 'userKey');

  const ownershipConditions = [
    ...bypassRoles.map(role => `(auth.jwt() -> 'app_metadata' ->> 'role') = '${role.replace(/'/g, "''")}'`),
    `${safeUserKey} = auth.uid()`,
  ];

  return [
    `ALTER TABLE "${safeTable}" ENABLE ROW LEVEL SECURITY;`,
    `DROP POLICY IF EXISTS "${safePolicyName}" ON "${safeTable}";`,
    `CREATE POLICY "${safePolicyName}" ON "${safeTable}"`,
    `FOR ${action}`,
    `USING (`,
    `  ${safeScopeKey}::text = ${scopeJwtPath}::text`,
    `  AND (`,
    `    ${ownershipConditions.join('\n    OR ')}`,
    `  )`,
    `);`,
  ].join('\n');
}
