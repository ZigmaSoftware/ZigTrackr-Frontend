import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { masterApi } from "@/api/services";
import { queryKeys } from "@/api/queryKeys";
import { apiErrorMessage, apiFieldErrors } from "@/api/client";
import { useAuth } from "@/features/auth/AuthContext";
import { useMasterOptions } from "@/hooks/useMasters";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Button, Card, IconButton, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { Modal, ConfirmDialog } from "@/components/feedback/Modal";
import { ErrorState } from "@/components/feedback/states";
import type { MasterRow } from "@/types";

/* ---- ONE MASTER SCREEN ----
   Nine masters, one component. Each is a configuration object, so adding a
   master is a config entry rather than another CRUD page (spec 3). */

export interface MasterField {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "color" | "select";
  required?: boolean;
  /** An empty numeric input explicitly clears a nullable database field. */
  nullable?: boolean;
  placeholder?: string;
  help?: string;
  /** Static options; otherwise the config's parent resource supplies them. */
  options?: { value: string; label: string }[];
  /** Locked once the row exists and is a seeded system row. */
  lockedOnSystem?: boolean;
}

export interface MasterConfig {
  resource: string;
  title: string;
  singular: string;
  description: string;
  fields: MasterField[];
  columns?: Column<MasterRow>[];
  /** Parent filter, e.g. modules need a project. */
  parentResource?: string;
  parentLabel?: string;
}

