import * as Tooltip from "@radix-ui/react-tooltip";
import { AlertTriangle, FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

const PREVIEW_TOOLTIP_CLASS = "z-50 max-w-sm rounded-lg border border-sky-400/20 bg-slate-950 px-3 py-2 text-[12px] leading-5 text-white shadow-xl";

export function LedgerText({ value, className, lines = 2 }: { value: string; className?: string; lines?: 1 | 2 }) {
  return <Tooltip.Root delayDuration={180}>
    <Tooltip.Trigger asChild><span tabIndex={0} className={cn("ledger-clamped-text", className)} style={{ WebkitLineClamp: lines }}>{value}</span></Tooltip.Trigger>
    <Tooltip.Portal><Tooltip.Content className="ledger-text-tooltip" side="top" sideOffset={8} collisionPadding={16}>
      <div className="ledger-tooltip-body">{value}</div><Tooltip.Arrow className="ledger-tooltip-arrow" />
    </Tooltip.Content></Tooltip.Portal>
  </Tooltip.Root>;
}

export function RequestPreview({ value, maxWidth = "max-w-[320px]" }: { value: string; maxWidth?: string }) {
  return (
    <Tooltip.Root delayDuration={120}>
      <Tooltip.Trigger asChild>
        <span tabIndex={0} className={cn("block truncate font-medium", maxWidth)}>{value}</span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="top" align="center" sideOffset={8} collisionPadding={16} className={PREVIEW_TOOLTIP_CLASS}>
          {value}
          <Tooltip.Arrow className="fill-slate-950" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function DescriptionPreview({ value, maxWidth = "max-w-[390px]" }: { value: string; maxWidth?: string }) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text) {
    return (
      <span className="inline-flex min-h-7 items-center rounded-md border border-slate-200/80 bg-slate-50 px-2.5 text-[12px] text-[var(--muted-foreground)] dark:border-slate-700/70 dark:bg-slate-800/60">
        -
      </span>
    );
  }

  return (
    <Tooltip.Root delayDuration={120}>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          className={cn("group inline-flex min-h-7 items-center rounded-md border border-sky-200/80 bg-sky-50/80 px-2.5 text-left text-[12px] font-medium text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition hover:border-sky-300 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-100 dark:hover:bg-sky-500/15", maxWidth)}
          onClick={(event) => event.stopPropagation()}
        >
          <span className="block truncate">{text}</span>
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="top" align="center" sideOffset={8} collisionPadding={16} className={PREVIEW_TOOLTIP_CLASS}>
          {text}
          <Tooltip.Arrow className="fill-slate-950" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export function TicketStatusBadge({ status }: { status: string }) {
  if (status === "REOPENED") {
    return <div className="flex flex-col items-start gap-0.5" title="Reopened and awaiting verification">
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-800 dark:text-amber-200">
        <AlertTriangle className="size-3" aria-hidden />Reopened
      </span>
      <span className="whitespace-nowrap text-[10px] text-amber-700 dark:text-amber-300">Awaiting verification</span>
    </div>;
  }
  if (status === "TESTING") {
    return <div className="flex flex-col items-start gap-0.5" title="Rectified and awaiting verification">
      <span className="inline-flex items-center gap-1 rounded-md border border-teal-500/35 bg-teal-500/10 px-2 py-1 text-[11px] font-semibold text-teal-800 dark:text-teal-200">
        <FlaskConical className="size-3" aria-hidden />Rectified
      </span>
      <span className="whitespace-nowrap text-[10px] text-teal-700 dark:text-teal-300">Awaiting verification</span>
    </div>;
  }
  const tone = status === "PENDING_APPROVAL"
    ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
    : status === "COMPLETED" || status === "CLOSED"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : status === "REJECTED"
        ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
        : "border-[var(--border)] bg-[var(--secondary)] text-[var(--secondary-foreground)]";
  return <span className={cn("inline-flex rounded-md border px-2 py-1 text-[11px] font-medium", tone)}>{status.replaceAll("_", " ")}</span>;
}

/* The work ledger labels stage with a tinted dot-pill and priority with a bar
   glyph, rather than the boxed badges the other tables use. Kept separate so
   those tables are untouched. */
const LEDGER_STAGE_TONE: Record<string, string> = {
  NEW: "ledger-stage-blue", CONFIRMED: "ledger-stage-blue", ASSIGNED: "ledger-stage-blue",
  APPROVED: "ledger-stage-blue", IN_PROGRESS: "ledger-stage-amber", PENDING: "ledger-stage-gray",
  ON_HOLD: "ledger-stage-orange", PENDING_APPROVAL: "ledger-stage-amber",
  NEEDS_REVIEW: "ledger-stage-amber", TESTING: "ledger-stage-violet",
  REOPENED: "ledger-stage-red", RESOLVED: "ledger-stage-green",
  COMPLETED: "ledger-stage-green", CLOSED: "ledger-stage-green", REJECTED: "ledger-stage-red",
};

function titleCase(value: string) {
  const text = value.replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function LedgerStage({ status, label }: { status: string; label?: string }) {
  return (
    <span className={cn("ledger-stage", label === "Under review" ? "ledger-stage-under-review" : LEDGER_STAGE_TONE[status] || "ledger-stage-gray")}>
      <i aria-hidden />{label || titleCase(status)}
    </span>
  );
}

export function LedgerPriority({ code, label }: { code?: string | null; label?: string | null }) {
  if (!label) return null;
  const key = (code || label).toUpperCase();
  const tone = key.startsWith("CRIT") ? "ledger-priority-critical"
    : key.startsWith("HIGH") ? "ledger-priority-high"
      : key.startsWith("MED") ? "ledger-priority-medium" : "ledger-priority-low";
  return <span className={cn("ledger-priority", tone)}><i aria-hidden />{titleCase(label)}</span>;
}
