import { del, get, patch, post, api } from "@/api/client";
import type {
  ActivityRow, Attachment, BugDetail, BugListRow, BugUpdateRow, ChartDatum,
  DashboardKpis, MasterRow, Paginated, SessionUser, SidebarCounts,
  PublicTicketStatus, PublicTrackTicket, TicketChatMessage, TicketChatInboxRow, SupportTicketRow, TicketAttachment, TicketTimelineEvent,
  TimelineEvent, UserLite, WorkloadRow,
  SupportTicketDetail,
  PermissionMatrix,
  RoleRow,
} from "@/types";

/* ---- AUTH ---- */
export const authApi = {
  login: (username: string, password: string) =>
    post<SessionUser>("/auth/login/", { username, password }),
  logout: () => post<null>("/auth/logout/"),
  me: () => get<SessionUser>("/auth/me/"),
  changePassword: (payload: {
    current_password: string; new_password: string; confirm_password: string;
  }) => post<null>("/auth/password/change/", payload),
};

/* ---- BUGS ----
   One service for the whole domain. Every filtered view (My Bugs, Overdue,
   Critical, Testing...) calls list() with different params -- spec 18 forbids
   a separate implementation per screen. */
export const bugApi = {
  list: (params: Record<string, unknown>) =>
    get<Paginated<BugListRow>>("/bugs/", params),
  detail: (id: string) => get<BugDetail>(`/bugs/${id}/`),
  create: (payload: Record<string, unknown>) => post<BugDetail>("/bugs/", payload),
  update: (id: string, payload: Record<string, unknown>) =>
    patch<BugDetail>(`/bugs/${id}/`, payload),

  assign: (id: string, payload: { owner: string; remarks?: string; expected_closure_date?: string | null }) =>
    post<BugDetail>(`/bugs/${id}/assign/`, payload),
  completeAssignment: (id: string, payload: Record<string, unknown>) =>
    post<BugDetail>(`/bugs/${id}/complete-assignment/`, payload),
  changeStatus: (id: string, payload: Record<string, unknown>) =>
    post<BugDetail>(`/bugs/${id}/status/`, payload),
  recordTest: (id: string, payload: { test_result: string; test_remarks?: string }) =>
    post<BugDetail>(`/bugs/${id}/testing/`, payload),
  resolve: (id: string, payload: Record<string, unknown>) =>
    post<BugDetail>(`/bugs/${id}/resolve/`, payload),
  close: (id: string, payload: Record<string, unknown>) =>
    post<BugDetail>(`/bugs/${id}/close/`, payload),
  reopen: (id: string, payload: { reopen_reason: string }) =>
    post<BugDetail>(`/bugs/${id}/reopen/`, payload),

  updates: (id: string) => get<Paginated<BugUpdateRow> | BugUpdateRow[]>(`/bugs/${id}/updates/`),
  addUpdate: (id: string, payload: Record<string, unknown>) =>
    post<BugUpdateRow>(`/bugs/${id}/updates/`, payload),
  timeline: (id: string) => get<TimelineEvent[]>(`/bugs/${id}/timeline/`),
  history: (id: string) => get<Record<string, unknown[]>>(`/bugs/${id}/history/`),

  attachments: (id: string) => get<Attachment[]>(`/bugs/${id}/attachments/`),
  upload: (id: string, file: File, context = "BUG") => {
    const form = new FormData();
    form.append("file", file);
    form.append("context", context);
    return api.post(`/bugs/${id}/attachments/`, form).then((r) => r.data.data as Attachment);
  },
  deleteAttachment: (attachmentId: string) => del<null>(`/bugs/attachments/${attachmentId}/`),
};

