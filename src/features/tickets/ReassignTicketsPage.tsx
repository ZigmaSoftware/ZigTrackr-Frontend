import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListFilter, UserRoundCog } from "lucide-react";
import { toast } from "sonner";
import { ticketApi } from "@/api/services";
import { apiErrorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable, TruncatedCell, type Column } from "@/components/tables/DataTable";
import { Pagination } from "@/components/tables/Pagination";
import { Modal } from "@/components/feedback/Modal";
import { ErrorState } from "@/components/feedback/states";
import { Button, Card, IconButton, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { useAssignableUsers, useModules, usePriorities, useProjects, useSeverities, useSubmodules } from "@/hooks/useMasters";
import type { SupportTicketRow } from "@/types";
import { DescriptionPreview, RequestPreview, TicketStatusBadge } from "@/features/tickets/TicketTableCells";

function TypeBadge({ type }: { type: string }) {
  const tone = type === "BUG" ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
    : type === "SERVICE_REQUEST" ? "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
      : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium", tone)}>{type.replaceAll("_", " ")}</span>;
}

function SourceBadge({ source }: { source: string }) {
  return <span className="inline-flex rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-300">
    {source === "EMAIL" ? "Email" : source.replaceAll("_", " ")}
  </span>;
}

const columns = (onChoose: (row: SupportTicketRow) => void): Column<SupportTicketRow>[] => [
  { key: "reference", header: "Ticket", sortable: true, width: "w-36", cell: (row) => <span className="font-mono text-[12px] font-semibold text-[var(--primary)]">{row.reference}</span> },
  { key: "title", header: "Request", sortable: true, width: "w-64", cell: (row) => <RequestPreview value={row.title} maxWidth="max-w-[240px]" /> },
  { key: "description", header: "Description", width: "w-72", hideBelow: "xl", cell: (row) => <DescriptionPreview value={row.description} maxWidth="max-w-[280px]" /> },
  { key: "ticket_type", header: "Type", width: "w-40", cell: (row) => <TypeBadge type={row.ticket_type} /> },
  { key: "status", header: "Status", sortable: true, width: "w-40", cell: (row) => <TicketStatusBadge status={row.effective_status || row.status} /> },
  { key: "source", header: "Source", width: "w-24", cell: (row) => <SourceBadge source={row.source} /> },
  { key: "project_module", header: "Project / Module", hideBelow: "xl", cell: (row) =>
    <TruncatedCell maxWidth="max-w-[180px]">{[row.project?.name, row.module?.name].filter(Boolean).join(" / ") || "-"}</TruncatedCell> },
  { key: "owner", header: "Assigned to", width: "w-40", hideBelow: "md", cell: (row) => row.owner?.name ?? "Unassigned" },
  { key: "action", header: "", align: "center", cell: (row) =>
    <IconButton label="Reassign ticket" onClick={() => onChoose(row)}><UserRoundCog /></IconButton> },
];

export function ReassignTicketsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [ordering, setOrdering] = useState("-created_at");
  const [search, setSearch] = useState("");
  const [ticketType, setTicketType] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<SupportTicketRow | null>(null);
  const [blocked, setBlocked] = useState<SupportTicketRow | null>(null);
  const [owner, setOwner] = useState("");
  const [reason, setReason] = useState("");
  const [project, setProject] = useState("");
  const [module, setModule] = useState("");
  const [submodule, setSubmodule] = useState("");
  const [priority, setPriority] = useState("");
  const [severity, setSeverity] = useState("");
  const params = { reassignable: true, limit: pageSize, offset: (page - 1) * pageSize, search, ordering,
    ...(ticketType ? { ticket_type: ticketType } : {}),
    ...(source ? { source } : {}), ...(status ? { status } : {}) };
  const list = useQuery({
    queryKey: queryKeys.tickets.list(params),
    queryFn: () => ticketApi.list(params),
  });
  const users = useAssignableUsers(["DEVELOPER"]);
  const projects = useProjects();
  const modules = useModules(project);
  const submodules = useSubmodules(module);
  const priorities = usePriorities();
  const severities = useSeverities();
  const reassign = useMutation({
    mutationFn: () => ticketApi.reassignWithReason(selected!.id, {
      owner, reason: reason.trim(),
      ...(project ? { project } : {}),
      ...(module ? { module } : {}),
      ...(submodule ? { submodule } : {}),
      ...(priority ? { priority } : {}),
      ...(selected?.ticket_type === "BUG" && severity ? { severity } : {}),
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
    setProject(row.project?.id ?? "");
    setModule(row.module?.id ?? "");
    setSubmodule("");
    setPriority(row.priority?.id ?? "");
    setSeverity("");
  }

  return (
    <>
      <PageHeader title="Reassign Tickets" description="Move tickets to another developer before rectification or when work returns to development."
        breadcrumbs={[{ label: "Ticket Creation" }, { label: "Reassign Tickets" }]} />
      {list.isError ? <ErrorState onRetry={() => list.refetch()} /> : (
        <Card className="overflow-hidden">
          <div className="grid gap-3 border-b border-[var(--border)] p-3 md:grid-cols-[minmax(240px,1fr)_170px_150px_170px]">
            <Input type="search" aria-label="Search assigned tickets" placeholder="Search ticket, sender, subject..." value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
            <Select aria-label="Ticket type" value={ticketType} onChange={(event) => { setTicketType(event.target.value); setPage(1); }}>
              <option value="">All types</option><option value="BUG">Bug</option><option value="SERVICE_REQUEST">Service Request</option><option value="ACCESS_REQUEST">Access Request</option>
            </Select>
            <Select aria-label="Ticket source" value={source} onChange={(event) => { setSource(event.target.value); setPage(1); }}>
              <option value="">All sources</option><option value="EMAIL">Email</option><option value="MANUAL">Manual</option><option value="WHATSAPP">WhatsApp</option>
            </Select>
            <div className="flex gap-2">
              <Select aria-label="Ticket status" className="min-w-0 flex-1" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
                <option value="">All statuses</option>
                <option value="NEW">New</option><option value="CONFIRMED">Confirmed</option>
                <option value="ASSIGNED">Assigned</option><option value="IN_PROGRESS">In Progress</option>
                <option value="PENDING">Pending</option><option value="ON_HOLD">On Hold</option>
                <option value="REOPENED">Reopened</option>
                <option value="PENDING_APPROVAL">Pending Approval</option><option value="APPROVED">Approved</option>
              </Select>
              <Button variant="outline" size="sm" title="Clear filters" aria-label="Clear filters" onClick={() => { setSearch(""); setTicketType(""); setSource(""); setStatus(""); setPage(1); }}>
                <ListFilter /> <span className="hidden lg:inline">Clear</span>
              </Button>
            </div>
          </div>
          <DataTable columns={columns(choose)} rows={list.data?.results ?? []}
            rowKey={(row) => row.id} isLoading={list.isLoading} ordering={ordering}
            onOrderingChange={(value) => { setOrdering(value); setPage(1); }}
            emptyTitle="No reassignable tickets" />
          <Pagination page={page} totalPages={list.data?.total_pages ?? 1}
            count={list.data?.count ?? 0} pageSize={pageSize}
            onPageChange={setPage} onPageSizeChange={(value) => { setPageSize(value); setPage(1); }} />
        </Card>
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
                {(users.data ?? []).filter((user) => user.id !== selected.owner?.id).map((user) =>
                  <option key={user.id} value={user.id}>{user.name}</option>)}</Select></div>
            <div><Label htmlFor="new-project">Project</Label><Select id="new-project" value={project}
              onChange={(event) => { setProject(event.target.value); setModule(""); setSubmodule(""); }}>
              <option value="">Keep current</option>{(projects.data ?? []).map((row) =>
                <option key={row.id} value={row.id}>{row.name}</option>)}</Select></div>
            <div><Label htmlFor="new-module">Module</Label><Select id="new-module" value={module}
              onChange={(event) => { setModule(event.target.value); setSubmodule(""); }}>
              <option value="">Keep current</option>{(modules.data ?? []).map((row) =>
                <option key={row.id} value={row.id}>{row.name}</option>)}</Select></div>
            <div><Label htmlFor="new-submodule">Submodule</Label><Select id="new-submodule" value={submodule}
              onChange={(event) => setSubmodule(event.target.value)}>
              <option value="">Keep current</option>{(submodules.data ?? []).map((row) =>
                <option key={row.id} value={row.id}>{row.name}</option>)}</Select></div>
            <div><Label htmlFor="new-priority">Priority</Label><Select id="new-priority" value={priority}
              onChange={(event) => setPriority(event.target.value)}>
              <option value="">Keep current</option>{(priorities.data ?? []).map((row) =>
                <option key={row.id} value={row.id}>{row.name}</option>)}</Select></div>
            {selected.ticket_type === "BUG" ? <div><Label htmlFor="new-severity">Severity</Label>
              <Select id="new-severity" value={severity} onChange={(event) => setSeverity(event.target.value)}>
                <option value="">Keep current</option>{(severities.data ?? []).map((row) =>
                  <option key={row.id} value={row.id}>{row.name}</option>)}</Select></div> : null}
            <div className="sm:col-span-2"><Label htmlFor="reassign-reason" required>Reassignment reason</Label>
              <Textarea id="reassign-reason" value={reason} onChange={(event) => setReason(event.target.value)} /></div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