export function MasterShell({ config }: { config: MasterConfig }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<MasterRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<MasterRow | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isOpen = creating || Boolean(editing);
  const parentOptions = useMasterOptions(
    config.parentResource ?? "",
    editing ? { include_inactive: true } : undefined,
    isOpen && Boolean(config.parentResource),
  );
  const parentRows = (parentOptions.data ?? []).filter((row) => editing || row.is_active);
  const parentUnavailable = Boolean(config.parentResource) && (
    parentOptions.isLoading || parentOptions.isError || parentRows.length === 0
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.masters.list(config.resource, { include_inactive: true }),
    queryFn: () => masterApi.list(config.resource, { include_inactive: true }),
  });

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      editing
        ? masterApi.update(config.resource, editing.id, payload)
        : masterApi.create(config.resource, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.masters.all });
      toast.success(`${config.singular} saved`);
      close();
    },
    onError: (error) => {
      setErrors(apiFieldErrors(error));
      toast.error(apiErrorMessage(error));
    },
  });

  const remove = useMutation({
    mutationFn: (row: MasterRow) => masterApi.remove(config.resource, row.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.masters.all });
      toast.success(`${config.singular} deactivated`);
      setDeleting(null);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  function open(row?: MasterRow) {
    setErrors({});
    if (row) {
      setEditing(row);
      setValues(
        Object.fromEntries(config.fields.map((f) => [
          f.name, String(row[f.name] ?? row[`${f.name}_id`] ?? ""),
        ])),
      );
    } else {
      setCreating(true);
      setValues(Object.fromEntries(config.fields.map((f) => [f.name, ""])));
    }
  }

  function close() {
    setEditing(null);
    setCreating(false);
    setValues({});
    setErrors({});
  }

  const columns = useMemo<Column<MasterRow>[]>(() => {
    const base: Column<MasterRow>[] = config.columns ?? [
      ...(config.fields.some((f) => f.name === "code")
        ? [{
            key: "code", header: "Code", width: "w-28",
            cell: (row: MasterRow) => (
              <span className="font-mono text-[12px]">{String(row.code ?? "—")}</span>
            ),
          }]
        : []),
      {
        key: "name", header: "Name", sortable: true,
        cell: (row: MasterRow) => (
          <span className="flex items-center gap-2 font-medium">
            {row.color ? (
              <span className="size-2.5 rounded-full" style={{ backgroundColor: String(row.color) }} aria-hidden />
            ) : null}
            {row.name}
            {row.is_system ? (
              <span className="rounded bg-[var(--muted)] px-1 text-[10px] text-[var(--muted-foreground)]">
                system
              </span>
            ) : null}
          </span>
        ),
      },
      {
        key: "description", header: "Description", hideBelow: "md",
        cell: (row: MasterRow) => (
          <span className="text-[var(--muted-foreground)]">{String(row.description ?? "—")}</span>
        ),
      },
      {
        key: "is_active", header: "Status", width: "w-24",
        cell: (row: MasterRow) => (
          <span className={row.is_active
            ? "text-[12px] text-[var(--success)]"
            : "text-[12px] text-[var(--muted-foreground)]"}>
            {row.is_active ? "Active" : "Inactive"}
          </span>
        ),
      },
    ];

    return [
      ...base,
      {
        key: "actions", header: "", width: "w-20", align: "right",
        cell: (row: MasterRow) => (
          <div className="flex justify-end gap-0.5">
            {can("masters.master.edit") ? (
              <IconButton label={`Edit ${row.name}`} onClick={() => open(row)}>
                <Pencil />
              </IconButton>
            ) : null}
            {can("masters.master.delete") && !row.is_system ? (
              <IconButton label={`Deactivate ${row.name}`} onClick={() => setDeleting(row)}>
                <Trash2 />
              </IconButton>
            ) : null}
          </div>
        ),
      },
    ];
  }, [config, can]);

  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        breadcrumbs={[{ label: "Masters" }, { label: config.title }]}
        actions={
          can("masters.master.add") ? (
            <Button size="sm" onClick={() => open()}>
              <Plus /> Add {config.singular}
            </Button>
          ) : null
        }
      />

      <Card className="overflow-hidden">
        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : (
          <DataTable
            columns={columns}
            rows={data?.results ?? []}
            rowKey={(row) => row.id}
            isLoading={isLoading}
            emptyTitle={`No ${config.title.toLowerCase()} yet`}
            emptyDescription={`Add the first ${config.singular.toLowerCase()} to get started.`}
          />
        )}
      </Card>

      <Modal
        open={isOpen}
        onOpenChange={(open) => !open && close()}
        title={editing ? `Edit ${config.singular}` : `Add ${config.singular}`}
        footer={
          <>
            <Button variant="outline" onClick={close}>Cancel</Button>
            <Button
              loading={save.isPending}
              disabled={parentUnavailable}
              onClick={() => {
                const payload: Record<string, unknown> = {};
                const nextErrors: Record<string, string> = {};
                for (const field of config.fields) {
                  const value = values[field.name] ?? "";
                  if (field.required && !value.trim()) {
                    nextErrors[field.name] = `${field.label} is required.`;
                  }
                  if (field.type === "number" && value === "" && !field.nullable) continue;
                  payload[field.name] = field.type === "number"
                    ? (value === "" ? null : Number(value))
                    : value;
                }
                setErrors(nextErrors);
                if (Object.keys(nextErrors).length === 0) save.mutate(payload);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          {config.fields.map((field) => {
            const locked = Boolean(field.lockedOnSystem && editing?.is_system);
            const usesParent = field.type === "select" && !field.options && Boolean(config.parentResource);
            const options = field.options ?? parentRows.map((row) => ({ value: row.id, label: row.name }));
            const parentMessage = usesParent && parentOptions.isError
              ? `Unable to load ${config.parentResource}. Please retry.`
              : usesParent && !parentOptions.isLoading && options.length === 0
                ? `Create an active ${config.parentLabel?.toLowerCase()} in Masters → ${config.parentLabel}s first.`
                : undefined;
            return (
              <div key={field.name} className="space-y-1.5">
                <Label htmlFor={`m-${field.name}`} required={field.required}>{field.label}</Label>
                {field.type === "textarea" ? (
                  <Textarea
                    id={`m-${field.name}`} rows={2} disabled={locked}
                    value={values[field.name] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                  />
                ) : field.type === "select" ? (
                  <Select
                    id={`m-${field.name}`} disabled={locked || (usesParent && parentUnavailable)}
                    aria-busy={usesParent && parentOptions.isLoading}
                    aria-invalid={Boolean(errors[field.name])}
                    aria-describedby={parentMessage ? `m-${field.name}-parent-status` : undefined}
                    value={values[field.name] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                  >
                    <option value="">
                      {usesParent && parentOptions.isLoading
                        ? `Loading ${config.parentResource}…`
                        : parentMessage ? `No ${config.parentResource} available` : "Select…"}
                    </option>
                    {options.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    id={`m-${field.name}`}
                    type={field.type === "number" ? "number" : field.type === "color" ? "color" : "text"}
                    disabled={locked}
                    placeholder={field.placeholder}
                    value={values[field.name] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                  />
                )}
                {parentMessage ? (
                  <div id={`m-${field.name}-parent-status`} role={parentOptions.isError ? "alert" : "status"}>
                    <p className="text-[12px] text-[var(--muted-foreground)]">{parentMessage}</p>
                    {parentOptions.isError ? (
                      <Button type="button" variant="link" size="sm" onClick={() => void parentOptions.refetch()}>
                        Retry
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {locked ? (
                  <p className="text-[11px] text-[var(--muted-foreground)]">
                    Locked: reports and dashboards reference this code.
                  </p>
                ) : field.help ? (
                  <p className="text-[11px] text-[var(--muted-foreground)]">{field.help}</p>
                ) : null}
                {errors[field.name] ? (
                  <p className="text-[12px] text-[var(--destructive)]">{errors[field.name]}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Deactivate ${config.singular.toLowerCase()}`}
        description={`"${deleting?.name}" will be deactivated and hidden from new bugs. Existing bugs keep their reference.`}
        confirmLabel="Deactivate"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </>
  );
}