export const ticketApi = {
  chatInbox: (params: { page: number; limit: number; filter: string; search: string }) =>
    get<Paginated<TicketChatInboxRow>>("/tickets/chat/inbox/", params),
  list: (params: Record<string, unknown>) =>
    get<Paginated<SupportTicketRow>>("/tickets/", params),
  detail: (id: string) => get<SupportTicketDetail>(`/tickets/${id}/`),
  delete: (id: string) => del<null>(`/tickets/${id}/`),
  create: (payload: Record<string, unknown>) => post<SupportTicketDetail>("/tickets/", payload),
  review: (id: string, payload: Record<string, unknown>) =>
    post<SupportTicketDetail>(`/tickets/${id}/review/`, payload),
  assign: (id: string, payload: { owner: string; remarks?: string }) =>
    post<SupportTicketDetail>(`/tickets/${id}/assign/`, payload),
  reassign: (id: string, payload: { owner: string; remarks?: string }) =>
    post<SupportTicketDetail>(`/tickets/${id}/reassign/`, payload),
  reassignWithReason: (id: string, payload: Record<string, unknown>) =>
    post<SupportTicketDetail>(`/tickets/${id}/reassign/`, payload),
  confirmClassification: (mailId: string, payload: { ticket_type: string; remarks?: string }) =>
    post<{ ticket_no: string }>(`/mail-intake/${mailId}/confirm-classification/`, payload),
  addUpdate: (id: string, payload: { update_text: string; remarks?: string }) =>
    post<SupportTicketDetail>(`/tickets/${id}/add-update/`, payload),
  start: (id: string, payload: { remarks?: string }) =>
    post<SupportTicketDetail>(`/tickets/${id}/start/`, payload),
  complete: (id: string, payload: { remarks?: string }) =>
    post<SupportTicketDetail>(`/tickets/${id}/complete/`, payload),
  close: (id: string, payload: { remarks?: string }) =>
    post<SupportTicketDetail>(`/tickets/${id}/close/`, payload),
  approve: (id: string, payload: { remarks?: string }) =>
    post<SupportTicketDetail>(`/tickets/${id}/approve/`, payload),
  reject: (id: string, payload: { remarks?: string }) =>
    post<SupportTicketDetail>(`/tickets/${id}/reject/`, payload),
  implement: (id: string, payload: { remarks?: string }) =>
    post<SupportTicketDetail>(`/tickets/${id}/implement/`, payload),

  timeline: (id: string) => get<TicketTimelineEvent[]>(`/tickets/${id}/timeline/`),
  chatMessages: (id: string) => get<TicketChatMessage[]>(`/tickets/${id}/chat/messages/`),
  sendChatMessage: (id: string, message: string, reply_to?: string) =>
    post<TicketChatMessage>(`/tickets/${id}/chat/messages/`, { message, reply_to }),
  chatMessageAction: (id: string, messageId: string, payload: { action: string; message?: string; emoji?: string }) =>
    post<TicketChatMessage>(`/tickets/${id}/chat/messages/${messageId}/`, payload),
  chatReceipts: (id: string, message_ids: string[], status: "delivered" | "read") =>
    post<TicketChatMessage[]>(`/tickets/${id}/chat/receipts/`, { message_ids, status }),

  workTransition: (id: string, payload: { to_status: string; remarks?: string; root_cause?: string; resolution?: string }) =>
    post<SupportTicketDetail>(`/tickets/${id}/work-transition/`, payload),

  /** Unauthenticated: reached from the link in the assignment email. */
  publicLookup: (payload: { ticket_no: string; email: string }) =>
    post<PublicTicketStatus>("/tickets/public/lookup/", payload),
  publicVerify: (payload: { ticket_no: string; email: string }) =>
    post<PublicTrackTicket>("/tickets/public/track/verify/", payload),
  publicTicket: () => get<PublicTrackTicket>("/tickets/public/track/ticket/"),
  publicActivity: () => get<TicketTimelineEvent[]>("/tickets/public/track/activity/"),
  publicChat: () => get<TicketChatMessage[]>("/tickets/public/track/chat/messages/"),
  publicSendChat: (message: string, reply_to?: string) =>
    post<TicketChatMessage>("/tickets/public/track/chat/messages/", { message, reply_to }),
  publicChatMessageAction: (messageId: string, payload: { action: string; message?: string; emoji?: string }) =>
    post<TicketChatMessage>(`/tickets/public/track/chat/messages/${messageId}/`, payload),
  publicChatReceipts: (message_ids: string[], status: "delivered" | "read") =>
    post<TicketChatMessage[]>("/tickets/public/track/chat/receipts/", { message_ids, status }),
  publicReopen: (reason: string) =>
    post<PublicTrackTicket>("/tickets/public/track/reopen/", { reason }),

  attachments: (id: string) =>
    get<TicketAttachment[]>(`/tickets/${id}/attachments/`),
  emailAttachments: (id: string) =>
    get<TicketAttachment[]>(`/tickets/${id}/attachments/`, { source: "MAIL" }),
  uploadAttachment: (id: string, file: File, reason: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("reason", reason);
    return api.post(`/tickets/${id}/attachments/`, form)
      .then((response) => response.data.data as TicketAttachment);
  },
  deleteAttachment: (attachmentId: string) =>
    del<null>(`/tickets/attachments/${attachmentId}/`),
};

