import type { AccessDeniedError } from '../assertions';

export function parsePermission(
  actionOrPermission: string,
  explicitResource?: string
): { action: string; resource: string } {
  if (typeof explicitResource === 'string') {
    if (!actionOrPermission || !explicitResource) {
      throw new Error('Both action and resource must be non-empty strings.');
    }
    return { action: actionOrPermission, resource: explicitResource };
  }

  if (typeof actionOrPermission !== 'string' || !actionOrPermission) {
    throw new Error('Permission string must be a non-empty string.');
  }

  const colonIdx = actionOrPermission.indexOf(':');
  if (colonIdx !== -1) {
    const resource = actionOrPermission.slice(0, colonIdx);
    const action = actionOrPermission.slice(colonIdx + 1);
    if (!resource || !action) {
      throw new Error(`Invalid permission format: "${actionOrPermission}". Expected "resource:action".`);
    }
    return { action, resource };
  }

  return { action: actionOrPermission, resource: '*' };
}

export function resolveGuardArgs<TOptions extends Record<string, any>>(
  actionOrPermission: string,
  resourceOrOptions?: string | TOptions,
  maybeOptions?: TOptions
): { action: string; resource: string; options: TOptions } {
  const isExplicitResource = typeof resourceOrOptions === 'string';
  const { action, resource } = parsePermission(
    actionOrPermission,
    isExplicitResource ? resourceOrOptions : undefined
  );
  const options = ((isExplicitResource ? maybeOptions : resourceOrOptions) || {}) as TOptions;
  return { action, resource, options };
}

export function formatAccessDeniedBody(err: AccessDeniedError) {
  return {
    statusCode: err.statusCode,
    error: 'Forbidden',
    message: err.message,
    action: err.action,
    resource: err.resource,
  };
}
