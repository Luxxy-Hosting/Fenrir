"use client"

import { use, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import AuthenticationContext from "@/app/_context/authentication"
import {
  api,
  type TicketCategory,
  type TicketDetail,
  type TicketMeta,
  type TicketPriority,
  type TicketSummary,
} from "@/lib/api"
import { getAccessToken } from "@/lib/auth"
import { useTicketLiveEvents } from "@/lib/ticket-live"
import {
  TICKET_CATEGORY_LABELS,
  formatTicketDate,
  getTicketDisplayStatus,
  type TicketDisplayStatus,
} from "@/lib/tickets"
import {
  CreateTicketDialog,
  TicketFilters,
  TicketPriorityBadge,
  TicketStatusBadge,
  TicketTable,
} from "@/components/tickets/ticket-ui"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  Clock3Icon,
  LifeBuoyIcon,
  MessageSquareIcon,
  PlusIcon,
  RefreshCwIcon,
} from "lucide-react"

const FALLBACK_META: TicketMeta = {
  statuses: ["OPEN", "IN_PROGRESS", "CLOSED"],
  userStatuses: ["OPEN", "CLOSED"],
  priorities: ["LOW", "MEDIUM", "HIGH", "URGENT"],
  categories: ["GENERAL", "BILLING", "TECHNICAL", "ACCOUNT"],
}

type FilterValue<T extends string> = "ALL" | T

function toSummary(ticket: TicketDetail): TicketSummary {
  return {
    id: ticket.id,
    subject: ticket.subject,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    lastMessageAt: ticket.lastMessageAt,
    closedAt: ticket.closedAt,
    messageCount: ticket.messageCount,
    requester: ticket.requester,
    latestMessage: ticket.latestMessage,
  }
}

function sortTickets(tickets: TicketSummary[]) {
  return [...tickets].sort(
    (left, right) =>
      new Date(right.lastMessageAt).getTime() -
      new Date(left.lastMessageAt).getTime()
  )
}

function updateTicketInList(items: TicketSummary[], ticket: TicketDetail) {
  return sortTickets([
    toSummary(ticket),
    ...items.filter((item) => item.id !== ticket.id),
  ])
}

