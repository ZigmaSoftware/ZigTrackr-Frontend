import { describe, expect, it } from "vitest";
import { NAVIGATION, flattenNavigation } from "@/config/navigation";
import { MASTER_CONFIGS } from "@/features/masters/configs";
import { REPORT_CONFIGS } from "@/features/reports/configs";

/* Guards a failure the type system cannot catch: a sidebar entry whose path
   has no route registered. The link renders fine and then dumps the user on a
   404 -- which is exactly how /admin/users shipped broken.

   Routes are listed here as patterns rather than imported from AppRoutes,
   because the router's element tree cannot be introspected without rendering. */

const STATIC_ROUTES = [
  "/dashboard",
  "/chat",
  "/tickets/new",
  "/tickets/unassigned",
  "/tickets/reassign",
  "/tickets",
  "/tickets/bugs",
  "/tickets/services",
  "/tickets/access",
  "/tickets/critical",
  "/tickets/overdue",
  "/tickets/testing",
  "/tickets/closed",
  "/updates/today",
  "/admin/users",
  "/admin/roles",
  "/admin/permissions",
  "/admin/audit",
  "/profile",
];

/** Mirrors the router's dynamic segments. */
function isRoutable(path: string): boolean {
  if (STATIC_ROUTES.includes(path)) return true;
  const master = path.match(/^\/masters\/([^/]+)$/);
  if (master) return master[1] in MASTER_CONFIGS;
  const report = path.match(/^\/reports\/([^/]+)$/);
  if (report) return report[1] in REPORT_CONFIGS;
  return false;
}

describe("navigation", () => {
  it("every sidebar link resolves to a route", () => {
    const broken = flattenNavigation(NAVIGATION)
      .map((item) => item.to)
      .filter((to) => !isRoutable(to));
    expect(broken, `Sidebar links with no route: ${broken.join(", ")}`).toEqual([]);
  });

  it("every master menu entry has a config", () => {
    const masterLinks = flattenNavigation(NAVIGATION)
      .filter((item) => item.to.startsWith("/masters/"))
      .map((item) => item.to.replace("/masters/", ""));
    expect(masterLinks.length).toBeGreaterThan(0);
    for (const resource of masterLinks) {
      expect(MASTER_CONFIGS, `missing master config: ${resource}`)
        .toHaveProperty(resource);
    }
  });

  it("every report menu entry has a config", () => {
    const reportLinks = flattenNavigation(NAVIGATION)
      .filter((item) => item.to.startsWith("/reports/"))
      .map((item) => item.to.replace("/reports/", ""));
    expect(reportLinks.length).toBe(9);
    for (const name of reportLinks) {
      expect(REPORT_CONFIGS, `missing report config: ${name}`).toHaveProperty(name);
    }
  });

  it("does not expose duplicate Bug Management or Team Management menu groups", () => {
    const groups = NAVIGATION.flatMap((section) => section.groups.map((group) => group.label));
    expect(groups).not.toContain("Bug Management");
    expect(groups).not.toContain("Team Management");
  });

  it("sidebar paths are unique", () => {
    const paths = flattenNavigation(NAVIGATION).map((item) => item.to);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("badge keys are only used where the counts API provides them", () => {
    const validKeys = new Set([
      "assigned_to_me", "unassigned", "critical", "overdue",
      "testing", "update_pending", "reopened", "chat_unread",
    ]);
    const badges = flattenNavigation(NAVIGATION)
      .map((item) => item.badge)
      .filter(Boolean) as string[];
    for (const key of badges) {
      expect(validKeys, `unknown badge key: ${key}`).toContain(key);
    }
  });
});
