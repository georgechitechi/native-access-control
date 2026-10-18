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
