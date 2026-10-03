import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { bugApi } from "@/api/services";
import { queryKeys } from "@/api/queryKeys";
import { Modal } from "@/components/feedback/Modal";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import {
  useAssignableUsers, useDepartments, useModules, usePriorities, useProjects,
  useRootCauseTypes, useSeverities, useSites, useSubmodules,
} from "@/hooks/useMasters";
import { useBugWorkflow } from "@/features/bugs/useBugWorkflow";
import { todayIso, toDateInput } from "@/lib/dates";
import { ENVIRONMENT_OPTIONS } from "@/config/bugPresets";
import type { BugDetail, BugStatus } from "@/types";

/* Shared dialog plumbing. Each dialog validates on the client for a quick
   response, but the backend re-validates everything (spec 29/30); these forms
   are a convenience, never the enforcement. */

interface BaseProps {
  bug: BugDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[12px] text-[var(--destructive)]">{message}</p>;
}

/* ---- ASSIGN (spec 37) ---- */
export function AssignDialog({ bug, open, onOpenChange }: BaseProps) {
  const users = useAssignableUsers();
  const { assign } = useBugWorkflow(bug.id);
  const [owner, setOwner] = useState(bug.owner?.id ?? "");
  const [remarks, setRemarks] = useState("");
  const [expected, setExpected] = useState(toDateInput(bug.expected_closure_date));
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (open) {
      setOwner(bug.owner?.id ?? "");
      setRemarks("");
      setExpected(toDateInput(bug.expected_closure_date));
      setError(undefined);
    }
  }, [open, bug.owner?.id, bug.expected_closure_date]);

  async function submit() {
    if (!owner) return setError("Choose an owner.");
    await assign.mutateAsync({
      owner, remarks, expected_closure_date: expected || null,
    });
    onOpenChange(false);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={bug.owner ? "Reassign bug" : "Assign bug"}
      description={
        bug.owner
          ? `${bug.bug_no} is currently owned by ${bug.owner.name}. Reassigning is recorded in the assignment history.`
          : `${bug.bug_no} — assigning an owner also moves the bug to Assigned.`
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} loading={assign.isPending}>
            {bug.owner ? "Reassign" : "Assign"}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="assign-owner" required>Owner</Label>
          <Select id="assign-owner" value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Select a developer…</option>
            {(users.data ?? []).map((user) => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </Select>
          <FieldError message={error} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="assign-expected">Expected closure date</Label>
          <Input id="assign-expected" type="date" value={expected}
                 onChange={(e) => setExpected(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="assign-remarks">Remarks</Label>
          <Textarea id="assign-remarks" rows={2} value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Context for the owner" />
        </div>
      </div>
    </Modal>
  );
}

/* ---- EMAIL BUG ROUTING ---- */
export function CompleteAssignmentDialog({ bug, open, onOpenChange }: BaseProps) {
  const queryClient = useQueryClient();
  const users = useAssignableUsers();
  const projects = useProjects();
  const priorities = usePriorities();
  const severities = useSeverities();
  const departments = useDepartments();
  const sites = useSites();
  const [project, setProject] = useState(bug.project?.id ?? "");
  const [module, setModule] = useState(bug.module?.id ?? "");
  const [submodule, setSubmodule] = useState(bug.submodule?.id ?? "");
  const [priority, setPriority] = useState(bug.priority?.id ?? "");
  const [severity, setSeverity] = useState(bug.severity?.id ?? "");
  const [environment, setEnvironment] = useState(bug.environment ?? "PRODUCTION");
  const [department, setDepartment] = useState(bug.department?.id ?? "");
  const [site, setSite] = useState(bug.site?.id ?? "");
  const [owner, setOwner] = useState(bug.owner?.id ?? "");
  const [expected, setExpected] = useState(toDateInput(bug.expected_closure_date));
  const modules = useModules(project);
  const submodules = useSubmodules(module);

  useEffect(() => {
    if (!open) return;
    setProject(bug.project?.id ?? ""); setModule(bug.module?.id ?? "");
    setSubmodule(bug.submodule?.id ?? ""); setPriority(bug.priority?.id ?? "");
    setSeverity(bug.severity?.id ?? ""); setEnvironment((bug.environment ?? "PRODUCTION") as typeof environment);
    setDepartment(bug.department?.id ?? ""); setSite(bug.site?.id ?? "");
    setOwner(bug.owner?.id ?? ""); setExpected(toDateInput(bug.expected_closure_date));
  }, [open, bug]);

  const mutation = useMutation({
    mutationFn: () => bugApi.completeAssignment(bug.id, {
      project, module: module || null, submodule: submodule || null,
      priority, severity, environment, department: department || null,
      site: site || null, owner, expected_closure_date: expected || null,
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bugs.detail(bug.id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.bugs.all });
      toast.success("Bug routing saved"); onOpenChange(false);
    },
    onError: () => toast.error("Unable to save assignment fields"),
  });

  const select = (label: string, value: string, set: (v: string) => void,
                  options: { id: string; name: string }[], required = false) => (
    <div className="space-y-1"><Label required={required}>{label}</Label>
      <Select value={value} onChange={(e) => set(e.target.value)}>
        <option value="">Select…</option>{options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </Select>
    </div>
  );

  return <Modal open={open} onOpenChange={onOpenChange} title="Assign email bug"
    description="Complete routing fields before work starts."
    footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
      <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>Save and assign</Button></>}>
    <div className="grid gap-3 sm:grid-cols-2">
      {select("Project", project, setProject, projects.data ?? [], true)}
      {select("Module", module, (v) => { setModule(v); setSubmodule(""); }, modules.data ?? [])}
      {select("Submodule", submodule, setSubmodule, submodules.data ?? [])}
      {select("Priority", priority, setPriority, priorities.data ?? [], true)}
      {select("Severity", severity, setSeverity, severities.data ?? [], true)}
      <div className="space-y-1"><Label>Environment</Label><Select value={environment} onChange={(e) => setEnvironment(e.target.value as typeof environment)}>
        {ENVIRONMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select></div>
      {select("Department", department, setDepartment, departments.data ?? [])}
      {select("Site", site, setSite, sites.data ?? [])}
      {select("Owner", owner, setOwner, users.data ?? [], true)}
      <div className="space-y-1"><Label>Expected closure</Label><Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} /></div>
    </div>
  </Modal>;
}

/* ---- STATUS CHANGE (spec 29, 30) ----
   Only transitions the backend allows are offered, and they come from the
   backend itself via bug.allowed_transitions, so this list cannot drift from
   the authoritative state machine. */
export function StatusDialog({ bug, open, onOpenChange }: BaseProps) {
  const { changeStatus } = useBugWorkflow(bug.id);
  const [status, setStatus] = useState<BugStatus | "">("");
  const [remarks, setRemarks] = useState("");
  const [holdReason, setHoldReason] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setStatus("");
      setRemarks("");
      setHoldReason("");
      setRejectionReason("");
      setErrors({});
    }
  }, [open]);

  async function submit() {
    if (!status) return setErrors({ status: "Choose a status." });
    try {
      await changeStatus.mutateAsync({
        status,
        remarks,
        ...(status === "ON_HOLD" ? { hold_reason: holdReason } : {}),
        ...(status === "REJECTED" ? { rejection_reason: rejectionReason } : {}),
      });
      onOpenChange(false);
    } catch (error) {
      const { apiFieldErrors } = await import("@/api/client");
      setErrors(apiFieldErrors(error));
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Update status"
      description={`${bug.bug_no} is currently ${bug.status_label}.`}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} loading={changeStatus.isPending}>Update status</Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div className="space-y-2">
          <Label required>Choose the next status</Label>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="New status">
            {bug.allowed_transitions.map((option) => (
              <button key={option.value} type="button" role="radio" aria-checked={status === option.value}
                onClick={() => setStatus(option.value)}
                className={`rounded-xl border px-4 py-3 text-left transition-colors ${status === option.value ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-[var(--border)] hover:bg-[var(--secondary)]"}`}>
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">Move from {bug.status_label}</span>
              </button>
            ))}
          </div>
          {bug.allowed_transitions.length === 0 ? (
            <p className="text-[12px] text-[var(--muted-foreground)]">
              This bug is in a final state and cannot move further.
            </p>
          ) : null}
          <FieldError message={errors.status} />
        </div>

        {status === "ON_HOLD" ? (
          <div className="space-y-1.5">
            <Label htmlFor="hold-reason" required>Hold reason</Label>
            <Textarea id="hold-reason" rows={2} value={holdReason}
                      onChange={(e) => setHoldReason(e.target.value)} />
            <FieldError message={errors.hold_reason} />
          </div>
        ) : null}

        {status === "REJECTED" ? (
          <div className="space-y-1.5">
            <Label htmlFor="rejection-reason" required>Rejection reason</Label>
            <Textarea id="rejection-reason" rows={2} value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)} />
            <FieldError message={errors.rejection_reason} />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="status-remarks">Remarks</Label>
          <Textarea id="status-remarks" rows={2} value={remarks}
                    onChange={(e) => setRemarks(e.target.value)} />
        </div>

        {Object.keys(errors).filter((k) => !["status", "hold_reason", "rejection_reason"].includes(k)).length > 0 ? (
          <div className="rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 p-3">
            <p className="mb-1 text-[13px] font-medium text-[var(--destructive)]">
              This transition needs more information:
            </p>
            <ul className="list-inside list-disc text-[12px] text-[var(--destructive)]">
              {Object.entries(errors)
                .filter(([k]) => !["status", "hold_reason", "rejection_reason"].includes(k))
                .map(([field, message]) => <li key={field}>{message}</li>)}
            </ul>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

/* ---- TESTING (spec 30) ---- */
export function TestingDialog({ bug, open, onOpenChange }: BaseProps) {
  const { recordTest } = useBugWorkflow(bug.id);
  const [result, setResult] = useState("PASSED");
  const [remarks, setRemarks] = useState("");

  useEffect(() => { if (open) { setResult("PASSED"); setRemarks(""); } }, [open]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Record test result"
      description={`${bug.bug_no} — a failed test returns the bug to In Progress.`}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={async () => {
              await recordTest.mutateAsync({ test_result: result, test_remarks: remarks });
              onOpenChange(false);
            }}
            loading={recordTest.isPending}
          >
            Record result
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div className="space-y-2">
          <Label required>Verification result</Label>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Test result">
            {["PASSED", "FAILED", "BLOCKED"].map((value) => (
              <button key={value} type="button" role="radio" aria-checked={result === value}
                onClick={() => setResult(value)}
                className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-colors ${result === value ? "border-[var(--primary)] bg-[var(--primary)]/10" : "border-[var(--border)] hover:bg-[var(--secondary)]"}`}>
                {value === "PASSED" ? "✓ Passed" : value === "FAILED" ? "✕ Failed" : "◷ Blocked"}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="test-remarks">Test remarks</Label>
          <Textarea id="test-remarks" rows={3} value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="What was tested, and what was observed?" />
        </div>
      </div>
    </Modal>
  );
}

/* ---- RESOLVE (spec 30) ---- */
export function ResolveDialog({ bug, open, onOpenChange }: BaseProps) {
  const { resolve } = useBugWorkflow(bug.id);
  const rootCauseTypes = useRootCauseTypes();
  const [rootCauseType, setRootCauseType] = useState(bug.root_cause_type?.id ?? "");
  const [rootCause, setRootCause] = useState(bug.root_cause);
  const [resolution, setResolution] = useState(bug.resolution);
  const [resolvedDate, setResolvedDate] = useState(toDateInput(bug.resolved_date) || todayIso());
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit() {
    const next: Record<string, string> = {};
    if (!rootCause.trim()) next.root_cause = "Root cause is required.";
    if (!resolution.trim()) next.resolution = "Resolution is required.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    await resolve.mutateAsync({
      root_cause: rootCause,
      resolution,
      root_cause_type: rootCauseType || undefined,
      resolved_date: resolvedDate,
    });
    onOpenChange(false);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Resolve bug"
      description={`${bug.bug_no} — root cause and resolution are required before resolving.`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} loading={resolve.isPending}>Resolve</Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <div className="space-y-1.5">
          <Label htmlFor="rc-type">Root cause category</Label>
          <Select id="rc-type" value={rootCauseType} onChange={(e) => setRootCauseType(e.target.value)}>
            <option value="">Select a category…</option>
            {(rootCauseTypes.data ?? []).map((type) => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </Select>
          <p className="text-[11px] text-[var(--muted-foreground)]">
            Drives the Root Cause Analysis report.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rc-detail" required>Root cause</Label>
          <Textarea id="rc-detail" rows={3} value={rootCause}
                    onChange={(e) => setRootCause(e.target.value)}
                    placeholder="Why did this happen?" />
          <FieldError message={errors.root_cause} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="resolution" required>Resolution</Label>
          <Textarea id="resolution" rows={3} value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    placeholder="Describe the fix that was applied." />
          <FieldError message={errors.resolution} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="resolved-date" required>Resolved date</Label>
          <Input id="resolved-date" type="date" value={resolvedDate}
                 onChange={(e) => setResolvedDate(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

/* ---- CLOSE (spec 30) ----
   The six required fields are listed up front rather than discovered one at a
   time. */
export function CloseDialog({ bug, open, onOpenChange }: BaseProps) {
  const { close } = useBugWorkflow(bug.id);
  const [closureRemarks, setClosureRemarks] = useState("");
  const [verification, setVerification] = useState(bug.verification_result || "PASSED");
  const [closedDate, setClosedDate] = useState(todayIso());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const missing: string[] = [];
  if (!bug.root_cause) missing.push("Root cause");
  if (!bug.resolution) missing.push("Resolution");

  async function submit() {
    if (!closureRemarks.trim()) return setErrors({ closure_remarks: "Closure remarks are required." });
    try {
      await close.mutateAsync({
        closure_remarks: closureRemarks,
        verification_result: verification,
        closed_date: closedDate,
      });
      onOpenChange(false);
    } catch (error) {
      const { apiFieldErrors } = await import("@/api/client");
      setErrors(apiFieldErrors(error));
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Close bug"
      description={`${bug.bug_no} — closure is recorded permanently and requires complete information.`}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} loading={close.isPending} disabled={missing.length > 0}>
            Close bug
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        {missing.length > 0 ? (
          <div className="rounded-md border border-[var(--priority-medium-bd)] bg-[var(--priority-medium-bg)] p-3">
            <p className="text-[13px] font-medium text-[var(--priority-medium-fg)]">
              Resolve the bug first
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--priority-medium-fg)]">
              Missing: {missing.join(", ")}. A bug cannot be closed without them.
            </p>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="verification" required>Verification result</Label>
          <Select id="verification" value={verification}
                  onChange={(e) => setVerification(e.target.value as typeof verification)}>
            <option value="PASSED">Passed</option>
            <option value="PARTIAL">Partially passed</option>
            <option value="FAILED">Failed</option>
          </Select>
          <FieldError message={errors.verification_result} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="closure-remarks" required>Closure remarks</Label>
          <Textarea id="closure-remarks" rows={3} value={closureRemarks}
                    onChange={(e) => setClosureRemarks(e.target.value)}
                    placeholder="Confirm what was verified, and where." />
          <FieldError message={errors.closure_remarks} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="closed-date" required>Closure date</Label>
          <Input id="closed-date" type="date" value={closedDate}
                 onChange={(e) => setClosedDate(e.target.value)} />
          <FieldError message={errors.closed_date} />
        </div>
      </div>
    </Modal>
  );
}

/* ---- REOPEN (spec 30) ---- */
export function ReopenDialog({ bug, open, onOpenChange }: BaseProps) {
  const { reopen } = useBugWorkflow(bug.id);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => { if (open) { setReason(""); setError(undefined); } }, [open]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Reopen bug"
      description={`${bug.bug_no} — the original closure record is preserved in the history.`}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="destructive"
            loading={reopen.isPending}
            onClick={async () => {
              if (!reason.trim()) return setError("A reopen reason is required.");
              await reopen.mutateAsync({ reopen_reason: reason });
              onOpenChange(false);
            }}
          >
            Reopen bug
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <Label htmlFor="reopen-reason" required>Reopen reason</Label>
        <Textarea id="reopen-reason" rows={3} value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why is this bug being reopened?" />
        <FieldError message={error} />
      </div>
    </Modal>
  );
}
