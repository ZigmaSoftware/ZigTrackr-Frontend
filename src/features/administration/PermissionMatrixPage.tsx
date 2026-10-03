import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { roleApi } from "@/api/services";
import { apiErrorMessage } from "@/api/client";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardBody, Button, Input, Select, Skeleton } from "@/components/ui/primitives";
import { ErrorState } from "@/components/feedback/states";
import type { PermissionMatrix } from "@/types";

type Grants = Record<string, Record<string, boolean>>;

function toGrants(matrix?: PermissionMatrix): Grants {
  const grants: Grants = {};
  for (const module of matrix?.modules ?? []) {
    for (const permission of module.permissions) {
      grants[permission.codename] = { ...permission.roles };
    }
  }
  return grants;
}

function rolePermissions(grants: Grants, roleCode: string) {
  return Object.entries(grants)
    .filter(([, roles]) => roles[roleCode])
    .map(([codename]) => codename);
}

export function PermissionMatrixPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["permission-matrix"],
    queryFn: roleApi.matrix,
  });
  const [draft, setDraft] = useState<Grants>({});
  const original = useMemo(() => toGrants(data), [data]);

  useEffect(() => setDraft(original), [original]);

  const dirtyRoles = useMemo(() => {
    if (!data) return [];
    return data.roles.filter((role) => {
      const before = rolePermissions(original, role.code).sort().join("|");
      const after = rolePermissions(draft, role.code).sort().join("|");
      return before !== after;
    });
  }, [data, draft, original]);

  const save = useMutation({
    mutationFn: async () => {
      if (!data) return data;
      let latest = data;
      for (const role of dirtyRoles) {
        latest = await roleApi.updatePermissions(role.id, rolePermissions(draft, role.code));
      }
      return latest;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["permission-matrix"] });
      await queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Permissions updated");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Unable to update permissions.")),
  });

  const modules = (data?.modules ?? []).filter((module) => {
    if (moduleFilter && module.module !== moduleFilter) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return module.permissions.some((permission) =>
      permission.name.toLowerCase().includes(q)
      || permission.codename.toLowerCase().includes(q)
      || permission.screen.toLowerCase().includes(q)
    );
  });
  const permissionCount = data?.modules.reduce((total, module) => total + module.permissions.length, 0) ?? 0;

  function toggle(codename: string, roleCode: string) {
    setDraft((current) => ({
      ...current,
      [codename]: {
        ...current[codename],
        [roleCode]: !current[codename]?.[roleCode],
      },
    }));
  }

  return (
    <>
      <PageHeader
        title="Permission Management"
        description="Edit role grants in a staged matrix. Backend validation enforces protected permissions."
        breadcrumbs={[{ label: "Administration" }, { label: "Permissions" }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setDraft(original)} disabled={dirtyRoles.length === 0 || save.isPending}>
              <RotateCcw /> Reset
            </Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={dirtyRoles.length === 0} loading={save.isPending}>
              <Save /> Save Changes
            </Button>
          </>
        }
      />

      {isError ? (
        <Card><ErrorState onRetry={() => refetch()} /></Card>
      ) : isLoading ? (
        <Card className="p-4"><Skeleton className="h-64" /></Card>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Card><CardBody><p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Roles</p><p className="mt-1 text-2xl font-semibold tabular-nums">{data?.roles.length ?? 0}</p></CardBody></Card>
            <Card><CardBody><p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Permission groups</p><p className="mt-1 text-2xl font-semibold tabular-nums">{data?.modules.length ?? 0}</p></CardBody></Card>
            <Card><CardBody><p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Available grants</p><p className="mt-1 text-2xl font-semibold tabular-nums">{permissionCount}</p></CardBody></Card>
          </div>
          <Card className="overflow-hidden">
          <div className="grid gap-3 border-b border-[var(--border)] p-3 md:grid-cols-[minmax(240px,1fr)_220px]">
            <Input
              type="search"
              placeholder="Search permission..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
              <option value="">All groups</option>
              {(data?.modules ?? []).map((module) => (
                <option key={module.module} value={module.module}>{module.module}</option>
              ))}
            </Select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <caption className="sr-only">Editable role and permission matrix</caption>
              <thead className="sticky top-0 border-b border-[var(--border)] bg-[var(--muted)]/50">
                <tr>
                  <th scope="col" className="ztable-head w-[340px]">Permission</th>
                  {(data?.roles ?? []).map((role) => (
                    <th key={role.code} scope="col" className="ztable-head text-center">
                      {role.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((module) => {
                  const rows = module.permissions.filter((permission) => {
                    if (!search.trim()) return true;
                    const q = search.trim().toLowerCase();
                    return permission.name.toLowerCase().includes(q)
                      || permission.codename.toLowerCase().includes(q)
                      || permission.screen.toLowerCase().includes(q);
                  });
                  return (
                    <Fragment key={module.module}>
                      <tr className="bg-[var(--muted)]/30">
                        <th
                          scope="colgroup"
                          colSpan={(data?.roles.length ?? 0) + 1}
                          className="px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]"
                        >
                          <button
                            type="button"
                            className="inline-flex items-center gap-1"
                            onClick={() => setCollapsed((current) => ({ ...current, [module.module]: !current[module.module] }))}
                          >
                            <ChevronDown className={`size-3 transition-transform ${collapsed[module.module] ? "-rotate-90" : ""}`} />
                            {module.module}
                          </button>
                        </th>
                      </tr>
                      {!collapsed[module.module] ? rows.map((permission) => (
                        <tr key={permission.codename} className="border-b border-[var(--border)] last:border-0">
                          <td className="ztable-cell">
                            <span className="font-medium">{permission.name}</span>
                            <span className="ml-2 font-mono text-[11px] text-[var(--muted-foreground)]">
                              {permission.codename}
                            </span>
                          </td>
                          {(data?.roles ?? []).map((role) => {
                            const checked = Boolean(draft[permission.codename]?.[role.code]);
                            const changed = checked !== Boolean(original[permission.codename]?.[role.code]);
                            return (
                              <td key={role.code} className="ztable-cell text-center">
                                <input
                                  type="checkbox"
                                  className={changed ? "accent-[var(--warning)]" : "accent-[var(--primary)]"}
                                  checked={checked}
                                  onChange={() => toggle(permission.codename, role.code)}
                                  aria-label={`${role.name} ${permission.name}`}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      )) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          </Card>
        </>
      )}
    </>
  );
}
