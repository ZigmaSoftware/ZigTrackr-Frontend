import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ListFilter, UserRoundCog } from "lucide-react";
import { toast } from "sonner";
import { ticketApi } from "@/api/services";
import { apiErrorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { DataTable, type Column } from "@/components/tables/DataTable";
import { Modal } from "@/components/feedback/Modal";
import { ErrorState } from "@/components/feedback/states";
import { Button, Card, IconButton, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { cn, initials } from "@/lib/utils";
import { useAssignableUsers, useCompanies } from "@/hooks/useMasters";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { useAuth } from "@/features/auth/AuthContext";
import type { SupportTicketRow } from "@/types";
import { LedgerPlain, LedgerPriority, LedgerStage, LedgerText } from "@/features/tickets/TicketTableCells";
import { TicketEmailDescription } from "@/features/tickets/TicketEmailDescription";
import { ledgerSource, ledgerType } from "./ticketLedger";
import { TicketLedgerWorkspace } from "./TicketLedgerWorkspace";

/* The reassignable set is defined by policy, not by a stage, so this page
   carries no scope tabs and no summary cards: just filters and the table. */
const REASSIGN_SCOPES: { key: "all"; label: string }[] = [];

const columns = (onChoose: (row: SupportTicketRow) => void): Column<SupportTicketRow>[] => [
  {
    key: "title",
    header: "Request / project",
    sortable: true,
    width: "w-[25%]",
    cell: (row) => (
      <div className="ledger-request">
        <button type="button" className="ledger-request-title" onClick={() => onChoose(row)}>
          <LedgerText value={row.title} />
        </button>
        <div className="ledger-request-meta">
          <span className="font-mono">{row.reference}</span>
          {row.company?.name || row.module?.name
            ? <LedgerText lines={1} value={[row.company?.name, row.module?.name].filter(Boolean).join(" / ")} />
            : null}
        </div>
        <p className="ledger-requester">
          <LedgerPlain lines={1} value={`${row.reported_by_name || row.reported_by?.name || row.reported_by_email || "Unknown requester"}${row.project?.name ? ` / ${row.project.name}` : ""}`} />
        </p>
      </div>
    ),
  },
  {
    key: "description",
    header: "Description",
    width: "w-[23%]",
    cell: (row) => <TicketEmailDescription ticket={row} variant="ledger" />,
  },
  {
    key: "owner",
    header: "Owner / source",
    align: "left",
    width: "w-[17%]",
    cell: (row) => (
      <div className="ledger-person">
        <span className="ledger-avatar" data-tone={(row.owner?.name || "").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4} aria-hidden>{initials(row.owner?.name || "?")}</span>
        <span>
          <strong><LedgerPlain lines={1} value={row.owner?.name || "Unassigned"} /></strong>
          <small><LedgerPlain lines={1} value={`${ledgerSource(row.source)} / ${ledgerType(row.ticket_type)}`} /></small>
        </span>
      </div>
    ),
  },
  {
    key: "status",
    header: "Stage / priority",
    sortable: true,
    align: "center",
    width: "w-[13%]",
    cell: (row) => (
      <div className="ledger-stage-stack">
        <LedgerStage status={row.effective_status || row.status}
          label={(row.effective_status || row.status) === "TESTING" ? "Under review" : undefined} />
        {row.priority ? <LedgerPriority code={row.priority.code} label={row.priority.name} /> : null}
      </div>
    ),
  },
  {
    key: "expected_closure_date",
    header: "Delivery",
    sortable: true,
    align: "center",
    width: "w-[12%]",
    cell: (row) => {
      const due = row.effective_expected_closure_date || row.expected_closure_date;
      return (
        <div className="ledger-stacked">
          {due ? (
            <span className={cn("ledger-due", row.is_overdue && "ledger-due-late")}
              title={row.is_overdue ? `${row.overdue_days}d late` : undefined}>
              <CalendarDays aria-hidden />
              {new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(new Date(`${due}T00:00:00`))}
            </span>
          ) : <span className="text-[var(--muted-foreground)]">—</span>}
          <span className="ledger-age">{row.age_days}d old{row.is_overdue ? " / Past due" : ""}</span>
        </div>
      );
    },
  },
  {
    key: "action",
    header: "Reassign",
    align: "right",
    width: "w-[10%]",
    cell: (row) => (
      <div className="flex items-center justify-end" onClick={(event) => event.stopPropagation()}>
        <Button size="sm" variant="outline" onClick={() => onChoose(row)}>
          <UserRoundCog /> Reassign
        </Button>
      </div>
    ),
  },
];

export function ReassignTicketsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { filters, setFilters, clearFilters } = useUrlFilters({ ordering: "effective_expected_closure_date", limit: 8 });
  const companies = useCompanies();
  const developers = useAssignableUsers(["DEVELOPER"], true);
  const [selected, setSelected] = useState<SupportTicketRow | null>(null);
  const [blocked, setBlocked] = useState<SupportTicketRow | null>(null);
  const [owner, setOwner] = useState("");
  const [reason, setReason] = useState("");
  /* The reassignable set is defined by policy, not by a stage scope, so this
     page carries no ledger_scope: the filters below are the whole selection. */
  /* Empty strings are not "no filter" to django-filter: a blank ticket_type is
     rejected as an invalid choice, which 400s the whole list. Drop them. */
  const params = useMemo(() => {
    const active = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== "" && value !== undefined && value !== null),
    );
    return { ...active, submodule: "reassign", reassignable: true };
  }, [filters]);
  const list = useQuery({
    queryKey: queryKeys.tickets.list(params),
    queryFn: () => ticketApi.list(params),
  });
  const users = useAssignableUsers(["DEVELOPER"]);
  const reassign = useMutation({
    mutationFn: () => ticketApi.reassignWithReason(selected!.id, {
      owner, reason: reason.trim(),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.tickets.all });
      toast.success("Ticket reassigned");
      setSelected(null);
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not reassign ticket.")),
  });

  function choose(row: SupportTicketRow) {
    if (!row.can_reassign) {
      setBlocked(row);
      return;
    }
    setSelected(row);
    setOwner("");
    setReason("");
  }

  return (
    <>
      {list.isError ? <ErrorState onRetry={() => list.refetch()} /> : (
        <TicketLedgerWorkspace
          title="Reassign tickets"
          breadcrumb={["Ticket creation", "Reassign tickets"]}
          description="Move tickets to another developer before rectification or when work returns to development."
          scopes={REASSIGN_SCOPES}
          scope="all"
          counts={{ all: list.data?.count ?? 0 }}
          filters={filters} setFilters={setFilters} resetFilters={clearFilters}
          companies={companies.data ?? []} developers={developers.data ?? []}
          canChooseCompany={Boolean(user?.is_superuser)}
          count={list.data?.count ?? 0}
          page={list.data?.page ?? filters.page}
          totalPages={list.data?.total_pages ?? 1}>
          <DataTable columns={columns(choose)} rows={list.data?.results ?? []} layout="fit" stickyHeader={false}
            rowKey={(row) => row.id} isLoading={list.isLoading} skeletonRows={8}
            onRowClick={(row) => choose(row)}
            emptyTitle="No reassignable tickets"
            emptyDescription="Tickets appear here once they are assigned and still open." />
        </TicketLedgerWorkspace>
      )}

      <Modal open={Boolean(blocked)} onOpenChange={() => setBlocked(null)}
        title={blocked?.effective_status === "CLOSED" ? "This ticket is already closed." : "Reassignment is not available."}
        footer={<Button onClick={() => setBlocked(null)}>Close</Button>}>
        <p className="text-sm text-[var(--muted-foreground)]">{blocked?.reassign_block_reason}</p>
      </Modal>
      <Modal open={Boolean(selected)} onOpenChange={() => setSelected(null)}
        title="Reassign ticket" description={selected?.reference} size="lg"
        footer={<><Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
          <Button loading={reassign.isPending} disabled={!owner || !reason.trim()}
            onClick={() => reassign.mutate()}>Reassign Ticket</Button></>}>
        {selected ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <p className="sm:col-span-2 text-sm"><strong>{selected.title}</strong><br />
              {selected.ticket_type.replaceAll("_", " ")} · {selected.status_label}<br />
              Assigned to {selected.owner?.name ?? "Unassigned"}<br />
              {selected.project?.name ?? "No project"} / {selected.module?.name ?? "No module"}</p>
            <div><Label htmlFor="new-owner" required>New assignee</Label>
              <Select id="new-owner" value={owner} onChange={(event) => setOwner(event.target.value)}>
                <option value="">Select developer</option>
                {(users.data ?? []).filter((user) => user.id !== selected.owner?.id && user.company_id === selected.company?.id).map((user) =>
                  <option key={user.id} value={user.id}>{user.name}</option>)}</Select></div>
            <div className="sm:col-span-2"><Label htmlFor="reassign-reason" required>Reassignment reason</Label>
              <Textarea id="reassign-reason" value={reason} onChange={(event) => setReason(event.target.value)} /></div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
