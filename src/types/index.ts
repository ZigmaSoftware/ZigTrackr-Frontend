/* ---- DOMAIN TYPES ---- */

export type BugStatus =
  | "NEW" | "ASSIGNED" | "IN_PROGRESS" | "TESTING" | "ON_HOLD"
  | "RESOLVED" | "CLOSED" | "REOPENED" | "REJECTED";

export type PriorityCode = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type SeverityCode = "BLOCKER" | "CRITICAL" | "MAJOR" | "MINOR" | "COSMETIC";
export type AgingBand = "NORMAL" | "ATTENTION" | "WARNING" | "CRITICAL";
export type TestResult = "PASSED" | "FAILED" | "BLOCKED";
export type VerificationResult = "PASSED" | "FAILED" | "PARTIAL";
export type Environment = "PRODUCTION" | "UAT" | "STAGING" | "DEVELOPMENT" | "LOCAL";

export interface UserLite {
  id: string;
  username: string;
  name: string;
  email: string;
}

export interface NamedRef {
  id: string;
  name: string;
}

/** Priority/severity/root-cause carry their own display metadata, so badges are
 *  driven by master data rather than a hardcoded colour map. */
export interface CodedRef {
  id: string;
  code: string;
  name: string;
  color: string;
  rank: number;
}

export interface TransitionOption {
  value: BugStatus;
  label: string;
}

export interface BugListRow {
  id: string;
  bug_no: string;
  can_mutate: boolean;
  reported_date: string | null;
  project: NamedRef | null;
  module: NamedRef | null;
  title: string;
  priority: CodedRef | null;
  severity: CodedRef | null;
  owner: UserLite | null;
  reported_by: UserLite | null;
  status: BugStatus;
  status_label: string;
  age_days: number;
  aging_band: AgingBand;
  expected_closure_date: string | null;
  is_overdue: boolean;
  overdue_days: number;
  is_update_pending: boolean;
  days_since_update: number;
  latest_update_at: string | null;
  latest_remarks: string;
  reopen_count: number;
}

export interface BugDetail extends BugListRow {
  description: string;
  submodule: NamedRef | null;
  department: NamedRef | null;
  site: NamedRef | null;
  environment: Environment | null;
  environment_label: string;
  assigned_by: UserLite | null;
  assigned_date: string | null;
  next_action: string;
  hold_reason: string;
  rejection_reason: string;
  root_cause_type: CodedRef | null;
  root_cause: string;
  resolution: string;
  resolved_date: string | null;
  resolved_by: UserLite | null;
  tested_by: UserLite | null;
  verification_result: VerificationResult | "";
  verification_remarks: string;
  verified_at: string | null;
  closure_remarks: string;
  closed_by: UserLite | null;
  closed_date: string | null;
  closed_at: string | null;
  last_reopened_at: string | null;
  created_at: string;
  updated_at: string;
  allowed_transitions: TransitionOption[];
  source_mail_id: string | null;
}

export interface SupportTicketRow {
  id: string;
  /** Null until the ticket is reviewed and routed to an owner. */
  ticket_no: string | null;
  /** The intake reference, present from creation. */
  ref_no: string;
  /** ticket_no once routed, else ref_no. Use this for display. */
  reference: string;
  description: string;
  mail_id: string | null;
  /** When the originating email arrived; null for manually created tickets. */
  mail_received_at: string | null;
  mail_from_email: string;
  /** The mailbox the request arrived on ("via"). */
  mail_to_email: string;
  source: string;
  ticket_type: string;
  status: string;
  status_label: string;
  effective_status: string;
  classification_status: string;
  classification_score: number | null;
  classification_method?: string;
  band?: string;
  needs_review: boolean;
  title: string;
  project?: NamedRef | null;
  module?: NamedRef | null;
  priority?: CodedRef | null;
  owner?: UserLite | null;
  reported_by?: UserLite | null;
  reported_by_email: string;
  reported_by_name: string;
  bug_no: string;
  bug_id: string | null;
  expected_closure_date?: string | null;
  effective_expected_closure_date?: string | null;
  age_days: number;
  is_overdue: boolean;
  overdue_days: number;
  latest_update_at: string | null;
  created_at: string;
  can_reassign: boolean;
  can_delete: boolean;
  reassign_block_reason: string | null;
  allowed_actions: string[];
  chat_state: { can_view: boolean; can_send: boolean; reason: string | null };
}

export interface TicketUpdateRow {
  id: string;
  update_text: string;
  remarks: string;
  source: string;
  created_by_name: string;
  created_at: string;
}

export interface SupportTicketDetail extends SupportTicketRow {
  active_work_conflict: { id: string; reference: string } | null;
  submodule: NamedRef | null;
  confirmed_by: UserLite | null;
  confirmed_at: string | null;
  classification_reason: string;
  ack_sent_at: string | null;
  updates: TicketUpdateRow[];
  request_messages: RequestMessage[];
  updated_at: string;
}

export interface RequestMessage {
  id: string;
  kind: "ORIGINAL" | "REPLY";
  from_email: string;
  from_name: string;
  subject: string;
  received_at: string;
  body: string;
  attachment_count: number;
}

export interface BugUpdateRow {
  id: string;
  status: BugStatus;
  status_label: string;
  owner: UserLite | null;
  update_text: string;
  remarks: string;
  next_action: string;
  expected_completion_date: string | null;
  updated_by: UserLite;
  update_date: string;
  created_at: string;
  is_system_generated: boolean;
}

