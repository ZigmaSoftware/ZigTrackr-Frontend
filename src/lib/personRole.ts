export function personWithRole(name: string, role?: string | null): string {
  return role?.trim() ? `${name} (${role.trim().toLowerCase()})` : name;
}
