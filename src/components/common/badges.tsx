import type { CSSProperties } from "react";
import {
  AlertTriangle, Archive, Ban, ChevronDown, ChevronsUp, ChevronUp, CircleDot,
  CheckCircle2, FlaskConical, Info, Minus, Palette, PauseCircle, PlayCircle,
  Plus, RotateCcw, UserCheck, XCircle, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgingBand, BugStatus, PriorityCode, SeverityCode } from "@/types";

/* ---- ONE BADGE, THREE DOMAINS ----
   Status, priority and severity are the same visual pattern, so they share one
   implementation (spec 3 forbids duplicating a repeated pattern). The colours
   arrive as CSS variables named by domain and token, which means adding a
   status is four CSS variables and a map entry -- no component change.

   Every badge shows an icon or a dot alongside its text: spec 49 forbids using
   colour as the only carrier of meaning. */

type BadgeDomain = "status" | "priority" | "severity";

interface TokenBadgeProps {
  domain: BadgeDomain;
  token: string;
  label: string;
  icon?: LucideIcon;
  showDot?: boolean;
  className?: string;
  title?: string;
}

function TokenBadge({
  domain, token, label, icon: Icon, showDot = true, className, title,
}: TokenBadgeProps) {
  const style = {
    "--zbadge-fg": `var(--${domain}-${token}-fg)`,
    "--zbadge-bg": `var(--${domain}-${token}-bg)`,
    "--zbadge-bd": `var(--${domain}-${token}-bd)`,
    "--zbadge-solid": `var(--${domain}-${token}-solid)`,
  } as CSSProperties;

  return (
    <span className={cn("zbadge", className)} style={style} title={title ?? label}>
      {Icon ? <Icon className="size-3" aria-hidden /> : showDot ? <span className="zbadge-dot" aria-hidden /> : null}
      {label}
    </span>
  );
}

/* ---- STATUS (spec 4) ---- */
const STATUS_META: Record<BugStatus, { token: string; label: string; icon: LucideIcon }> = {
  NEW: { token: "new", label: "New", icon: Plus },
  ASSIGNED: { token: "assigned", label: "Assigned", icon: UserCheck },
  IN_PROGRESS: { token: "inprogress", label: "In Progress", icon: PlayCircle },
  TESTING: { token: "testing", label: "Testing", icon: FlaskConical },
  ON_HOLD: { token: "onhold", label: "On Hold", icon: PauseCircle },
  RESOLVED: { token: "resolved", label: "Resolved", icon: CheckCircle2 },
  CLOSED: { token: "closed", label: "Closed", icon: Archive },
  REOPENED: { token: "reopened", label: "Reopened", icon: RotateCcw },
  REJECTED: { token: "rejected", label: "Rejected", icon: XCircle },
};

export function StatusBadge({
  status, label, showIcon = true, className,
}: { status: BugStatus; label?: string; showIcon?: boolean; className?: string }) {
  const meta = STATUS_META[status] ?? { token: "onhold", label: status, icon: CircleDot };
  return (
    <TokenBadge
      domain="status"
      token={meta.token}
      label={label ?? meta.label}
      icon={showIcon ? meta.icon : undefined}
      showDot={!showIcon}
      className={className}
      title={`Status: ${label ?? meta.label}`}
    />
  );
}

/* ---- PRIORITY (spec 7) ---- */
const PRIORITY_META: Record<string, { token: string; icon: LucideIcon }> = {
  CRITICAL: { token: "critical", icon: ChevronsUp },
  HIGH: { token: "high", icon: ChevronUp },
  MEDIUM: { token: "medium", icon: Minus },
  LOW: { token: "low", icon: ChevronDown },
};

export function PriorityBadge({
  code, label, className,
}: { code: PriorityCode | string; label?: string; className?: string }) {
  const meta = PRIORITY_META[code] ?? { token: "medium", icon: Minus };
  const text = label ?? code;
  return (
    <TokenBadge
      domain="priority"
      token={meta.token}
      label={text}
      icon={meta.icon}
      className={className}
      title={`Priority: ${text}`}
    />
  );
}

/* ---- SEVERITY (spec 8) ----
   A distinct glyph set from priority, because spec 8 insists the two are
   separate concepts and they must not be mistaken for one another. */
const SEVERITY_META: Record<string, { token: string; icon: LucideIcon }> = {
  BLOCKER: { token: "blocker", icon: Ban },
  CRITICAL: { token: "critical", icon: AlertTriangle },
  MAJOR: { token: "major", icon: AlertTriangle },
  MINOR: { token: "minor", icon: Info },
  COSMETIC: { token: "cosmetic", icon: Palette },
};

export function SeverityBadge({
  code, label, className,
}: { code: SeverityCode | string; label?: string; className?: string }) {
  const meta = SEVERITY_META[code] ?? { token: "minor", icon: Info };
  const text = label ?? code;
  return (
    <TokenBadge
      domain="severity"
      token={meta.token}
      label={text}
      icon={meta.icon}
      className={className}
      title={`Severity: ${text}`}
    />
  );
}

/* ---- OVERDUE (spec 12) ----
   Professional but unmistakable: an icon plus a day count, never a colour
   alone. */
export function OverdueBadge({ days, className }: { days: number; className?: string }) {
  if (days <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-medium",
        "border-[var(--priority-critical-bd)] bg-[var(--priority-critical-bg)] text-[var(--priority-critical-fg)]",
        className,
      )}
      title={`Overdue by ${days} day${days === 1 ? "" : "s"}`}
    >
      <AlertTriangle className="size-3" aria-hidden />
      {days}d late
    </span>
  );
}

/* ---- AGING (spec 13) ---- */
const AGING_LABEL: Record<AgingBand, string> = {
  NORMAL: "Normal",
  ATTENTION: "Attention",
  WARNING: "Warning",
  CRITICAL: "Critical",
};

export function AgeCell({ days, band }: { days: number; band: AgingBand }) {
  const token = band.toLowerCase();
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[13px] tabular-nums"
      title={`${days} day${days === 1 ? "" : "s"} old — ${AGING_LABEL[band] ?? band}`}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: `var(--aging-${token}-fg)` }}
        aria-hidden
      />
      {days}d
    </span>
  );
}

/* ---- UPDATE PENDING (spec 11) ---- */
export function UpdatePendingBadge({ days }: { days: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-[var(--priority-medium-bd)]
                 bg-[var(--priority-medium-bg)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--priority-medium-fg)]"
      title={`No update for ${days} day${days === 1 ? "" : "s"}`}
    >
      <AlertTriangle className="size-3" aria-hidden />
      Pending
    </span>
  );
}