/* ---- MASTERS ----
   A single generic service over all nine master resources; the Masters screens
   differ only by configuration. */
export const masterApi = {
  list: (resource: string, params?: Record<string, unknown>) =>
    get<Paginated<MasterRow>>(`/${resource}/`, { limit: 500, ...params }),
  create: (resource: string, payload: Record<string, unknown>) =>
    post<MasterRow>(`/${resource}/`, payload),
  update: (resource: string, id: string, payload: Record<string, unknown>) =>
    patch<MasterRow>(`/${resource}/${id}/`, payload),
  remove: (resource: string, id: string) => del<null>(`/${resource}/${id}/`),
};

/* ---- USERS ----
   Create/update/deactivate/reactivate/reset-password all go through the
   backend's apps.accounts.services.user_service, never a direct model write --
   that is what guarantees a validated password, a role, and an audit trail on
   every account this screen creates. */
export const userApi = {
  list: (params?: Record<string, unknown>) => get<Paginated<MasterRow>>("/users/", params),
  assignable: (roles?: string) =>
    get<UserLite[]>(`/users/assignable/${roles ? `?roles=${encodeURIComponent(roles)}` : ""}`),
  create: (payload: Record<string, unknown>) => post<MasterRow>("/users/", payload),
  update: (id: string, payload: Record<string, unknown>) =>
    patch<MasterRow>(`/users/${id}/`, payload),
  deactivate: (id: string) => del<null>(`/users/${id}/`),
  reactivate: (id: string) => post<MasterRow>(`/users/${id}/reactivate/`),
  resetPassword: (id: string, payload: { new_password: string; require_change_at_login?: boolean }) =>
    post<null>(`/users/${id}/reset-password/`, payload),
  roles: () => get<Paginated<{ id: string; code: string; name: string }>>("/roles/"),
};

export const roleApi = {
  list: () => get<Paginated<RoleRow>>("/roles/"),
  update: (id: string, payload: Partial<Pick<RoleRow, "name" | "description" | "is_active">>) =>
    patch<RoleRow>(`/roles/${id}/`, payload),
  matrix: () => get<PermissionMatrix>("/permissions/matrix/"),
  updatePermissions: (id: string, permissions: string[]) =>
    api.put("/roles/" + id + "/permissions/", { permissions }).then((r) => r.data.data as PermissionMatrix),
};

/* ---- DASHBOARD ---- */
export const dashboardApi = {
  kpis: () => get<DashboardKpis>("/dashboard/kpis/"),
  charts: () => get<Record<string, ChartDatum[] | unknown[]>>("/dashboard/charts/"),
  myWork: () => get<Record<string, BugListRow[]>>("/dashboard/my-work/"),
  attention: () => get<Record<string, BugListRow[]>>("/dashboard/priority-attention/"),
  sidebarCounts: () => get<SidebarCounts>("/dashboard/sidebar-counts/"),
  recentActivity: () => get<ActivityRow[]>("/dashboard/recent-activity/"),
};

/* ---- TEAM ---- */
export const teamApi = {
  workload: () => get<WorkloadRow[]>("/teams/workload/"),
  assignmentBoard: () =>
    get<{ unassigned: BugListRow[]; workload: WorkloadRow[] }>("/teams/assignment-board/"),
};

/* ---- REPORTS ---- */
export const reportApi = {
  fetch: <T,>(name: string, params?: Record<string, unknown>) =>
    get<T>(`/reports/${name}/`, params),
  exportBugs: (params: Record<string, unknown>) =>
    api.get("/reports/export/bugs/", { params, responseType: "blob" }).then((r) => r.data as Blob),
};

/* ---- NOTIFICATIONS ---- */
export const notificationApi = {
  list: (params?: Record<string, unknown>) => get<Paginated<unknown>>("/notifications/", params),
  unreadCount: () => get<{ count: number }>("/notifications/unread_count/"),
  markRead: (id: string) => post<unknown>(`/notifications/${id}/read/`),
  markAllRead: () => post<{ updated: number }>("/notifications/read-all/"),
};

/* ---- AUDIT ---- */
export const auditApi = {
  list: (params?: Record<string, unknown>) => get<Paginated<unknown>>("/audit/", params),
};
