import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as Tabs from "@radix-ui/react-tabs";
import {
  CheckCircle2, Clock, FlaskConical, MessageSquarePlus, Paperclip, RotateCcw,
  UserCheck, Wrench, XCircle,
} from "lucide-react";
import { bugApi } from "@/api/services";
import { queryKeys } from "@/api/queryKeys";
import { useAuth } from "@/features/auth/AuthContext";
import { PageHeader } from "@/components/common/PageHeader";
import { Button, Card, Skeleton } from "@/components/ui/primitives";
import { ErrorState } from "@/components/feedback/states";
import {
  AgeCell, OverdueBadge, PriorityBadge, SeverityBadge, StatusBadge,
} from "@/components/common/badges";
import { AddUpdateDialog } from "@/features/bugs/dialogs/AddUpdateDialog";
import {
  AssignDialog, CloseDialog, ReopenDialog, ResolveDialog, StatusDialog, TestingDialog,
  CompleteAssignmentDialog,
} from "@/features/bugs/dialogs/WorkflowDialogs";
import { BugOverviewTab } from "@/features/bugs/tabs/BugOverviewTab";
import { BugUpdatesTab } from "@/features/bugs/tabs/BugUpdatesTab";
import { BugTimelineTab } from "@/features/bugs/tabs/BugTimelineTab";
import { BugAttachmentsTab } from "@/features/bugs/tabs/BugAttachmentsTab";
import { formatDate } from "@/lib/dates";

type DialogKind = "assign" | "complete-assignment" | "status" | "testing" | "resolve" | "close" | "reopen" | "update" | null;

