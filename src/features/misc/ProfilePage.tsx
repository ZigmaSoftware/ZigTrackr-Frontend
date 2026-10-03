import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { authApi } from "@/api/services";
import { apiErrorMessage, apiFieldErrors } from "@/api/client";
import { useAuth } from "@/features/auth/AuthContext";
import { PageHeader } from "@/components/common/PageHeader";
import { Button, Card, CardBody, CardHeader, CardTitle, Input, Label } from "@/components/ui/primitives";

export function ProfilePage() {
  const { user } = useAuth();
  const [values, setValues] = useState({
    current_password: "", new_password: "", confirm_password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const change = useMutation({
    mutationFn: () => authApi.changePassword(values),
    onSuccess: () => {
      toast.success("Password changed. Other sessions have been signed out.");
      setValues({ current_password: "", new_password: "", confirm_password: "" });
      setErrors({});
    },
    onError: (error) => {
      setErrors(apiFieldErrors(error));
      toast.error(apiErrorMessage(error));
    },
  });

  return (
    <>
      <PageHeader title="Profile" description="Your account details and password." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Account</CardTitle></CardHeader>
          <CardBody className="space-y-2.5">
            {[
              ["Name", user?.name],
              ["Username", user?.username],
              ["Email", user?.email],
              ["Employee code", user?.employee_code],
              ["Department", user?.department],
              ["Team", user?.team],
              ["Roles", user?.roles?.map((r) => r.name).join(", ")],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <p className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">{label}</p>
                <p className="mt-0.5 text-[13px]">{value || "—"}</p>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
          <CardBody className="space-y-3.5">
            {([
              ["current_password", "Current password"],
              ["new_password", "New password"],
              ["confirm_password", "Confirm new password"],
            ] as const).map(([field, label]) => (
              <div key={field} className="space-y-1.5">
                <Label htmlFor={field} required>{label}</Label>
                <Input
                  id={field}
                  type="password"
                  autoComplete={field === "current_password" ? "current-password" : "new-password"}
                  value={values[field]}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [field]: event.target.value }))}
                  aria-invalid={Boolean(errors[field])}
                />
                {errors[field] ? (
                  <p className="text-[12px] text-[var(--destructive)]">{errors[field]}</p>
                ) : null}
              </div>
            ))}
            <p className="text-[11px] text-[var(--muted-foreground)]">
              Changing your password signs out your other devices.
            </p>
            <Button loading={change.isPending} onClick={() => change.mutate()}>
              Change password
            </Button>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
