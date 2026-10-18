export interface ScopeRecordsOptions<TRecord> {
  /**
   * Boundary / Group identifier to isolate records (e.g. organization, business, workspace, project).
   */
  scopeId?: any;
  scopeKey?: keyof TRecord;

  /**
   * User / Owner identifier for ownership checks.
   */
  userId?: any;
  userKey?: keyof TRecord;

  /**
   * If true (or function returns true), user ownership restrictions are applied.
   * If false, privileged users see all records within the scope.
   */
  isRestrictedRole?: boolean | ((roles?: string[]) => boolean);
  roles?: string[];

  /**
   * Optional custom predicate function for dynamic attribute filtering.
   */
  predicate?: (record: TRecord) => boolean;

  /**
   * If user ID is missing when restricted, returns empty array if true.
   * Default: true.
   */
  fallbackToEmpty?: boolean;
}

/**
 * Filters an array of records by scope/partition and user ownership.
 */
export function scopeRecords<TRecord>(
  records: TRecord[],
  options: ScopeRecordsOptions<TRecord>
): TRecord[] {
  if (!Array.isArray(records) || records.length === 0) return [];

  const {
    scopeId,
    scopeKey = 'scopeId' as keyof TRecord,
    userId,
    userKey = 'userId' as keyof TRecord,
    isRestrictedRole = false,
    roles = [],
    predicate,
    fallbackToEmpty = true,
  } = options;

  const restricted =
    typeof isRestrictedRole === 'function' ? isRestrictedRole(roles) : Boolean(isRestrictedRole);

  return records.filter(record => {
    // 1. Scope partition check (when scopeId is provided)
    if (scopeId !== undefined && scopeId !== null) {
      if ((record as any)[scopeKey] !== scopeId) return false;
    }

    // 2. Custom predicate check
    if (predicate && !predicate(record)) return false;

    // 3. Ownership match (applied only when restricted)
    if (restricted) {
      if (userId === undefined || userId === null) return !fallbackToEmpty;
      return (record as any)[userKey] === userId;
    }

    return true;
  });
}

export interface ScopeFilterOptions {
  scopeId?: any;
  scopeKey?: string;
  userId?: any;
  userKey?: string;
  isRestrictedRole?: boolean;
}

/**
 * Builds a database query WHERE filter object (compatible with Prisma, Supabase, Drizzle, Mongo)
 * applying scope isolation and ownership filtering.
 */
export function buildScopeFilter(options: ScopeFilterOptions): Record<string, any> {
  const filter: Record<string, any> = {};

  if (options.scopeId !== undefined && options.scopeId !== null) {
    filter[options.scopeKey || 'scopeId'] = options.scopeId;
  }

  if (options.isRestrictedRole && options.userId !== undefined && options.userId !== null) {
    filter[options.userKey || 'userId'] = options.userId;
  }

  return filter;
}

export interface FilterRecordOptions<TRecord extends Record<string, any>> {
  allowedFields?: (keyof TRecord)[] | '*';
  omitFields?: (keyof TRecord)[];
}

/**
 * Masks or projects allowed fields on a record to prevent leaking sensitive attributes.
 */
export function filterRecord<TRecord extends Record<string, any>>(
  record: TRecord,
  options: FilterRecordOptions<TRecord>
): Partial<TRecord> {
  const { allowedFields = '*', omitFields = [] } = options;
  const result: Partial<TRecord> = {};
  const omitSet = new Set(omitFields as string[]);
  const allowedSet = allowedFields === '*' ? null : new Set(allowedFields as string[]);

  for (const [key, value] of Object.entries(record)) {
    if (omitSet.has(key)) continue;
    if (allowedSet === null || allowedSet.has(key)) {
      (result as any)[key] = value;
    }
  }

  return result;
}
