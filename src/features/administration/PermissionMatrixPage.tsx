import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LockKeyhole, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { roleApi } from "@/api/services";
import { apiErrorMessage } from "@/api/client";
import { useAuth } from "@/features/auth/AuthContext";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardBody, Button, Input, Select, Skeleton } from "@/components/ui/primitives";
import { ErrorState } from "@/components/feedback/states";
import { setSubmodule, submoduleChanged, submoduleChanges, submoduleState, toGrants, type Grants } from "./submoduleGrants";
import { useCompanies } from "@/hooks/useMasters";

const moduleName = (name: string) => name.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export function PermissionMatrixPage() {
  const queryClient = useQueryClient();
  const { can, refresh, user } = useAuth();
  const companies = useCompanies();
  const [company, setCompany] = useState("");
  const canManage = can("admin.permission.manage");
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ["permission-matrix", company], queryFn: () => roleApi.matrix(company || undefined) });
  const [draft, setDraft] = useState<Grants>({});
  const original = useMemo(() => toGrants(data), [data]);
  useEffect(() => setDraft(original), [original]);

  const dirtyRoles = useMemo(() => data?.roles.filter((role) => submoduleChanges(data, original, draft, role.code).length > 0) ?? [], [data, original, draft]);
  const save = useMutation({
    mutationFn: async () => {
      if (!data || !canManage) return;
      for (const role of dirtyRoles) {
        await roleApi.updateSubmodulePermissions(role.id, submoduleChanges(data, original, draft, role.code), company || undefined);
      }
    },
    onSuccess: async () => {
      toast.success("Submodule access updated");
      await refresh();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["permission-matrix"] }),
        queryClient.invalidateQueries({ queryKey: ["roles"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Unable to update submodule access.")),
  });

  const modules = (data?.modules ?? []).filter((module) => !moduleFilter || module.module === moduleFilter)
    .map((module) => ({ ...module, submodules: module.submodules.filter((submodule) => submodule.name.toLowerCase().includes(search.trim().toLowerCase())) }))
    .filter((module) => module.submodules.length > 0);
  const submoduleCount = data?.modules.reduce((total, module) => total + module.submodules.length, 0) ?? 0;

  return <>
    <PageHeader title="Permission Management"
      description="Choose submodule access for each role. Selected submodules include all their actions."
      breadcrumbs={[{ label: "Administration" }, { label: "Permissions" }]}
      actions={canManage ? <div className="flex max-w-[calc(100vw-3rem)] flex-wrap items-center gap-2">
        {user?.is_superuser ? <Select aria-label="Permission company" className="w-[220px] max-w-full" value={company}
          disabled={save.isPending || dirtyRoles.length > 0} onChange={(event) => setCompany(event.target.value)}>
          <option value="">Global defaults</option>{(companies.data ?? []).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
        </Select> : null}
        <Button variant="outline" size="sm" onClick={() => setDraft(original)} disabled={!dirtyRoles.length || save.isPending}><RotateCcw /> Reset</Button>
        <Button size="sm" onClick={() => save.mutate()} disabled={!dirtyRoles.length} loading={save.isPending}><Save /> Save Changes</Button>
      </div> : undefined} />

    {isError ? <Card><ErrorState onRetry={() => void refetch()} /></Card> : isLoading ? <Card className="p-4"><Skeleton className="h-64" /></Card> : <>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[{ label: "Roles", value: data?.roles.length ?? 0 }, { label: "Submodules", value: submoduleCount }, { label: "Roles with unsaved changes", value: dirtyRoles.length }].map((stat) => (
          <Card key={stat.label}><CardBody><p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">{stat.label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{stat.value}</p></CardBody></Card>
        ))}
      </div>
      <Card className="overflow-hidden">
        <div className="grid gap-3 border-b border-[var(--border)] p-3 md:grid-cols-[minmax(240px,1fr)_220px]">
          <Input type="search" placeholder="Search submodule…" aria-label="Search submodules" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Select aria-label="Filter submodule group" value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
            <option value="">All groups</option>{(data?.modules ?? []).filter((module) => module.submodules.length > 0).map((module) => <option key={module.module} value={module.module}>{moduleName(module.module)}</option>)}
          </Select>
        </div>
        <div className="border-b border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2 text-[12px] text-[var(--muted-foreground)]">
          {data?.company?.name ?? "Global defaults"}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse">
            <caption className="sr-only">Submodule access by role</caption>
            <thead className="border-b border-[var(--border)] bg-[var(--muted)]/50"><tr>
              <th scope="col" className="ztable-head w-[300px]">Submodule</th>
              {(data?.roles ?? []).map((role) => <th key={role.code} scope="col" className="ztable-head text-center">{role.name}</th>)}
            </tr></thead>
            <tbody>
              {modules.map((module) => <Fragment key={module.module}>
                <tr className="bg-[var(--muted)]/30"><th scope="colgroup" colSpan={(data?.roles.length ?? 0) + 1} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  <button type="button" aria-expanded={!collapsed[module.module]} className="inline-flex items-center gap-1" onClick={() => setCollapsed((current) => ({ ...current, [module.module]: !current[module.module] }))}>
                    <ChevronDown className={`size-3 transition-transform ${collapsed[module.module] ? "-rotate-90" : ""}`} aria-hidden />{moduleName(module.module)}
                  </button>
                </th></tr>
                {!collapsed[module.module] ? module.submodules.map((submodule) => <tr key={submodule.key} className="border-b border-[var(--border)] last:border-0">
                  <th scope="row" className="ztable-cell text-left font-medium">{submodule.name}</th>
                  {(data?.roles ?? []).map((role) => {
                    const state = submoduleState(submodule, draft, role.code);
                    const changed = submoduleChanged(submodule, original, draft, role.code);
                    const protectedRole = submodule.protected_roles.includes(role.code) || role.can_manage === false;
                    return <td key={role.code} className="ztable-cell text-center">
                      <span className="inline-flex items-center justify-center gap-2" title={protectedRole ? "Only Super Admin can change Admin access." : undefined}>
                        <input type="checkbox" className={`size-4 cursor-pointer disabled:cursor-not-allowed ${changed ? "accent-[var(--warning)]" : "accent-[var(--primary)]"}`}
                          ref={(element) => { if (element) element.indeterminate = state.mixed; }}
                          checked={state.checked} aria-checked={state.mixed ? "mixed" : state.checked}
                          disabled={!canManage || save.isPending || protectedRole}
                          onChange={(event) => setDraft((current) => setSubmodule(current, submodule, role.code, event.target.checked))}
                          aria-label={`${role.name}: ${submodule.name}`} />
                        {protectedRole ? <LockKeyhole className="size-3 text-[var(--muted-foreground)]" aria-label="Protected Admin access" /> : null}
                      </span>
                    </td>;
                  })}
                </tr>) : null}
              </Fragment>)}
              {!modules.length ? <tr><td colSpan={(data?.roles.length ?? 0) + 1} className="py-12 text-center text-sm text-[var(--muted-foreground)]">No submodules match your search.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>
    </>}
  </>;
}
