import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Filter, Search, X } from "lucide-react";
import { Button, Input, Label, Select } from "@/components/ui/primitives";
import {
  useAssignableUsers, useDepartments, useModules, usePriorities,
  useProjects, useSeverities,
} from "@/hooks/useMasters";
import { ENVIRONMENT_OPTIONS, STATUS_OPTIONS } from "@/config/bugPresets";
import type { FilterState } from "@/hooks/useUrlFilters";

/* Spec 24: fourteen filters, in one panel, over one queryset. */
export interface BugFilterPanelProps {
  filters: FilterState;
  onChange: (updates: Record<string, unknown>) => void;
  onClear: () => void;
  activeCount: number;
  /** Filters fixed by the preset; hidden so a view cannot contradict itself. */
  lockedKeys?: string[];
}

export function BugFilterPanel({
  filters, onChange, onClear, activeCount, lockedKeys = [],
}: BugFilterPanelProps) {
  const [open, setOpen] = useState(false);
  const projects = useProjects();
  const modules = useModules(filters.project as string | undefined);
  const priorities = usePriorities();
  const severities = useSeverities();
  const departments = useDepartments();
  const users = useAssignableUsers();

  const locked = (key: string) => lockedKeys.includes(key);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--muted-foreground)]" aria-hidden />
        <Input
          type="search"
          value={(filters.search as string) ?? ""}
          onChange={(event) => onChange({ search: event.target.value })}
          placeholder="Search bug no, title, project, owner…"
          aria-label="Search bugs"
          className="h-8 pl-8"
        />
      </div>

      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <Button variant="outline" size="sm">
            <Filter />
            Filters
            {activeCount > 0 ? (
              <span className="ml-1 rounded-full bg-[var(--primary)] px-1.5 text-[10px] font-semibold text-[var(--primary-foreground)]">
                {activeCount}
              </span>
            ) : null}
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={6}
            className="z-50 w-[min(680px,calc(100vw-2rem))] rounded-lg border border-[var(--border)]
                       bg-[var(--popover)] p-4 shadow-[var(--shadow-pop)]"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Filter bugs</p>
              <Button variant="ghost" size="sm" onClick={onClear}>
                <X /> Clear all
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {!locked("status") ? (
                <Field label="Status" htmlFor="f-status">
                  <Select
                    id="f-status"
                    value={(filters.status as string) ?? ""}
                    onChange={(e) => onChange({ status: e.target.value || undefined })}
                  >
                    <option value="">All statuses</option>
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </Field>
              ) : null}

              {!locked("priority") ? (
                <Field label="Priority" htmlFor="f-priority">
                  <Select
                    id="f-priority"
                    value={(filters.priority as string) ?? ""}
                    onChange={(e) => onChange({ priority: e.target.value || undefined })}
                  >
                    <option value="">All priorities</option>
                    {(priorities.data ?? []).map((p) => (
                      <option key={p.id} value={String(p.code)}>{p.name}</option>
                    ))}
                  </Select>
                </Field>
              ) : null}

              <Field label="Severity" htmlFor="f-severity">
                <Select
                  id="f-severity"
                  value={(filters.severity as string) ?? ""}
                  onChange={(e) => onChange({ severity: e.target.value || undefined })}
                >
                  <option value="">All severities</option>
                  {(severities.data ?? []).map((s) => (
                    <option key={s.id} value={String(s.code)}>{s.name}</option>
                  ))}
                </Select>
              </Field>

              <Field label="Project" htmlFor="f-project">
                <Select
                  id="f-project"
                  value={(filters.project as string) ?? ""}
                  onChange={(e) => onChange({ project: e.target.value || undefined, module: undefined })}
                >
                  <option value="">All projects</option>
                  {(projects.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </Field>

              <Field label="Module" htmlFor="f-module">
                <Select
                  id="f-module"
                  disabled={!filters.project}
                  value={(filters.module as string) ?? ""}
                  onChange={(e) => onChange({ module: e.target.value || undefined })}
                >
                  <option value="">
                    {filters.project ? "All modules" : "Select a project first"}
                  </option>
                  {(modules.data ?? []).map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </Select>
              </Field>

              {!locked("owner") ? (
                <Field label="Owner" htmlFor="f-owner">
                  <Select
                    id="f-owner"
                    value={(filters.owner as string) ?? ""}
                    onChange={(e) => onChange({ owner: e.target.value || undefined })}
                  >
                    <option value="">Anyone</option>
                    <option value="me">Me</option>
                    {(users.data ?? []).map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </Select>
                </Field>
              ) : null}

              <Field label="Department" htmlFor="f-department">
                <Select
                  id="f-department"
                  value={(filters.department as string) ?? ""}
                  onChange={(e) => onChange({ department: e.target.value || undefined })}
                >
                  <option value="">All departments</option>
                  {(departments.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </Select>
              </Field>

              <Field label="Environment" htmlFor="f-environment">
                <Select
                  id="f-environment"
                  value={(filters.environment as string) ?? ""}
                  onChange={(e) => onChange({ environment: e.target.value || undefined })}
                >
                  <option value="">All environments</option>
                  {ENVIRONMENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </Field>

              <Field label="Reported from" htmlFor="f-from">
                <Input id="f-from" type="date" className="h-9"
                       value={(filters.reported_from as string) ?? ""}
                       onChange={(e) => onChange({ reported_from: e.target.value || undefined })} />
              </Field>

              <Field label="Reported to" htmlFor="f-to">
                <Input id="f-to" type="date" className="h-9"
                       value={(filters.reported_to as string) ?? ""}
                       onChange={(e) => onChange({ reported_to: e.target.value || undefined })} />
              </Field>

              <div className="space-y-2 sm:col-span-2">
                <p className="text-[13px] font-medium">Quick flags</p>
                <div className="flex flex-wrap gap-4">
                  {!locked("is_overdue") ? (
                    <Checkbox
                      id="f-overdue"
                      label="Overdue only"
                      checked={filters.is_overdue === "true"}
                      onChange={(checked) => onChange({ is_overdue: checked ? "true" : undefined })}
                    />
                  ) : null}
                  {!locked("is_update_pending") ? (
                    <Checkbox
                      id="f-pending"
                      label="Update pending"
                      checked={filters.is_update_pending === "true"}
                      onChange={(c) => onChange({ is_update_pending: c ? "true" : undefined })}
                    />
                  ) : null}
                  {!locked("unassigned") ? (
                    <Checkbox
                      id="f-unassigned"
                      label="Unassigned"
                      checked={filters.unassigned === "true"}
                      onChange={(c) => onChange({ unassigned: c ? "true" : undefined })}
                    />
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button size="sm" onClick={() => setOpen(false)}>Done</Button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {activeCount > 0 ? (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X /> Clear
        </Button>
      ) : null}
    </div>
  );
}

function Field({
  label, htmlFor, children,
}: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function Checkbox({
  id, label, checked, onChange,
}: { id: string; label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-[13px]">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-3.5 rounded border-[var(--input)] accent-[var(--primary)]"
      />
      {label}
    </label>
  );
}
