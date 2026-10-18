import type { ScopeFilterOptions } from '../scoping';
import { buildScopeFilter } from '../scoping';

/**
 * Returns a typed where clause filter object for Prisma queries.
 */
export function toPrismaWhere<T = Record<string, any>>(options: ScopeFilterOptions): T {
  return buildScopeFilter(options) as T;
}

export interface PrismaScopeExtensionConfig extends ScopeFilterOptions {
  /**
   * List of model names to apply scoping to (e.g. ['Post', 'Document']).
   * If omitted, applies to all models.
   */
  models?: string[];
}

/**
 * Creates a Prisma Client extension definition that automatically merges
 * partition scope and user ownership into query where clauses.
 */
export function createPrismaScopeExtension(config: PrismaScopeExtensionConfig) {
  const whereFilter = toPrismaWhere(config);

  return {
    name: 'native-access-control-scope',
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model: string;
          operation: string;
          args: any;
          query: (args: any) => Promise<any>;
        }) {
          if (config.models && !config.models.includes(model)) {
            return query(args);
          }

          const scopedOperations = [
            'findUnique',
            'findFirst',
            'findMany',
            'update',
            'updateMany',
            'delete',
            'deleteMany',
            'count',
            'aggregate',
          ];

          if (scopedOperations.includes(operation)) {
            args = args || {};
            args.where = {
              ...(args.where || {}),
              ...whereFilter,
            };
          }

          return query(args);
        },
      },
    },
  };
}
