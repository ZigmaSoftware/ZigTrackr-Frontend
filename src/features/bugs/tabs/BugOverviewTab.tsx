import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/primitives";
import { formatDate, formatDateTime } from "@/lib/dates";
import { useAuth } from "@/features/auth/AuthContext";
import type { BugDetail } from "@/types";

/* ---- OVERVIEW TAB (spec 27) ----
   Redesigned for density: the original layout gave every field -- including
   ones with no value ("Department: —") -- a full labelled row, which on a
   typical bug (no department/site/submodule set) left the side panel mostly
   blank next to a much denser left column. Two changes fix that:

     1. Facts with no value are omitted outright rather than rendered as "—".
        A field worth showing empty ("Department" on a bug that legitimately
        has none) is not the same as a field never filled in during creation;
        the reader loses nothing by not seeing six dashes in a row.
     2. Short label/value pairs share one line (label left, value right)
        instead of stacking label-above-value -- the stacked form is only
        worth its extra height for long or multi-line values. */

export function BugOverviewTab({ bug }: { bug: BugDetail }) {
  const { hasRole } = useAuth();
  /* Same page and route for every role (spec 18 -- one bug domain, no
     duplicated pages). What changes is which card leads the main column:
     a Developer's first job on a ticket is the fix, a Tester's first job
     is verifying it, so each role sees its own next step above the fold
     instead of scrolling past a generic description first. */
  const isTester = hasRole("TESTER");
  const isDeveloper = hasRole("DEVELOPER");

  const classificationFacts: Fact[] = [
    { label: "Project", value: bug.project?.name },
    { label: "Module", value: bug.module?.name },
    { label: "Submodule", value: bug.submodule?.name },
    { label: "Environment", value: bug.environment_label },
    { label: "Department", value: bug.department?.name },
    { label: "Site", value: bug.site?.name },
  ];

  const assignmentFacts: Fact[] = [
    { label: "Owner", value: bug.owner?.name ?? "Unassigned" },
    { label: "Assigned by", value: bug.assigned_by?.name },
    // formatDate/formatDateTime return the literal string "—" for a null
    // input, which reads as truthy to a plain Boolean() check -- gating on
    // the raw field first is what actually keeps an unassigned bug's
    // "Assigned on" row out of the list instead of rendering it as a dash.
    { label: "Assigned on", value: bug.assigned_date ? formatDateTime(bug.assigned_date) : undefined },
    { label: "Reported on", value: formatDate(bug.reported_date) },
  ];

  const latestFacts: Fact[] = [
    { label: "Next action", value: bug.next_action },
    { label: "Updated", value: bug.latest_update_at ? formatDateTime(bug.latest_update_at) : undefined },
  ];

  // Root cause/resolution and verification only render once they exist;
  // empty sections on every new bug would be noise. Kept as variables so
  // each role can place "its" card first without duplicating the markup.
  const fixCard = (bug.root_cause || bug.resolution) ? (
    <Card key="fix">
      <CardHeader><CardTitle>Root cause & resolution</CardTitle></CardHeader>
      <CardBody className="space-y-3">
        {bug.root_cause_type ? (
          <Detail label="Category" value={bug.root_cause_type.name} />
        ) : null}
        {bug.root_cause ? (
          <Detail label="Root cause" value={bug.root_cause} multiline />
        ) : null}
        {bug.resolution ? (
          <Detail label="Resolution" value={bug.resolution} multiline />
        ) : null}
        {bug.resolved_date ? (
          <Detail label="Resolved"
                  value={`${formatDate(bug.resolved_date)}${bug.resolved_by ? ` by ${bug.resolved_by.name}` : ""}`} />
        ) : null}
      </CardBody>
    </Card>
  ) : isDeveloper ? (
    <Card key="fix-empty">
      <CardHeader><CardTitle>Root cause & resolution</CardTitle></CardHeader>
      <CardBody>
        <p className="text-[13px] text-[var(--muted-foreground)]">
          Not recorded yet. Use <span className="font-medium">Resolve</span> once the fix is ready
          to capture the root cause and resolution.
        </p>
      </CardBody>
    </Card>
  ) : null;

  const verificationCard = bug.verification_result ? (
    <Card key="verify">
      <CardHeader><CardTitle>Verification</CardTitle></CardHeader>
      <CardBody className="space-y-3">
        <Detail label="Result" value={bug.verification_result} />
        {bug.tested_by ? <Detail label="Tested by" value={bug.tested_by.name} /> : null}
        {bug.verification_remarks ? (
          <Detail label="Remarks" value={bug.verification_remarks} multiline />
        ) : null}
        {bug.verified_at ? (
          <Detail label="Verified at" value={formatDateTime(bug.verified_at)} />
        ) : null}
      </CardBody>
    </Card>
  ) : isTester && bug.status === "TESTING" ? (
    <Card key="verify-empty">
      <CardHeader><CardTitle>Verification</CardTitle></CardHeader>
      <CardBody>
        <p className="text-[13px] text-[var(--muted-foreground)]">
          Not verified yet. Use <span className="font-medium">Record test</span> above to log the
          result for this bug.
        </p>
      </CardBody>
    </Card>
  ) : null;

  // Developer's next step is the fix, Tester's next step is verifying it --
  // each role sees its own card directly under the description instead of
  // scrolling past the other role's section first.
  const roleOrderedCards = isTester
    ? [verificationCard, fixCard]
    : [fixCard, verificationCard];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader><CardTitle>Description</CardTitle></CardHeader>
          <CardBody>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed">
              {bug.description || "No description provided."}
            </p>
          </CardBody>
        </Card>

        {roleOrderedCards}

        {bug.closure_remarks ? (
          <Card>
            <CardHeader><CardTitle>Closure</CardTitle></CardHeader>
            <CardBody className="space-y-3">
              <Detail label="Closure remarks" value={bug.closure_remarks} multiline />
              <Detail label="Closed"
                      value={`${formatDate(bug.closed_date)}${bug.closed_by ? ` by ${bug.closed_by.name}` : ""}`} />
            </CardBody>
          </Card>
        ) : null}

        {bug.hold_reason ? (
          <Card>
            <CardHeader><CardTitle>Hold reason</CardTitle></CardHeader>
            <CardBody><p className="text-[13px]">{bug.hold_reason}</p></CardBody>
          </Card>
        ) : null}

        {bug.rejection_reason ? (
          <Card>
            <CardHeader><CardTitle>Rejection reason</CardTitle></CardHeader>
            <CardBody><p className="text-[13px]">{bug.rejection_reason}</p></CardBody>
          </Card>
        ) : null}
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <FactList facts={classificationFacts} />
          {bug.source_mail_id ? (
            <div className="border-t border-[var(--border)] px-4 py-2">
              <dt className="text-[12px] text-[var(--muted-foreground)]">Source mail ID</dt>
              <dd className="mt-0.5 break-all font-mono text-[11px]">{bug.source_mail_id}</dd>
            </div>
          ) : null}
        </Card>

        <Card>
          <CardHeader><CardTitle>Assignment</CardTitle></CardHeader>
          <FactList facts={assignmentFacts} />
        </Card>

        {bug.next_action || bug.latest_remarks ? (
          <Card>
            <CardHeader><CardTitle>Latest</CardTitle></CardHeader>
            {bug.latest_remarks ? (
              <CardBody className="border-b border-[var(--border)] pb-3">
                <Detail label="Last remark" value={bug.latest_remarks} multiline />
              </CardBody>
            ) : null}
            <FactList facts={latestFacts} />
          </Card>
        ) : null}
      </div>
    </div>
  );
}

