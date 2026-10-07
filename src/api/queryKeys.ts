/** Central query-key registry.

   Keys live in one place so an invalidation after a workflow action cannot
   miss a screen: closing a bug must refresh the list, the detail, the KPIs and
   the sidebar badges together, and a typo'd inline key would silently leave
   one stale. */
export const queryKeys = {
  session: ["session"] as const,

  bugs: {
    all: ["bugs"] as const,
    list: (params: Record<string, unknown>) => ["bugs", "list", params] as const,
    detail: (id: string) => ["bugs", "detail", id] as const,
    updates: (id: string) => ["bugs", "updates", id] as const,
    timeline: (id: string) => ["bugs", "timeline", id] as const,
    history: (id: string) => ["bugs", "history", id] as const,
    attachments: (id: string) => ["bugs", "attachments", id] as const,
  },

  tickets: {
    all: ["tickets"] as const,
    dailyUpdates: (params: Record<string, unknown>) => ["tickets", "daily-updates", params] as const,
    dailyCalendar: (month: string) => ["tickets", "daily-calendar", month] as const,
    chatInbox: (filter: string, search: string) => ["tickets", "chat-inbox", filter, search] as const,
    list: (params: Record<string, unknown>) => ["tickets", "list", params] as const,
    detail: (id: string) => ["tickets", "detail", id] as const,
    attachments: (id: string) => ["tickets", "attachments", id] as const,
    timeline: (id: string) => ["tickets", "timeline", id] as const,
  },

  dashboard: {
    all: ["dashboard"] as const,
    kpis: ["dashboard", "kpis"] as const,
    charts: ["dashboard", "charts"] as const,
    myWork: ["dashboard", "my-work"] as const,
    attention: ["dashboard", "attention"] as const,
    activity: ["dashboard", "activity"] as const,
    sidebarCounts: ["dashboard", "sidebar-counts"] as const,
  },

  masters: {
    all: ["masters"] as const,
    list: (resource: string, params?: Record<string, unknown>) =>
      ["masters", resource, params ?? {}] as const,
    options: (resource: string, parent?: string) =>
      ["masters", "options", resource, parent ?? ""] as const,
  },

  users: {
    all: ["users"] as const,
    assignable: ["users", "assignable"] as const,
  },

  reports: {
    all: ["reports"] as const,
    one: (name: string, params?: Record<string, unknown>) =>
      ["reports", name, params ?? {}] as const,
  },

  team: {
    workload: ["team", "workload"] as const,
    assignmentBoard: ["team", "assignment-board"] as const,
  },

  notifications: {
    all: ["notifications"] as const,
    unreadCount: ["notifications", "unread-count"] as const,
  },

  audit: {
    list: (params: Record<string, unknown>) => ["audit", params] as const,
  },
} as const;
