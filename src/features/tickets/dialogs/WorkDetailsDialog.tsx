import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Save } from "lucide-react";
import { toast } from "sonner";
import { ticketApi } from "@/api/services";
import { apiErrorMessage, apiFieldErrors } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { Modal } from "@/components/feedback/Modal";
import { ErrorState } from "@/components/feedback/states";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { useProjects, useModules, useSubmodules, usePriorities, useSeverities, useDepartments, useSites } from "@/hooks/useMasters";
import type { MasterRow, SupportTicketRow } from "@/types";

const EMPTY = { project: "", module: "", submodule: "", priority: "", severity: "", department: "", site: "", environment: "PRODUCTION", expected_closure_date: "", expected_closure_time: "", title: "", description: "" };
type Draft = typeof EMPTY;

export function WorkDetailsDialog({ ticket, mode, onClose }: {
  ticket: SupportTicketRow | null; mode: "start" | "edit"; onClose: () => void;
}) {
  const client = useQueryClient();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const detail = useQuery({ queryKey: [...queryKeys.tickets.all, "work-details", ticket?.id],
    queryFn: () => ticketApi.detail(ticket!.id), enabled: Boolean(ticket), staleTime: 0,
    refetchOnWindowFocus: false, refetchOnReconnect: false });
  const company = detail.data?.company?.id ?? ticket?.company?.id;
  const projects = useProjects(company);
  const modules = useModules(draft.project);
  const submodules = useSubmodules(draft.module);
  const priorities = usePriorities(company);
  const severities = useSeverities(company);
  const departments = useDepartments(company);
  const sites = useSites(company);
  useEffect(() => {
    const data = detail.data;
    if (!data) return;
    setErrors({});
    setDraft({ project: data.project?.id ?? "", module: data.module?.id ?? "", submodule: data.submodule?.id ?? "",
      priority: data.priority?.id ?? "", severity: data.severity?.id ?? "", department: data.department?.id ?? "",
      site: data.site?.id ?? "", environment: data.environment || "PRODUCTION",
      expected_closure_date: data.effective_expected_closure_date ?? "",
      expected_closure_time: (data.effective_expected_closure_time ?? "").slice(0, 5),
      title: data.title, description: data.description });
  }, [detail.data]);
  const save = useMutation({
    mutationFn: () => {
      const payload = { ...draft, company, ...Object.fromEntries(
        ["project", "module", "submodule", "priority", "severity", "department", "site", "expected_closure_date", "expected_closure_time"].map((key) => [key, draft[key as keyof Draft] || null])) };
      return mode === "start" ? ticketApi.workTransition(ticket!.id, { to_status: "IN_PROGRESS", details: payload })
        : ticketApi.workDetails(ticket!.id, payload);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.tickets.all });
      void client.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      toast.success(mode === "start" ? "Work started" : "Details updated"); onClose();
    },
    onError: (error) => { setErrors(apiFieldErrors(error)); toast.error(apiErrorMessage(error)); },
  });
  function change(key: keyof Draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value,
      ...(key === "project" ? { module: "", submodule: "" } : key === "module" ? { submodule: "" } : {}) }));
  }
  const isBug = ticket?.ticket_type === "BUG";
  const selects: { key: keyof Draft; label: string; rows?: MasterRow[]; required?: boolean; disabled?: boolean }[] = [
    { key: "project", label: "Project", rows: projects.data, required: isBug },
    { key: "module", label: "Module", rows: modules.data, disabled: !draft.project },
    { key: "submodule", label: "Submodule", rows: submodules.data, disabled: !draft.module },
    { key: "priority", label: "Priority", rows: priorities.data, required: isBug },
    { key: "severity", label: "Severity", rows: severities.data, required: isBug },
    { key: "department", label: "Department", rows: departments.data },
    { key: "site", label: "Site / Plant", rows: sites.data },
  ];
  return <Modal open={Boolean(ticket)} onOpenChange={(open) => !open && !save.isPending && onClose()}
    title={mode === "start" ? "Start work" : "Edit work details"} size="lg"
    footer={<><Button variant="outline" disabled={save.isPending} onClick={onClose}>Cancel</Button>
      <Button loading={save.isPending} disabled={!detail.data || detail.isError || !company || !draft.title.trim() || (isBug && (!draft.project || !draft.priority || !draft.severity)) || (mode === "start" && (!draft.expected_closure_date || !draft.expected_closure_time))}
        onClick={() => save.mutate()}>{mode === "start" ? <Play /> : <Save />}{mode === "start" ? "Start work" : "Save changes"}</Button></>}>
    {detail.isError ? <ErrorState onRetry={() => void detail.refetch()} /> : detail.isLoading ? <p role="status">Loading details...</p> : <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-2 border-b border-[var(--border)] pb-3 text-xs text-[var(--muted-foreground)]">
        <span className="font-mono">{ticket?.reference}</span><span>{detail.data?.company?.name}</span>
      </div>
      <div className="space-y-1.5"><Label htmlFor="wd-title" required>Subject</Label>
        <Input id="wd-title" maxLength={255} value={draft.title} onChange={(event) => change("title", event.target.value)} />
        {errors.title && <p className="text-xs text-[var(--destructive)]">{errors.title}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {selects.map(({ key, label, rows, required, disabled }) => <div key={key} className="min-w-0 space-y-1.5">
          <Label htmlFor={`wd-${key}`} required={required}>{label}</Label>
          <Select id={`wd-${key}`} value={draft[key]} disabled={disabled} onChange={(event) => change(key, event.target.value)}>
            <option value="">Select {label.toLowerCase()}</option>
            {(rows ?? []).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </Select>{errors[key] && <p className="text-xs text-[var(--destructive)]">{errors[key]}</p>}
        </div>)}
        <div className="space-y-1.5"><Label htmlFor="wd-environment">Environment</Label>
          <Select id="wd-environment" value={draft.environment} onChange={(event) => change("environment", event.target.value)}>
            <option value="PRODUCTION">Production</option><option value="UAT">UAT</option><option value="STAGING">Staging</option><option value="DEVELOPMENT">Development</option><option value="LOCAL">Local</option>
          </Select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="wd-date" required={mode === "start"}>Expected completion date</Label>
          <Input id="wd-date" type="date" value={draft.expected_closure_date} onChange={(event) => change("expected_closure_date", event.target.value)} />
          {errors.expected_closure_date && <p className="text-xs text-[var(--destructive)]">{errors.expected_closure_date}</p>}
        </div>
        <div className="space-y-1.5"><Label htmlFor="wd-time" required={mode === "start"}>Completion time</Label>
          <Input id="wd-time" type="time" value={draft.expected_closure_time} onChange={(event) => change("expected_closure_time", event.target.value)} />
          {errors.expected_closure_time && <p className="text-xs text-[var(--destructive)]">{errors.expected_closure_time}</p>}
        </div>
      </div>
      <div className="space-y-1.5"><Label htmlFor="wd-description">Description</Label>
        <Textarea id="wd-description" rows={4} value={draft.description} onChange={(event) => change("description", event.target.value)} />
      </div>
    </div>}
  </Modal>;
}
