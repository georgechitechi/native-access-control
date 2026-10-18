export interface ScopeRecordsOptions<TRecord, TUserId = any, TTenantId = any> {
  userId?: TUserId | null;
  userKey?: keyof TRecord | (keyof TRecord)[];
  tenantId?: TTenantId | null;
  tenantKey?: keyof TRecord | (keyof TRecord)[];
  isRestrictedRole?: boolean | ((roles?: string[]) => boolean);
  roles?: string[];
  predicate?: (record: TRecord) => boolean;
  fallbackToEmpty?: boolean;
}

/**
 * Filter records for restricted roles so they only see their permitted records
 * (e.g. by ownership or tenant), while privileged roles see all records.
 */
export function scopeRecords<TRecord, TUserId = any, TTenantId = any>(
  records: TRecord[],
  options: ScopeRecordsOptions<TRecord, TUserId, TTenantId>
): TRecord[] {
  if (!Array.isArray(records) || records.length === 0) return [];

  const {
    userId,
    userKey,
    tenantId,
    tenantKey,
    isRestrictedRole = false,
    roles = [],
    predicate,
    fallbackToEmpty = true,
  } = options;

  const restricted =
    typeof isRestrictedRole === 'function' ? isRestrictedRole(roles) : Boolean(isRestrictedRole);

  const tenantKeys = tenantKey
    ? (Array.isArray(tenantKey) ? tenantKey : [tenantKey])
    : (['tenantId', 'tenant_id', 'orgId', 'organization_id'] as (keyof TRecord)[]);

  const userKeys = userKey
    ? (Array.isArray(userKey) ? userKey : [userKey])
    : (['userId', 'user_id', 'ownerId', 'owner_id', 'authorId', 'author_id'] as (keyof TRecord)[]);

  return records.filter(record => {
    // 1. Tenant match (if tenantId is provided)
    if (tenantId !== undefined && tenantId !== null) {
      const matchesTenant = tenantKeys.some(k => (record as any)[k] === tenantId);
      if (!matchesTenant) return false;
    }

    // 2. Custom predicate
    if (predicate && !predicate(record)) return false;

    // 3. Ownership match (only if restricted)
    if (restricted) {
      if (userId === undefined || userId === null) return !fallbackToEmpty;
      return userKeys.some(k => (record as any)[k] === userId);
    }

    return true;
  });
}

export interface ScopeFilterOptions<TUserId = any, TTenantId = any> {
  tenantId?: TTenantId | null;
  tenantKey?: string;
  userId?: TUserId | null;
  userKey?: string;
  isRestrictedRole?: boolean;
}

/**
 * Builds a database query WHERE object (compatible with Supabase, Prisma, Drizzle, Mongo)
 * applying tenant isolation and ownership filtering.
 */
export function buildScopeFilter<TUserId = any, TTenantId = any>(
  options: ScopeFilterOptions<TUserId, TTenantId>
): Record<string, any> {
  const filter: Record<string, any> = {};

  if (options.tenantId !== undefined && options.tenantId !== null) {
    filter[options.tenantKey || 'tenantId'] = options.tenantId;
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
