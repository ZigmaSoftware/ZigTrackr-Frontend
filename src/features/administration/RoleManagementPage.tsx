import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { roleApi } from "@/api/services";
import { apiErrorMessage } from "@/api/client";
import { PageHeader } from "@/components/common/PageHeader";
import { Modal } from "@/components/feedback/Modal";
import { ErrorState } from "@/components/feedback/states";
import { Button, Card, CardBody, CardHeader, CardTitle, Input, Label, Skeleton, Textarea } from "@/components/ui/primitives";
import type { RoleRow } from "@/types";

export function RoleManagementPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const roles = useQuery({ queryKey: ["roles"], queryFn: roleApi.list });
  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<RoleRow> }) =>
      roleApi.update(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["roles"] });
      await queryClient.invalidateQueries({ queryKey: ["permission-matrix"] });
      toast.success("Role updated");
      setEditing(null);
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Unable to update role.")),
  });

  return (
    <>
      <PageHeader
        title="Role Management"
        description="Manage role labels, descriptions and active status."
        breadcrumbs={[{ label: "Administration" }, { label: "Roles" }]}
      />

      {roles.isError ? (
        <Card><ErrorState onRetry={() => roles.refetch()} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {roles.isLoading
            ? Array.from({ length: 6 }).map((_, index) => (
                <Card key={index} className="p-4"><Skeleton className="h-20" /></Card>
              ))
            : (roles.data?.results ?? []).map((role) => (
                <Card key={role.id}>
                  <CardHeader>
                    <div className="min-w-0">
                      <CardTitle>{role.name}</CardTitle>
                      <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                        {role.code}
                      </span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setEditing(role)}>
                      <Edit3 /> Edit
                    </Button>
                  </CardHeader>
                  <CardBody className="space-y-3">
                    <p className="min-h-10 text-[13px] text-[var(--muted-foreground)]">
                      {role.description || "No description."}
                    </p>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="inline-flex items-center gap-1.5 text-[var(--muted-foreground)]">
                        <ShieldCheck className="size-3.5" /> {role.permission_count} permissions
                      </span>
                      <span className={role.is_active ? "text-[var(--success)]" : "text-[var(--destructive)]"}>
                        {role.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </CardBody>
                </Card>
              ))}
        </div>
      )}

      {editing ? (
        <RoleDialog
          role={editing}
          loading={update.isPending}
          onClose={() => setEditing(null)}
          onSave={(payload) => update.mutate({ id: editing.id, payload })}
        />
      ) : null}
    </>
  );
}

function RoleDialog({
  role, loading, onClose, onSave,
}: {
  role: RoleRow;
  loading: boolean;
  onClose: () => void;
  onSave: (payload: Partial<RoleRow>) => void;
}) {
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? "");
  const [isActive, setIsActive] = useState(role.is_active);

  useEffect(() => {
    setName(role.name);
    setDescription(role.description ?? "");
    setIsActive(role.is_active);
  }, [role]);

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Edit ${role.name}`}
      description={role.code}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button loading={loading} onClick={() => onSave({ name, description, is_active: isActive })}>Save changes</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label required>Role Name</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            disabled={role.is_system}
          />
          Active
        </label>
      </div>
    </Modal>
  );
}
