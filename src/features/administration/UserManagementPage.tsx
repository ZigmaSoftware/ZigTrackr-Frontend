import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, Power, PowerOff, UserCog } from "lucide-react";
import { toast } from "sonner";
import { userApi } from "@/api/services";
import { queryKeys } from "@/api/queryKeys";
import { apiErrorMessage, apiFieldErrors } from "@/api/client";
import { useAuth } from "@/features/auth/AuthContext";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { useDepartments, useTeams, useSites } from "@/hooks/useMasters";
import { PageHeader } from "@/components/common/PageHeader";
import {
  Button, Card, IconButton, Input, Label, Select,
} from "@/components/ui/primitives";
import { Modal, ConfirmDialog } from "@/components/feedback/Modal";
import { DataTable, TruncatedCell, type Column } from "@/components/tables/DataTable";
import { Pagination } from "@/components/tables/Pagination";
import { ErrorState } from "@/components/feedback/states";
import { formatDate } from "@/lib/dates";
import type { MasterRow } from "@/types";

/* ---- USER ADMINISTRATION (spec 16) ----
   Create/edit/deactivate/reactivate/reset-password. Every write goes through
   the backend's user_service, which is what guarantees a new account gets a
   validated password and, if a role is picked here, working permissions --
   an account created any other way (a shell session) has neither
   guarantee, which is exactly the failure mode this screen exists to
   close off. */

interface RoleRef { code: string; name: string }
interface RoleOption { id: string; code: string; name: string }

const ROLE_CODES = ["ADMIN", "TEAM_LEAD", "DEVELOPER", "TESTER", "REPORTER", "MANAGEMENT"];

type FormMode = "create" | "edit" | null;

interface FormValues {
  username: string;
  email: string;
  full_name: string;
  employee_code: string;
  phone: string;
  designation: string;
  department: string;
  team: string;
  site: string;
  password: string;
  roles: string[];
}

const EMPTY_FORM: FormValues = {
  username: "", email: "", full_name: "", employee_code: "", phone: "",
  designation: "", department: "", team: "", site: "", password: "", roles: [],
};

