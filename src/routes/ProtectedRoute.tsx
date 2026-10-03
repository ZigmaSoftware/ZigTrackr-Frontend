import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { PermissionDenied } from "@/components/feedback/states";
import { Spinner } from "@/components/ui/primitives";

/* Route guarding is a convenience for the user, not a security boundary: the
   backend independently enforces the same permissions on every request
   (spec 14). Hiding a route the API would refuse just avoids a pointless
   round trip and an ugly error. */
export function ProtectedRoute({
  children, permissions,
}: { children: ReactNode; permissions?: string[] }) {
  const { user, isLoading, canAny } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="grid min-h-svh place-items-center">
        <Spinner className="size-6 text-[var(--muted-foreground)]" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (permissions?.length && !canAny(...permissions)) {
    return <PermissionDenied />;
  }

  return <>{children}</>;
}