interface Fact {
  label: string;
  /** Omitted from the list entirely when falsy -- no "—" placeholder rows. */
  value?: string | null;
}

/** A compact label/value list: one row per fact, label left and value right
 *  on a single line. This is what replaces the old one-row-per-field stack
 *  in the side panels -- six facts now cost six tight rows instead of six
 *  full label-above-value blocks, and facts with nothing to show are
 *  skipped rather than padded out with a dash. */
function FactList({ facts }: { facts: Fact[] }) {
  const present = facts.filter((fact) => Boolean(fact.value));
  if (present.length === 0) {
    return (
      <CardBody>
        <p className="text-[13px] text-[var(--muted-foreground)]">Nothing recorded yet.</p>
      </CardBody>
    );
  }
  return (
    <dl className="divide-y divide-[var(--border)]">
      {present.map((fact) => (
        <div key={fact.label} className="flex items-baseline justify-between gap-3 px-4 py-2">
          <dt className="shrink-0 text-[12px] text-[var(--muted-foreground)]">{fact.label}</dt>
          <dd className="truncate text-right text-[13px] font-medium" title={fact.value ?? undefined}>
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Detail({
  label, value, multiline,
}: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">{label}</p>
      <p className={multiline ? "mt-0.5 whitespace-pre-wrap text-[13px]" : "mt-0.5 text-[13px]"}>
        {value}
      </p>
    </div>
  );
}
