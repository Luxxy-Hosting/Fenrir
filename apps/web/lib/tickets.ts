import type {
  TicketMessage,
  TicketSummary,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  UserTicketStatus,
} from "@/lib/api"

export type TicketDisplayStatus =
  | "OPEN"
  | "WAITING_ON_SUPPORT"
  | "WAITING_ON_CUSTOMER"
  | "RESOLVED"
  | "CLOSED"

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  CLOSED: "Closed",
}

export const TICKET_DISPLAY_STATUS_LABELS: Record<TicketDisplayStatus, string> = {
  OPEN: "Open",
  WAITING_ON_SUPPORT: "Waiting on support",
  WAITING_ON_CUSTOMER: "Waiting on customer",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
}

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
}

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  GENERAL: "General",
  BILLING: "Billing",
  TECHNICAL: "Technical",
  ACCOUNT: "Account",
}

export const USER_TICKET_FILTERS: Array<{
  value: "ALL" | UserTicketStatus
  label: string
}> = [
  { value: "ALL", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "CLOSED", label: "Closed" },
]

export const ADMIN_TICKET_FILTERS: Array<{
  value: "ALL" | TicketStatus
  label: string
}> = [
  { value: "ALL", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "CLOSED", label: "Closed" },
]

export const TICKET_DISPLAY_FILTERS: Array<{
  value: "ALL" | TicketDisplayStatus
  label: string
}> = [
  { value: "ALL", label: "All statuses" },
  { value: "OPEN", label: "Open" },
  { value: "WAITING_ON_SUPPORT", label: "Waiting on support" },
  { value: "WAITING_ON_CUSTOMER", label: "Waiting on customer" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
]

export function getTicketDisplayStatus(
  ticket: Pick<TicketSummary, "status" | "latestMessage" | "closedAt">
): TicketDisplayStatus {
  if (ticket.status === "CLOSED") {
    // TODO: Replace this mapping if the API adds separate RESOLVED and CLOSED states.
    return ticket.closedAt ? "RESOLVED" : "CLOSED"
  }

  if (!ticket.latestMessage) return "OPEN"

  return ticket.latestMessage.isAdmin
    ? "WAITING_ON_CUSTOMER"
    : "WAITING_ON_SUPPORT"
}

export function getTicketMessageAuthorLabel(
  message: TicketMessage,
  viewer: "user" | "admin"
) {
  if (message.isAdmin) {
    return message.author?.name || message.author?.email || "Support Team"
  }

  if (viewer === "admin") {
    return message.author?.name || message.author?.email || "Customer"
  }

  return message.author?.name || message.author?.email || "You"
}

export function getTicketMessageRoleLabel(
  message: TicketMessage,
  viewer: "user" | "admin"
) {
  if (message.isAdmin) return viewer === "admin" ? "Staff" : "Support"
  return viewer === "admin" ? "Customer" : "You"
}

export function formatTicketId(id: string) {
  return `#${id.slice(0, 8).toUpperCase()}`
}

export function formatTicketDate(value: string) {
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  })
}