export function BugDetailPage() {
  const { bugId = "" } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialog, setDialog] = useState<DialogKind>(
    (searchParams.get("action") as DialogKind) ?? null,
  );

  const { data: bug, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.bugs.detail(bugId),
    queryFn: () => bugApi.detail(bugId),
    enabled: Boolean(bugId),
  });

  function closeDialog() {
    setDialog(null);
    if (searchParams.has("action")) {
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
  }

  if (isLoading) {
    return (
      <>
        <Skeleton className="mb-4 h-8 w-80" />
        <Card className="p-5">
          <Skeleton className="h-5 w-full max-w-lg" />
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-14" />)}
          </div>
        </Card>
      </>
    );
  }

  if (isError || !bug) {
    return (
      <Card>
        <ErrorState
          title="Unable to load this bug"
          description="It may have been removed, or you may not have access to it."
          onRetry={() => refetch()}
        />
      </Card>
    );
  }

  const canAct = bug.can_mutate && can("bugs.bug.change_status");
  const isTerminal = bug.status === "CLOSED" || bug.status === "REJECTED";
  // Resolve/Close/Reopen are dedicated action endpoints, not raw
  // POST /status/ calls, but each one still lands on a specific target status
  // that the backend's allowed_transitions already enumerates for the
  // current status -- checking membership here is what keeps the button
  // list from silently diverging from the state machine again.
  const canReach = (target: string) =>
    bug.allowed_transitions.some((transition) => transition.value === target);

  return (
    <>
      <PageHeader
        title={`${bug.bug_no} — ${bug.title}`}
        breadcrumbs={[
          { label: "Bug Management", to: "/bugs" },
          { label: bug.bug_no },
        ]}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>Back</Button>
        }
      />

      {/* ---- HEADER SUMMARY (spec 27) ---- */}
      <Card className="mb-4 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-gradient-to-r from-sky-500/10 via-[var(--card)] to-emerald-500/5 px-5 py-4">
          <StatusBadge status={bug.status} label={bug.status_label} />
          {bug.priority ? <PriorityBadge code={bug.priority.code} label={bug.priority.name} /> : null}
          {bug.severity ? <SeverityBadge code={bug.severity.code} label={bug.severity.name} /> : null}
          {bug.is_overdue ? <OverdueBadge days={bug.overdue_days} /> : null}
          {bug.reopen_count > 0 ? (
            <span className="zbadge" style={{
              ["--zbadge-fg" as string]: "var(--status-reopened-fg)",
              ["--zbadge-bg" as string]: "var(--status-reopened-bg)",
              ["--zbadge-bd" as string]: "var(--status-reopened-bd)",
              ["--zbadge-solid" as string]: "var(--status-reopened-solid)",
            }}>
              <RotateCcw className="size-3" aria-hidden /> Reopened {bug.reopen_count}×
            </span>
          ) : null}
        </div>

        <dl className="grid grid-cols-2 gap-px bg-[var(--border)] sm:grid-cols-4">
          <Fact label="Owner" value={bug.owner?.name ?? "Unassigned"} />
          <Fact label="Expected closure" value={formatDate(bug.expected_closure_date)} />
          <Fact label="Age" value={<AgeCell days={bug.age_days} band={bug.aging_band} />} />
          <Fact label="Reported by" value={bug.reported_by?.name ?? "—"} />
        </dl>

        {/* ---- ACTION BAR ----
            Actions follow the backend's allowed_transitions, so the UI can
            never offer a move the state machine would reject.

            Resolve/Close/Reopen check membership in allowed_transitions
            directly rather than re-stating "which status can this happen
            from" as a second, separately-maintained list -- that second list
            is exactly what drifted before: Resolve showed while IN_PROGRESS
            (spec 29 only allows Testing -> Resolved), so clicking it always
            hit a 409 with no visible cause. Deriving from the same array the
            backend already computes makes that drift impossible to reproduce,
            rather than merely fixing today's instance of it. */}
        {canAct ? (
          <div className="border-t border-[var(--border)] px-5 py-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Workflow actions</p>
                <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">{bug.owner?.name ? `Assigned to ${bug.owner.name}` : "Waiting for an owner"}</p>
              </div>
              <span className="text-xs text-[var(--muted-foreground)]">{bug.allowed_transitions.length} available status {bug.allowed_transitions.length === 1 ? "move" : "moves"}</span>
            </div>
            <div className="flex flex-wrap gap-2">
            {can("bugs.bug.assign") && !isTerminal ? (
              <Button variant="outline" size="sm" onClick={() => setDialog(
                !bug.project || !bug.priority || !bug.severity ? "complete-assignment" : "assign"
              )}>
                <UserCheck /> {bug.owner ? "Reassign" : "Assign"}
              </Button>
            ) : null}

            {can("bugs.update.add") && !isTerminal ? (
              <Button variant="outline" size="sm" onClick={() => setDialog("update")}>
                <MessageSquarePlus /> Add update
              </Button>
            ) : null}

            {bug.allowed_transitions.length > 0 ? (
              <Button size="sm" onClick={() => setDialog("status")}>
                <Clock /> Change status
              </Button>
            ) : null}

            {/* Record Test is a precondition check, not a transition target:
                Testing is the bug's *current* state while this action runs,
                not a destination in allowed_transitions, so it stays a direct
                status check. */}
            {can("bugs.bug.test") && bug.status === "TESTING" ? (
              <Button size="sm" onClick={() => setDialog("testing")}>
                <FlaskConical /> Record test
              </Button>
            ) : null}

            {can("bugs.bug.resolve") && canReach("RESOLVED") ? (
              <Button variant="outline" size="sm" onClick={() => setDialog("resolve")}>
                <Wrench /> Resolve
              </Button>
            ) : null}

            {can("bugs.bug.close") && canReach("CLOSED") ? (
              <Button size="sm" onClick={() => setDialog("close")}>
                <CheckCircle2 /> Close bug
              </Button>
            ) : null}

            {can("bugs.bug.reopen") && canReach("REOPENED") ? (
              <Button variant="destructive" size="sm" onClick={() => setDialog("reopen")}>
                <RotateCcw /> Reopen
              </Button>
            ) : null}
            </div>
          </div>
        ) : null}
      </Card>

      {!bug.can_mutate && !bug.owner && bug.source_mail_id ? (
        <div className="mb-4 rounded-xl border border-sky-500/25 bg-sky-500/5 px-4 py-3 text-sm">
          This email bug is waiting for assignment. You can review its details now; a team lead or administrator will route it before work begins.
        </div>
      ) : null}

      {/* ---- TABS (spec 27) ---- */}
      <Tabs.Root defaultValue={searchParams.get("tab") ?? "overview"}>
        <Tabs.List className="mb-3 flex gap-1 overflow-x-auto border-b border-[var(--border)]">
          {[
            ["overview", "Overview"],
            ["updates", "Daily Updates"],
            ["timeline", "Activity Timeline"],
            ["attachments", "Attachments"],
          ].map(([value, label]) => (
            <Tabs.Trigger
              key={value}
              value={value}
              className="whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-[13px] font-medium
                         text-[var(--muted-foreground)] transition-colors
                         data-[state=active]:border-[var(--primary)] data-[state=active]:text-[var(--foreground)]"
            >
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="overview"><BugOverviewTab bug={bug} /></Tabs.Content>
        <Tabs.Content value="updates"><BugUpdatesTab bug={bug} /></Tabs.Content>
        <Tabs.Content value="timeline"><BugTimelineTab bugId={bug.id} /></Tabs.Content>
        <Tabs.Content value="attachments"><BugAttachmentsTab bug={bug} /></Tabs.Content>
      </Tabs.Root>

      {/* ---- DIALOGS ---- */}
      <AssignDialog bug={bug} open={dialog === "assign"} onOpenChange={(o) => !o && closeDialog()} />
      <CompleteAssignmentDialog bug={bug} open={dialog === "complete-assignment"} onOpenChange={(o) => !o && closeDialog()} />
      <StatusDialog bug={bug} open={dialog === "status"} onOpenChange={(o) => !o && closeDialog()} />
      <TestingDialog bug={bug} open={dialog === "testing"} onOpenChange={(o) => !o && closeDialog()} />
      <ResolveDialog bug={bug} open={dialog === "resolve"} onOpenChange={(o) => !o && closeDialog()} />
      <CloseDialog bug={bug} open={dialog === "close"} onOpenChange={(o) => !o && closeDialog()} />
      <ReopenDialog bug={bug} open={dialog === "reopen"} onOpenChange={(o) => !o && closeDialog()} />
      {dialog === "update" ? (
        <AddUpdateDialog bugId={bug.id} bugNo={bug.bug_no} open
                         onOpenChange={(o) => !o && closeDialog()} />
      ) : null}
    </>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-[var(--card)] px-4 py-2.5">
      <dt className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">{label}</dt>
      <dd className="mt-0.5 truncate text-[13px] font-medium">{value}</dd>
    </div>
  );
}
