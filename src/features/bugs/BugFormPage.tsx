import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDown, Save } from "lucide-react";
import { toast } from "sonner";
import { bugApi } from "@/api/services";
import { queryKeys } from "@/api/queryKeys";
import { apiErrorMessage, apiFieldErrors } from "@/api/client";
import {
  useDepartments, useModules, usePriorities, useProjects, useSeverities,
  useSites, useSubmodules,
} from "@/hooks/useMasters";
import { PageHeader } from "@/components/common/PageHeader";
import { Button, Card, CardBody, Input, Label, Select, Textarea } from "@/components/ui/primitives";
import { ENVIRONMENT_OPTIONS } from "@/config/bugPresets";
import { todayIso } from "@/lib/dates";

/* Spec 6 lists 28 fields. Showing all of them at once would be a wall, and
   most are filled later in the workflow anyway, so creation asks only for what
   a reporter actually knows now; the rest sit behind an optional section. */
const schema = z.object({
  project: z.string().min(1, "Select a project"),
  module: z.string().optional(),
  submodule: z.string().optional(),
  title: z.string().min(5, "Give the bug a clear title").max(255),
  description: z.string().min(10, "Describe what happens, and what you expected"),
  priority: z.string().min(1, "Select a priority"),
  severity: z.string().min(1, "Select a severity"),
  environment: z.string(),
  reported_date: z.string().optional(),
  department: z.string().optional(),
  site: z.string().optional(),
  expected_closure_date: z.string().optional(),
});

type Values = z.infer<typeof schema>;

export function BugFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showMore, setShowMore] = useState(false);

  const {
    register, handleSubmit, watch, setValue, setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    // environment/reported_date are seeded here rather than via zod .default(),
    // which would make the resolver's input and output types diverge.
    defaultValues: { environment: "PRODUCTION", reported_date: todayIso() },
  });

  const projectId = watch("project");
  const moduleId = watch("module");

  const projects = useProjects();
  const modules = useModules(projectId);
  const submodules = useSubmodules(moduleId);
  const priorities = usePriorities();
  const severities = useSeverities();
  const departments = useDepartments();
  const sites = useSites();

  /* Clear the child whenever the parent changes, so a stale module from a
     previous project can never be submitted. */
  useEffect(() => { setValue("module", ""); setValue("submodule", ""); }, [projectId, setValue]);
  useEffect(() => { setValue("submodule", ""); }, [moduleId, setValue]);

  const create = useMutation({
    mutationFn: (values: Values) =>
      bugApi.create({
        ...values,
        module: values.module || undefined,
        submodule: values.submodule || undefined,
        department: values.department || undefined,
        site: values.site || undefined,
        expected_closure_date: values.expected_closure_date || undefined,
      }),
    onSuccess: (bug) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bugs.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      toast.success(`${bug.bug_no} created`);
      navigate(`/bugs/detail/${bug.id}`);
    },
    onError: (error) => {
      const fields = apiFieldErrors(error);
      for (const [field, message] of Object.entries(fields)) {
        setError(field as keyof Values, { message });
      }
      toast.error(apiErrorMessage(error, "Unable to create the bug."));
    },
  });

  return (
    <>
      <PageHeader
        title="Report a bug"
        description="The bug number is generated automatically."
        breadcrumbs={[{ label: "Bug Management", to: "/bugs" }, { label: "Create Bug" }]}
      />

      <form onSubmit={handleSubmit((values) => create.mutate(values))} noValidate>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardBody className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="title" required>Bug title</Label>
                <Input id="title" placeholder="Customer approval page not loading"
                       aria-invalid={Boolean(errors.title)} {...register("title")} />
                {errors.title ? <Err>{errors.title.message}</Err> : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description" required>Description</Label>
                <Textarea
                  id="description" rows={6}
                  placeholder={"What happens?\nWhat did you expect instead?\nSteps to reproduce:"}
                  aria-invalid={Boolean(errors.description)}
                  {...register("description")}
                />
                {errors.description ? <Err>{errors.description.message}</Err> : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="project" required>Project</Label>
                  <Select id="project" aria-invalid={Boolean(errors.project)} {...register("project")}>
                    <option value="">Select…</option>
                    {(projects.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>
                  {errors.project ? <Err>{errors.project.message}</Err> : null}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="module">Module</Label>
                  <Select id="module" disabled={!projectId} {...register("module")}>
                    <option value="">{projectId ? "Select…" : "Choose a project first"}</option>
                    {(modules.data ?? []).map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="submodule">Submodule</Label>
                  <Select id="submodule" disabled={!moduleId} {...register("submodule")}>
                    <option value="">{moduleId ? "Select…" : "Choose a module first"}</option>
                    {(submodules.data ?? []).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Select>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="priority" required>Priority</Label>
                <Select id="priority" aria-invalid={Boolean(errors.priority)} {...register("priority")}>
                  <option value="">Select…</option>
                  {(priorities.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
                <p className="text-[11px] text-[var(--muted-foreground)]">Business urgency.</p>
                {errors.priority ? <Err>{errors.priority.message}</Err> : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="severity" required>Severity</Label>
                <Select id="severity" aria-invalid={Boolean(errors.severity)} {...register("severity")}>
                  <option value="">Select…</option>
                  {(severities.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
                <p className="text-[11px] text-[var(--muted-foreground)]">Technical impact.</p>
                {errors.severity ? <Err>{errors.severity.message}</Err> : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="environment" required>Environment</Label>
                <Select id="environment" {...register("environment")}>
                  {ENVIRONMENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>

              <button
                type="button"
                onClick={() => setShowMore((value) => !value)}
                aria-expanded={showMore}
                className="flex w-full items-center gap-1.5 text-[13px] font-medium text-[var(--primary)]"
              >
                <ChevronDown className={`size-3.5 transition-transform ${showMore ? "" : "-rotate-90"}`} aria-hidden />
                Additional details
              </button>

              {showMore ? (
                <div className="space-y-4 border-t border-[var(--border)] pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reported_date">Reported date</Label>
                    <Input id="reported_date" type="date" {...register("reported_date")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="expected_closure_date">Expected closure</Label>
                    <Input id="expected_closure_date" type="date" {...register("expected_closure_date")} />
                    <p className="text-[11px] text-[var(--muted-foreground)]">
                      Defaults from the priority's SLA if left blank.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="department">Department</Label>
                    <Select id="department" {...register("department")}>
                      <option value="">Select…</option>
                      {(departments.data ?? []).map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="site">Site</Label>
                    <Select id="site" {...register("site")}>
                      <option value="">Select…</option>
                      {(sites.data ?? []).map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </Select>
                  </div>
                </div>
              ) : null}
            </CardBody>
          </Card>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button type="submit" loading={create.isPending}>
            <Save /> Create bug
          </Button>
        </div>
      </form>
    </>
  );
}

function Err({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] text-[var(--destructive)]">{children}</p>;
}
