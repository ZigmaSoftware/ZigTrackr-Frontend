import type { PermissionMatrix, PermissionSubmodule } from "@/types";

export type Grants = Record<string, Record<string, boolean>>;

export function toGrants(matrix?: PermissionMatrix): Grants {
  const grants: Grants = {};
  for (const module of matrix?.modules ?? []) {
    for (const permission of module.permissions) grants[permission.codename] = { ...permission.roles };
  }
  return grants;
}

export function submoduleState(submodule: PermissionSubmodule, grants: Grants, role: string) {
  // Draft choices stay independent when several screens share action codes.
  const override = grants[`@${submodule.key}`]?.[role];
  if (override !== undefined) return { checked: override, mixed: false };
  if (submodule.access_permission && !grants[submodule.access_permission]?.[role]) {
    return { checked: false, mixed: false };
  }
  const count = submodule.permissions.filter((code) => grants[code]?.[role]).length;
  return { checked: count > 0 && count === submodule.permissions.length, mixed: count > 0 && count < submodule.permissions.length };
}

export function setSubmodule(grants: Grants, submodule: PermissionSubmodule, role: string, enabled: boolean): Grants {
  if (submodule.protected_roles.includes(role) && !enabled) return grants;
  return { ...grants, [`@${submodule.key}`]: { ...grants[`@${submodule.key}`], [role]: enabled } };
}

export function submoduleChanged(submodule: PermissionSubmodule, original: Grants, draft: Grants, role: string) {
  const before = submoduleState(submodule, original, role);
  const after = submoduleState(submodule, draft, role);
  return before.checked !== after.checked || before.mixed !== after.mixed;
}

export function submoduleChanges(matrix: PermissionMatrix, original: Grants, draft: Grants, role: string) {
  return matrix.modules.flatMap((module) => module.submodules)
    .filter((submodule) => submoduleChanged(submodule, original, draft, role))
    .map((submodule) => ({ key: submodule.key, enabled: submoduleState(submodule, draft, role).checked }));
}