export default function TicketsPage() {
  use(AuthenticationContext)
  const router = useRouter()
  const [tickets, setTickets] = useState<TicketSummary[]>([])
  const [meta, setMeta] = useState<TicketMeta>(FALLBACK_META)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] =
    useState<FilterValue<TicketDisplayStatus>>("ALL")
  const [priorityFilter, setPriorityFilter] =
    useState<FilterValue<TicketPriority>>("ALL")
  const [departmentFilter, setDepartmentFilter] =
    useState<FilterValue<TicketCategory>>("ALL")

  const loadTickets = useCallback(async () => {
    const token = getAccessToken()
    if (!token) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const [ticketData, metaData] = await Promise.all([
        api.tickets.list(token),
        api.tickets.meta(token).catch(() => FALLBACK_META),
      ])
      setTickets(sortTickets(ticketData))
      setMeta(metaData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tickets")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  useTicketLiveEvents({
    onTicketCreated: (ticket) => {
      setTickets((current) => updateTicketInList(current, ticket))
    },
    onTicketUpdated: (ticket) => {
      setTickets((current) => updateTicketInList(current, ticket))
    },
    onTicketMessage: (ticket) => {
      setTickets((current) => updateTicketInList(current, ticket))
    },
  })

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase()

    return tickets.filter((ticket) => {
      const displayStatus = getTicketDisplayStatus(ticket)

      if (statusFilter !== "ALL" && displayStatus !== statusFilter) return false
      if (priorityFilter !== "ALL" && ticket.priority !== priorityFilter) {
        return false
      }
      if (departmentFilter !== "ALL" && ticket.category !== departmentFilter) {
        return false
      }

      if (!query) return true

      return (
        ticket.subject.toLowerCase().includes(query) ||
        ticket.id.toLowerCase().includes(query) ||
        `#${ticket.id}`.toLowerCase().includes(query)
      )
    })
  }, [departmentFilter, priorityFilter, search, statusFilter, tickets])

  const stats = useMemo(() => {
    const open = tickets.filter((ticket) => ticket.status !== "CLOSED").length
    const waitingOnSupport = tickets.filter((ticket) => {
      const displayStatus = getTicketDisplayStatus(ticket)
      return displayStatus === "OPEN" || displayStatus === "WAITING_ON_SUPPORT"
    }).length
    const resolved = tickets.filter((ticket) => ticket.status === "CLOSED").length

    return { open, waitingOnSupport, resolved }
  }, [tickets])

  const createTicket = async (values: {
    subject: string
    category: TicketCategory
    priority: TicketPriority
    message: string
    attachments?: File[]
  }) => {
    const token = getAccessToken()
    if (!token) throw new Error("You must be signed in to create a ticket")

    const created = await api.tickets.create(token, values)
    setTickets((current) => updateTicketInList(current, created))
    setCreateOpen(false)
    router.push(`/tickets/${created.id}`)
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-3">
          <Badge variant="secondary" className="w-fit">
            <LifeBuoyIcon data-icon="inline-start" />
            Support Desk
          </Badge>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Support Tickets
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Create and manage support requests.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={loadTickets} disabled={loading}>
            <RefreshCwIcon data-icon="inline-start" />
            Refresh
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            Create Ticket
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TicketStatCard
          label="Open tickets"
          value={stats.open.toString()}
          icon={<MessageSquareIcon className="size-4" />}
          loading={loading}
        />
        <TicketStatCard
          label="Waiting on support"
          value={stats.waitingOnSupport.toString()}
          icon={<Clock3Icon className="size-4" />}
          loading={loading}
        />
        <TicketStatCard
          label="Resolved tickets"
          value={stats.resolved.toString()}
          icon={<CheckCircle2Icon className="size-4" />}
          loading={loading}
        />
        <TicketStatCard
          label="Average response time"
          value="Not available"
          icon={<LifeBuoyIcon className="size-4" />}
          loading={loading}
        />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Could not load tickets</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle>Browse tickets</CardTitle>
          <CardDescription>
            Filter by status, priority, or department before opening a thread.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TicketFilters
            search={search}
            status={statusFilter}
            priority={priorityFilter}
            department={departmentFilter}
            meta={meta}
            onSearchChange={setSearch}
            onStatusChange={setStatusFilter}
            onPriorityChange={setPriorityFilter}
            onDepartmentChange={setDepartmentFilter}
          />
        </CardContent>
      </Card>

      <TicketTable
        tickets={filteredTickets}
        loading={loading}
        onOpenTicket={(ticketId) => router.push(`/tickets/${ticketId}`)}
        onCreateTicket={() => setCreateOpen(true)}
      />

      {!loading && filteredTickets.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Showing {filteredTickets.length} tickets</span>
          <span>Updated {formatTicketDate(new Date().toISOString())}</span>
          {statusFilter !== "ALL" ? (
            <TicketStatusBadge status={statusFilter} />
          ) : null}
          {priorityFilter !== "ALL" ? (
            <TicketPriorityBadge priority={priorityFilter} />
          ) : null}
          {departmentFilter !== "ALL" ? (
            <Badge variant="outline">
              {TICKET_CATEGORY_LABELS[departmentFilter]}
            </Badge>
          ) : null}
        </div>
      ) : null}

      <CreateTicketDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        meta={meta}
        onCreate={createTicket}
      />
    </div>
  )
}

function TicketStatCard({
  label,
  value,
  icon,
  loading,
}: {
  label: string
  value: string
  icon: React.ReactNode
  loading: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 pb-2">
        <CardDescription>{label}</CardDescription>
        <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
        )}
      </CardContent>
    </Card>
  )
}
