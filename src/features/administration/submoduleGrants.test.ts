import { describe, expect, it } from "vitest";
import type { PermissionMatrix, PermissionSubmodule } from "@/types";
import { setSubmodule, submoduleChanges, submoduleState, toGrants } from "./submoduleGrants";

const users: PermissionSubmodule = { key: "administration.user", name: "User Management", permissions: ["user.view", "user.edit", "user.delete"], protected_roles: [] };
const roles: PermissionSubmodule = { key: "administration.role", name: "Role Management", permissions: ["role.view", "role.edit"], protected_roles: ["ADMIN"] };
const matrix: PermissionMatrix = {
  roles: [{ id: "a", code: "ADMIN", name: "Admin", is_system: true }, { id: "m", code: "MANAGEMENT", name: "Management", is_system: true }],
  modules: [{ module: "administration", submodules: [users, roles], permissions: [
    { codename: "user.view", name: "View users", screen: "User Management", action: "view", roles: { ADMIN: true, MANAGEMENT: true } },
    { codename: "user.edit", name: "Edit users", screen: "User Management", action: "edit", roles: { ADMIN: true, MANAGEMENT: false } },
    { codename: "user.delete", name: "Delete users", screen: "User Management", action: "delete", roles: { ADMIN: true, MANAGEMENT: false } },
    { codename: "role.view", name: "View roles", screen: "Role Management", action: "view", roles: { ADMIN: true, MANAGEMENT: true } },
    { codename: "role.edit", name: "Edit roles", screen: "Role Management", action: "edit", roles: { ADMIN: true, MANAGEMENT: false } },
  ] }],
};

describe("submodule access bundles", () => {
  it("shows full, partial and absent access without changing existing grants", () => {
    const original = toGrants(matrix);
    expect(submoduleState(users, original, "ADMIN")).toEqual({ checked: true, mixed: false });
    expect(submoduleState(users, original, "MANAGEMENT")).toEqual({ checked: false, mixed: true });
    expect(submoduleState(users, original, "OTHER")).toEqual({ checked: false, mixed: false });
    expect(submoduleChanges(matrix, original, original, "MANAGEMENT")).toEqual([]);
  });
  it("grants every action while preserving other roles and unrelated partial groups", () => {
    const original = toGrants(matrix);
    const draft = setSubmodule(original, users, "MANAGEMENT", true);
    expect(submoduleState(users, draft, "MANAGEMENT")).toEqual({ checked: true, mixed: false });
    expect(submoduleState(roles, draft, "MANAGEMENT")).toEqual({ checked: false, mixed: true });
    expect(submoduleState(users, original, "MANAGEMENT").mixed).toBe(true);
    expect(submoduleChanges(matrix, original, draft, "MANAGEMENT")).toEqual([{ key: users.key, enabled: true }]);
    expect(submoduleChanges(matrix, original, draft, "ADMIN")).toEqual([]);
  });
  it("removes every action in a deselected submodule", () => {
    const original = toGrants(matrix);
    const draft = setSubmodule(original, users, "ADMIN", false);
    expect(submoduleState(users, draft, "ADMIN")).toEqual({ checked: false, mixed: false });
    expect(submoduleChanges(matrix, original, draft, "ADMIN")).toEqual([{ key: users.key, enabled: false }]);
  });
  it("does not mark changes dirty after returning to original grants", () => {
    const original = toGrants(matrix);
    const enabled = setSubmodule(setSubmodule(original, users, "ADMIN", false), users, "ADMIN", true);
    expect(submoduleChanges(matrix, original, enabled, "ADMIN")).toEqual([]);
  });
  it("never removes protected Admin access", () => {
    const original = toGrants(matrix);
    expect(setSubmodule(original, roles, "ADMIN", false)).toBe(original);
    expect(submoduleState(roles, original, "ADMIN").checked).toBe(true);
  });
  it("keeps shared ticket actions from linking independent draft checkboxes", () => {
    const services: PermissionSubmodule = { key: "ticket_management.services", name: "Service Requests", access_permission: "tickets.services.access", permissions: ["tickets.services.access", "tickets.ticket.view", "tickets.ticket.add_update"], protected_roles: [] };
    const bugs: PermissionSubmodule = { ...services, key: "ticket_management.bugs", name: "Bug Requests", access_permission: "tickets.bugs.access", permissions: ["tickets.bugs.access", "tickets.ticket.view", "tickets.ticket.add_update"] };
    const grants = { "tickets.services.access": { ADMIN: true }, "tickets.bugs.access": { ADMIN: false }, "tickets.ticket.view": { ADMIN: true }, "tickets.ticket.add_update": { ADMIN: true } };
    const draft = setSubmodule(grants, bugs, "ADMIN", true);
    expect(submoduleState(bugs, draft, "ADMIN").checked).toBe(true);
    expect(submoduleState(services, draft, "ADMIN").checked).toBe(true);
    expect(submoduleState(bugs, grants, "ADMIN")).toEqual({ checked: false, mixed: false });
    const disabled = setSubmodule(draft, services, "ADMIN", false);
    expect(submoduleState(bugs, disabled, "ADMIN").checked).toBe(true);
    expect(submoduleState(services, disabled, "ADMIN").checked).toBe(false);
    const fixture: PermissionMatrix = { ...matrix, modules: [{ module: "ticket_management", permissions: [], submodules: [services, bugs] }] };
    expect(submoduleChanges(fixture, grants, draft, "ADMIN")).toEqual([{ key: bugs.key, enabled: true }]);
  });
});
