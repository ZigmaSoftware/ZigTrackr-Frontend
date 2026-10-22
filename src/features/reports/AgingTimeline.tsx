import { AlertTriangle, ArrowRight, Clock, User } from "lucide-react";
import { formatDate } from "@/lib/dates";
import type { BugListRow } from "@/types";

/* The aging timeline.
 *
 * Structure follows the approved reference: a cream header band with a serif
 * heading and KPI figures opposite, then periods down the page, each with a
 * label rail on the left and its bugs on the right joined by a connector
 * line. Drawn entirely with ZigTrackr tokens rather than the reference's own
 * hex values, so it inverts correctly in dark mode.
 *
 * Periods are cut by age in days rather than by the stored aging_band: the
 * point of this view is "what has waited longest", and day ranges say that
 * directly, where a band name needs translating.
 */

interface Period {
  name: string;
  hint: string;
  min: number;
  max: number;
}

const PERIODS: Period[] = [
  { name: "46+ days", hint: "Oldest unresolved", min: 46, max: Infinity },
  { name: "31 – 45 days", hint: "Needs closer review", min: 31, max: 45 },
  { name: "11 – 30 days", hint: "Ageing", min: 11, max: 30 },
  { name: "Last 10 days", hint: "Recently raised", min: 0, max: 10 },
];

/* A bug is "stale" once it reaches this age, drawn amber rather than indigo.
   Inclusive: at 30 days it has been waiting a month, and the KPI reading 0
   beside a list of "30d old" rows is simply wrong. */
const STALE_FROM_DAYS = 30;

export function AgingTimeline({ bugs, totalOpen, averageAge, onOpen }: {
  bugs: BugListRow[];
  totalOpen: number;
  averageAge: number;
  onOpen?: (bug: BugListRow) => void;
}) {
  const groups = PERIODS
    .map((period) => ({
      ...period,
      items: bugs.filter((bug) => {
        const age = Number(bug.age_days ?? 0);
        return age >= period.min && age <= period.max;
      }),
    }))
    .filter((group) => group.items.length > 0);

  const stale = bugs.filter((bug) => Number(bug.age_days ?? 0) >= STALE_FROM_DAYS).length;

  return (
    <section className="zt-aging">
      <header className="zt-aging__head">
        <div>
          <p className="zt-aging__eyebrow">Age-first triage</p>
          <h2 className="zt-aging__title">Aging timeline</h2>
          <p className="zt-aging__lede">
            Bugs that have been waiting longest, with the detail needed to act.
          </p>
        </div>
        <div className="zt-aging__kpis">
          <div className="zt-aging__kpi">
            <strong>{totalOpen}</strong>
            <small>Open bugs</small>
          </div>
          <div className="zt-aging__kpi">
            <strong className="zt-aging__kpi--warn">{stale}</strong>
            <small>{STALE_FROM_DAYS} days or older</small>
          </div>
          <div className="zt-aging__kpi">
            <strong>{averageAge}</strong>
            <small>Average age (days)</small>
          </div>
        </div>
      </header>

      {groups.length === 0 ? (
        <p className="zt-aging__empty">No open bugs. Nothing is ageing.</p>
      ) : groups.map((group) => (
        <div className="zt-aging__period" key={group.name}>
          <div className="zt-aging__rail">
            <strong>{group.name}</strong>
            <small>{group.hint}</small>
            <small className="zt-aging__rail-count">
              {group.items.length} bug{group.items.length === 1 ? "" : "s"}
            </small>
          </div>

          <ol className="zt-aging__events">
            {group.items.map((bug) => {
              const age = Number(bug.age_days ?? 0);
              const isStale = age >= STALE_FROM_DAYS;
              return (
                <li className="zt-aging__event" key={bug.id}>
                  <span className={`zt-aging__dot${isStale ? " stale" : ""}`} aria-hidden />
                  <div className="zt-aging__body">
                    <div className="zt-aging__top">
                      <button type="button" className="zt-aging__subject"
                              onClick={() => onOpen?.(bug)}>
                        {bug.title}
                      </button>
                      <span className="zt-aging__ref">{bug.bug_no}</span>
                      {bug.priority ? (
                        <span className="zt-aging__tag">{bug.priority.name}</span>
                      ) : null}
                      {bug.is_overdue ? (
                        <span className="zt-aging__tag danger">
                          <AlertTriangle className="size-[11px]" aria-hidden /> Overdue
                        </span>
                      ) : null}
                    </div>

                    <p className="zt-aging__meta">
                      <span><User className="size-[12px]" aria-hidden />
                        {bug.owner?.name ?? "Unassigned"}</span>
                      <span><Clock className="size-[12px]" aria-hidden />
                        Raised {formatDate(bug.reported_date)}</span>
                      {bug.project ? <span>{bug.project.name}</span> : null}
                      {bug.status_label ? <span>{bug.status_label}</span> : null}
                    </p>
                  </div>

                  <div className="zt-aging__right">
                    <span className={`zt-aging__age${isStale ? " stale" : ""}`}>
                      {age}d old
                    </span>
                    <button type="button" className="zt-aging__open"
                            onClick={() => onOpen?.(bug)}>
                      Open <ArrowRight className="size-[12px]" aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ))}

      <footer className="zt-aging__foot">
        Age counts from the reported date and is not the same as an SLA breach.
        {bugs.length < totalOpen
          ? ` Showing the ${bugs.length} oldest of ${totalOpen} open bugs.`
          : ""}
      </footer>
    </section>
  );
}