export function UserManagementPage() {
  const { can, user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { filters, setFilters } = useUrlFilters({ ordering: "full_name" });

  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingRow, setEditingRow] = useState<MasterRow | null>(null);
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [deactivating, setDeactivating] = useState<MasterRow | null>(null);
  const [resettingPasswordFor, setResettingPasswordFor] = useState<MasterRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string>();

  const departments = useDepartments();
  const teams = useTeams();
  const sites = useSites();
  const roleOptions = useQuery({
    queryKey: ["roles", "options"],
    queryFn: () => userApi.roles(),
    staleTime: 5 * 60_000,
    select: (data) => data.results,
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [...queryKeys.users.all, filters],
    queryFn: () => userApi.list({ ...filters, include_inactive: true }),
    placeholderData: (previous) => previous,
  });

  function invalidateUsers() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
  }

  const create = useMutation({
    mutationFn: (payload: Record<string, unknown>) => userApi.create(payload),
    onSuccess: (created) => {
      invalidateUsers();
      toast.success(`${created.name ?? created.username} created`);
      closeForm();
    },
    onError: (error) => {
      setErrors(apiFieldErrors(error));
      toast.error(apiErrorMessage(error));
    },
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      userApi.update(id, payload),
    onSuccess: () => {
      invalidateUsers();
      toast.success("User updated");
      closeForm();
    },
    onError: (error) => {
      setErrors(apiFieldErrors(error));
      toast.error(apiErrorMessage(error));
    },
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => userApi.deactivate(id),
    onSuccess: () => {
      invalidateUsers();
      toast.success("User deactivated");
      setDeactivating(null);
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const reactivate = useMutation({
    mutationFn: (id: string) => userApi.reactivate(id),
    onSuccess: () => {
      invalidateUsers();
      toast.success("User reactivated");
    },
    onError: (error) => toast.error(apiErrorMessage(error)),
  });

  const resetPassword = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      userApi.resetPassword(id, { new_password: password }),
    onSuccess: () => {
      toast.success("Password reset. The user is signed out everywhere.");
      setResettingPasswordFor(null);
      setNewPassword("");
      setPasswordError(undefined);
    },
    onError: (error) => {
      setPasswordError(apiFieldErrors(error).new_password ?? apiErrorMessage(error));
    },
  });

  function openCreate() {
    setValues(EMPTY_FORM);
    setErrors({});
    setEditingRow(null);
    setFormMode("create");
  }

  function openEdit(row: MasterRow) {
    const roles = (row.roles as RoleRef[] | undefined) ?? [];
    setValues({
      username: String(row.username ?? ""),
      email: String(row.email ?? ""),
      full_name: String(row.full_name ?? row.name ?? ""),
      employee_code: String(row.employee_code ?? ""),
      phone: String(row.phone ?? ""),
      designation: String(row.designation ?? ""),
      department: "", team: "", site: "", // resolved server-side; edit sends only what changed
      password: "",
      roles: roles.map((r) => r.code),
    });
    setErrors({});
    setEditingRow(row);
    setFormMode("edit");
  }

  function closeForm() {
    setFormMode(null);
    setEditingRow(null);
    setValues(EMPTY_FORM);
    setErrors({});
  }

  function toggleRole(code: string) {
    setValues((current) => ({
      ...current,
      roles: current.roles.includes(code)
        ? current.roles.filter((r) => r !== code)
        : [...current.roles, code],
    }));
  }

  function submitForm() {
    const nextErrors: Record<string, string> = {};
    if (!values.username.trim()) nextErrors.username = "Username is required.";
    if (formMode === "create" && !values.password.trim()) {
      nextErrors.password = "A password is required when creating a user.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (formMode === "create") {
      create.mutate({
        username: values.username,
        email: values.email || undefined,
        full_name: values.full_name || undefined,
        employee_code: values.employee_code || undefined,
        phone: values.phone || undefined,
        designation: values.designation || undefined,
        department: values.department || undefined,
        team: values.team || undefined,
        site: values.site || undefined,
        password: values.password,
        roles: values.roles,
      });
    } else if (editingRow) {
      update.mutate({
        id: String(editingRow.id),
        payload: {
          email: values.email || undefined,
          full_name: values.full_name || undefined,
          employee_code: values.employee_code || undefined,
          phone: values.phone || undefined,
          designation: values.designation || undefined,
          roles: values.roles,
        },
      });
    }
  }

  const columns = useMemo<Column<MasterRow>[]>(() => [
    {
      key: "name", header: "Name", sortable: true,
      cell: (row) => (
        <div className="min-w-0">
          <TruncatedCell className="font-medium">{String(row.name ?? row.username)}</TruncatedCell>
          <span className="text-[11px] text-[var(--muted-foreground)]">
            {String(row.username ?? "")}
          </span>
        </div>
      ),
    },
    {
      key: "email", header: "Email", hideBelow: "md",
      cell: (row) => (
        <TruncatedCell className="text-[var(--muted-foreground)]">
          {String(row.email || "—")}
        </TruncatedCell>
      ),
    },
    {
      key: "employee_code", header: "Emp Code", width: "w-28", hideBelow: "lg",
      cell: (row) => <span className="font-mono text-[12px]">{String(row.employee_code || "—")}</span>,
    },
    {
      key: "roles", header: "Roles", width: "w-48",
      cell: (row) => {
        const roles = (row.roles as RoleRef[] | undefined) ?? [];
        if (roles.length === 0) {
          return (
            <span className="text-[12px] font-medium text-[var(--priority-medium-fg)]" title="No permissions until a role is assigned">
              No role
            </span>
          );
        }
        return (
          <div className="flex flex-wrap gap-1">
            {roles.map((role) => (
              <span
                key={role.code}
                className="rounded bg-[var(--accent)] px-1.5 py-0.5 text-[11px] text-[var(--accent-foreground)]"
              >
                {role.name}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: "team_name", header: "Team", width: "w-40", hideBelow: "lg",
      cell: (row) => <span>{String(row.team_name || "—")}</span>,
    },
    {
      key: "is_active", header: "Status", width: "w-24",
      cell: (row) => (
        <span className={row.is_active
          ? "text-[12px] text-[var(--success)]"
          : "text-[12px] text-[var(--muted-foreground)]"}>
          {row.is_active ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "last_login", header: "Last Login", width: "w-32", hideBelow: "xl",
      cell: (row) => (
        <span className="whitespace-nowrap text-[var(--muted-foreground)]">
          {row.last_login ? formatDate(String(row.last_login)) : "Never"}
        </span>
      ),
    },
    {
      key: "actions", header: "", width: "w-32", align: "right",
      cell: (row) => {
        const isSelf = row.id === currentUser?.id;
        return (
          <div className="flex justify-end gap-0.5">
            {can("admin.user.edit") ? (
              <IconButton label={`Edit ${row.name ?? row.username}`} onClick={() => openEdit(row)}>
                <UserCog />
              </IconButton>
            ) : null}
            {can("admin.user.edit") ? (
              <IconButton
                label={`Reset password for ${row.name ?? row.username}`}
                onClick={() => { setResettingPasswordFor(row); setNewPassword(""); setPasswordError(undefined); }}
              >
                <KeyRound />
              </IconButton>
            ) : null}
            {can("admin.user.delete") && !isSelf ? (
              row.is_active ? (
                <IconButton label={`Deactivate ${row.name ?? row.username}`}
                           onClick={() => setDeactivating(row)}>
                  <PowerOff />
                </IconButton>
              ) : (
                <IconButton label={`Reactivate ${row.name ?? row.username}`}
                           onClick={() => reactivate.mutate(String(row.id))}>
                  <Power />
                </IconButton>
              )
            ) : null}
          </div>
        );
      },
    },
  ], [can, currentUser, reactivate]);

  const isFormOpen = formMode !== null;

  return (
    <>
      <PageHeader
        title="User Management"
        description="People with access to ZigTrackr, and the roles they hold."
        breadcrumbs={[{ label: "Administration" }, { label: "Users" }]}
        actions={
          can("admin.user.add") ? (
            <Button size="sm" onClick={openCreate}><Plus /> Add User</Button>
          ) : null
        }
      />

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--border)] p-3">
          <Input
            type="search"
            className="h-8 max-w-xs"
            placeholder="Search name, username or email…"
            aria-label="Search users"
            value={(filters.search as string) ?? ""}
            onChange={(event) => setFilters({ search: event.target.value })}
          />
        </div>
        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={data?.results ?? []}
              rowKey={(row) => String(row.id)}
              isLoading={isLoading}
              ordering={filters.ordering}
              onOrderingChange={(ordering) => setFilters({ ordering })}
              emptyTitle="No users found"
            />
            {data && data.count > 0 ? (
              <Pagination
                page={data.page} totalPages={data.total_pages} count={data.count}
                pageSize={filters.limit}
                onPageChange={(page) => setFilters({ page }, { resetPage: false })}
                onPageSizeChange={(limit) => setFilters({ limit })}
              />
            ) : null}
          </>
        )}
      </Card>

      {/* ---- CREATE / EDIT ---- */}
      <Modal
        open={isFormOpen}
        onOpenChange={(open) => !open && closeForm()}
        title={formMode === "create" ? "Add user" : "Edit user"}
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button loading={create.isPending || update.isPending} onClick={submitForm}>
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="u-username" required>Username</Label>
            <Input
              id="u-username" disabled={formMode === "edit"}
              value={values.username}
              onChange={(e) => setValues((v) => ({ ...v, username: e.target.value }))}
            />
            {errors.username ? <p className="text-[12px] text-[var(--destructive)]">{errors.username}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="u-email">Email</Label>
            <Input id="u-email" type="email" value={values.email}
                   onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))} />
            {errors.email ? <p className="text-[12px] text-[var(--destructive)]">{errors.email}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="u-full-name">Full name</Label>
            <Input id="u-full-name" value={values.full_name}
                   onChange={(e) => setValues((v) => ({ ...v, full_name: e.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="u-emp-code">Employee code</Label>
            <Input id="u-emp-code" value={values.employee_code}
                   onChange={(e) => setValues((v) => ({ ...v, employee_code: e.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="u-phone">Phone</Label>
            <Input id="u-phone" value={values.phone}
                   onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="u-designation">Designation</Label>
            <Input id="u-designation" value={values.designation}
                   onChange={(e) => setValues((v) => ({ ...v, designation: e.target.value }))} />
          </div>

          {formMode === "create" ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="u-department">Department</Label>
                <Select id="u-department" value={values.department}
                        onChange={(e) => setValues((v) => ({ ...v, department: e.target.value }))}>
                  <option value="">Select…</option>
                  {(departments.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-team">Team</Label>
                <Select id="u-team" value={values.team}
                        onChange={(e) => setValues((v) => ({ ...v, team: e.target.value }))}>
                  <option value="">Select…</option>
                  {(teams.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-site">Site</Label>
                <Select id="u-site" value={values.site}
                        onChange={(e) => setValues((v) => ({ ...v, site: e.target.value }))}>
                  <option value="">Select…</option>
                  {(sites.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-password" required>Password</Label>
                <Input id="u-password" type="password" value={values.password}
                       onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))} />
                {errors.password ? <p className="text-[12px] text-[var(--destructive)]">{errors.password}</p> : null}
              </div>
            </>
          ) : null}

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Roles</Label>
            <p className="text-[11px] text-[var(--muted-foreground)]">
              A user with no role has no permissions and sees an almost-empty app.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              {(roleOptions.data ?? ROLE_CODES.map((code) => ({ id: code, code, name: code }) as RoleOption))
                .map((role) => (
                <label key={role.code} className="flex cursor-pointer items-center gap-1.5 text-[13px]">
                  <input
                    type="checkbox"
                    className="size-3.5 rounded border-[var(--input)] accent-[var(--primary)]"
                    checked={values.roles.includes(role.code)}
                    onChange={() => toggleRole(role.code)}
                  />
                  {role.name}
                </label>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* ---- DEACTIVATE ---- */}
      <ConfirmDialog
        open={Boolean(deactivating)}
        onOpenChange={(open) => !open && setDeactivating(null)}
        title="Deactivate user"
        description={`"${deactivating?.name ?? deactivating?.username}" will be signed out everywhere and unable to log in until reactivated.`}
        confirmLabel="Deactivate"
        destructive
        loading={deactivate.isPending}
        onConfirm={() => deactivating && deactivate.mutate(String(deactivating.id))}
      />

      {/* ---- RESET PASSWORD ---- */}
      <Modal
        open={Boolean(resettingPasswordFor)}
        onOpenChange={(open) => !open && setResettingPasswordFor(null)}
        title="Reset password"
        description={`Set a new password for "${resettingPasswordFor?.name ?? resettingPasswordFor?.username}". They are signed out of every active session.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setResettingPasswordFor(null)}>Cancel</Button>
            <Button
              loading={resetPassword.isPending}
              onClick={() => {
                if (!newPassword.trim()) { setPasswordError("A new password is required."); return; }
                if (resettingPasswordFor) {
                  resetPassword.mutate({ id: String(resettingPasswordFor.id), password: newPassword });
                }
              }}
            >
              Reset password
            </Button>
          </>
        }
      >
        <div className="space-y-1.5">
          <Label htmlFor="reset-new-password" required>New password</Label>
          <Input
            id="reset-new-password" type="password" value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoFocus
          />
          {passwordError ? <p className="text-[12px] text-[var(--destructive)]">{passwordError}</p> : null}
        </div>
      </Modal>
    </>
  );
}
