import type { MasterConfig } from "@/features/masters/MasterShell";

/* Nine masters as data. MasterShell renders all of them. */

const NAME_FIELD = { name: "name", label: "Name", required: true } as const;
const DESCRIPTION_FIELD = { name: "description", label: "Description", type: "textarea" } as const;
const CODE_FIELD = { name: "code", label: "Code", required: true, lockedOnSystem: true,
                     help: "Stable identifier used by reports. Avoid changing it." } as const;

export const MASTER_CONFIGS: Record<string, MasterConfig> = {
  projects: {
    resource: "projects", title: "Projects", singular: "Project",
    description: "Applications and systems this team supports.",
    fields: [CODE_FIELD, NAME_FIELD, DESCRIPTION_FIELD],
  },
  modules: {
    resource: "modules", title: "Modules", singular: "Module",
    description: "Functional areas within a project.",
    fields: [
      { name: "project", label: "Project", type: "select", required: true },
      NAME_FIELD, { name: "code", label: "Code" }, DESCRIPTION_FIELD,
    ],
  },
  submodules: {
    resource: "submodules", title: "Submodules", singular: "Submodule",
    description: "Screens or features within a module.",
    fields: [
      { name: "module", label: "Module", type: "select", required: true },
      NAME_FIELD, { name: "code", label: "Code" }, DESCRIPTION_FIELD,
    ],
  },
  priorities: {
    resource: "priorities", title: "Priority", singular: "Priority",
    description: "Business urgency. Drives the default expected closure date.",
    fields: [
      CODE_FIELD, NAME_FIELD,
      { name: "rank", label: "Rank", type: "number",
        help: "Lower sorts first — Critical should be the lowest number." },
      { name: "color", label: "Badge colour", type: "color" },
      { name: "sla_days", label: "SLA days", type: "number",
        help: "Added to the reported date to suggest an expected closure." },
      DESCRIPTION_FIELD,
    ],
  },
  severities: {
    resource: "severities", title: "Severity", singular: "Severity",
    description: "Technical impact. Kept separate from priority.",
    fields: [
      CODE_FIELD, NAME_FIELD,
      { name: "rank", label: "Rank", type: "number" },
      { name: "color", label: "Badge colour", type: "color" },
      DESCRIPTION_FIELD,
    ],
  },
  "root-cause-types": {
    resource: "root-cause-types", title: "Root Cause Types", singular: "Root cause type",
    description: "Categories behind the Root Cause Analysis report.",
    fields: [CODE_FIELD, NAME_FIELD, { name: "rank", label: "Rank", type: "number" }, DESCRIPTION_FIELD],
  },
  departments: {
    resource: "departments", title: "Departments", singular: "Department",
    description: "Business departments that report bugs.",
    fields: [{ name: "code", label: "Code" }, NAME_FIELD, DESCRIPTION_FIELD],
  },
  teams: {
    resource: "teams", title: "Teams", singular: "Team",
    description: "Development teams and their leads.",
    fields: [{ name: "code", label: "Code" }, NAME_FIELD, DESCRIPTION_FIELD],
  },
  sites: {
    resource: "sites", title: "Sites", singular: "Site",
    description: "Physical locations.",
    fields: [{ name: "code", label: "Code" }, NAME_FIELD,
             { name: "address", label: "Address", type: "textarea" }, DESCRIPTION_FIELD],
  },
};