export interface TimelineEvent {
  type: "STATUS" | "ASSIGNMENT" | "UPDATE" | "TESTING" | "REOPEN" | "ATTACHMENT";
  timestamp: string;
  actor: { id: string; name: string } | null;
  description: string;
  from_value: string | null;
  to_value: string | null;
  remarks: string;
  next_action?: string;
}

export interface Attachment {
  id: string;
  file_name: string;
  file_type: string;
  file_extension: string;
  file_size: number;
  context: string;
  uploaded_by: UserLite;
  uploaded_at: string;
  download_url: string;
}

/** What the public tracking page is told. Deliberately thin: status and dates,
 *  never the description, internal remarks or owner. */
export interface PublicTicketStatus {
  found: boolean;
  ticket_no?: string;
  subject?: string;
  status?: string;
  status_label?: string;
  raised_on?: string;
  expected_closure?: string | null;
  last_updated?: string;
  is_closed?: boolean;
}

/** One row of a ticket's merged history: its own updates plus, for a BUG
 *  ticket, the linked bug's status and assignment history. */
export interface TicketTimelineEvent {
  type: string;
  timestamp: string;
  actor: string;
  actor_role?: string;
  title?: string;
  description: string;
  remarks: string;
}

export interface PublicTrackTicket {
  found: boolean;
  ticket_no: string;
  subject: string;
  owner_name: string | null;
  status: string;
  status_label: string;
  can_reopen: boolean;
  chat_state: { can_view: boolean; can_send: boolean; reason: string | null };
}

export interface TicketChatMessage {
  id: string;
  sender_type: string;
  sender_display_name: string;
  sender_role?: string;
  sender_email: string;
  message_text: string;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
  is_mine: boolean;
  edited_at: string | null;
  is_deleted: boolean;
  is_pinned: boolean;
  is_starred: boolean;
  can_edit: boolean;
  reactions: { emoji: string; count: number; mine: boolean }[];
  reply_to: { id: string; sender_display_name: string; sender_role?: string; message_text: string; is_deleted: boolean } | null;
}

export interface TicketChatInboxRow {
  id: string;
  reference: string;
  title: string;
  ticket_type: string;
  status: string;
  status_label: string;
  requester_name: string;
  requester_email: string;
  owner_id: string;
  owner_name: string;
  last_message_at: string | null;
  last_message_text: string | null;
  last_message_sender_type: string | null;
  last_message_sender_name: string | null;
  last_message_sender_role?: string;
  last_message_is_mine: boolean;
  unread_count: number;
  chat_state: { can_view: boolean; can_send: boolean; reason: string | null };
}

/** Ticket attachments carry a required reason instead of a bug's `context`. */
export interface TicketAttachment {
  id: string;
  file_name: string;
  file_type: string;
  file_extension: string;
  file_size: number;
  reason: string;
  uploaded_by: UserLite | null;
  uploaded_by_name?: string;
  source?: "MANUAL" | "MAIL";
  uploaded_at: string;
  download_url: string;
}

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  email: string;
  employee_code: string | null;
  designation: string;
  department: string | null;
  team: string | null;
  site: string | null;
  is_superuser: boolean;
  must_change_password: boolean;
  roles: { code: string; name: string }[];
  permissions: string[];
}

export interface MasterRow {
  id: string;
  code?: string;
  name: string;
  description?: string;
  rank?: number;
  color?: string;
  sla_days?: number | null;
  is_system?: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface DashboardKpis {
  total_open: number;
  new_today: number;
  assigned: number;
  in_progress: number;
  testing: number;
  resolved: number;
  on_hold: number;
  reopened: number;
  critical: number;
  high: number;
  overdue: number;
  unassigned: number;
  update_pending: number;
  closed_today: number;
  closed_this_month: number;
  avg_closure_days: number;
  avg_age_days: number;
}

export interface SidebarCounts {
  chat_unread: number;
  assigned_to_me: number;
  unassigned: number;
  critical: number;
  overdue: number;
  testing: number;
  update_pending: number;
  reopened: number;
}

export interface RoleRow {
  id: string;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
  is_system: boolean;
  permission_count: number;
}

export interface PermissionCell {
  codename: string;
  name: string;
  screen: string;
  action: string;
  roles: Record<string, boolean>;
}

export interface PermissionMatrix {
  roles: { id: string; code: string; name: string; is_system: boolean }[];
  modules: { module: string; permissions: PermissionCell[] }[];
}

export interface ChartDatum {
  code: string;
  label: string;
  count: number;
  color?: string;
  percentage?: number;
}

export interface WorkloadRow {
  id: string;
  name: string;
  assigned: number;
  in_progress: number;
  testing: number;
  on_hold: number;
  closed: number;
  overdue: number;
  update_pending: number;
  critical: number;
  total_open: number;
}

export interface ActivityRow {
  id: string;
  action: string;
  action_label: string;
  bug_no: string;
  bug_id: string | null;
  actor: string;
  field: string;
  old_value: string;
  new_value: string;
  timestamp: string;
}

/* ---- API ENVELOPE (spec 43) ---- */

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface ApiErrorEnvelope {
  success: false;
  message: string;
  errors: Record<string, string[] | string>;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  page: number;
  total_pages: number;
  results: T[];
}
