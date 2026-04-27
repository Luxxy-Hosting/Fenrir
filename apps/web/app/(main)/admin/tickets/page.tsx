"use client"

import { use, useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react"
import { useRouter } from "next/navigation"
import AuthenticationContext from "@/app/_context/authentication"
import {
  api,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
  type TicketSummary,
} from "@/lib/api"
import { getAccessToken } from "@/lib/auth"
import { useTicketLiveEvents } from "@/lib/ticket-live"
import {
  ADMIN_TICKET_FILTERS,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  formatTicketDate,
  formatTicketId,
  getTicketDisplayStatus,
} from "@/lib/tickets"
import {
  TicketPriorityBadge,
  TicketStatusBadge,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  Clock3Icon,
  InboxIcon,
  LifeBuoyIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
  UserRoundIcon,
} from "lucide-react"

const TICKET_PRIORITIES: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"]
const TICKET_DEPARTMENTS: TicketCategory[] = [
  "GENERAL",
  "BILLING",
  "TECHNICAL",
  "ACCOUNT",
]

type FilterValue<T extends string> = "ALL" | T

function sortTickets(tickets: TicketSummary[]) {
  return [...tickets].sort(
    (left, right) =>
      new Date(right.lastMessageAt).getTime() -
      new Date(left.lastMessageAt).getTime()
  )
}

function toSummary(ticket: TicketSummary): TicketSummary {
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

function updateTicketInList(items: TicketSummary[], ticket: TicketSummary) {
  return sortTickets([
    toSummary(ticket),
    ...items.filter((item) => item.id !== ticket.id),
  ])
}

export default function AdminTicketsPage() {
  use(AuthenticationContext)
  const router = useRouter()
  const [tickets, setTickets] = useState<TicketSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] =
    useState<FilterValue<TicketStatus>>("ALL")
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
      const ticketData = await api.admin.listTickets(token)
      setTickets(sortTickets(ticketData))
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
      if (statusFilter !== "ALL" && ticket.status !== statusFilter) return false
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
        `#${ticket.id}`.toLowerCase().includes(query) ||
        ticket.requester?.email.toLowerCase().includes(query) ||
        ticket.requester?.name?.toLowerCase().includes(query) ||
        ticket.latestMessage?.message.toLowerCase().includes(query)
      )
    })
  }, [departmentFilter, priorityFilter, search, statusFilter, tickets])

  const stats = useMemo(() => {
    const open = tickets.filter((ticket) => ticket.status === "OPEN").length
    const inProgress = tickets.filter(
      (ticket) => ticket.status === "IN_PROGRESS"
    ).length
    const closed = tickets.filter((ticket) => ticket.status === "CLOSED").length
    const waitingOnSupport = tickets.filter((ticket) => {
      const displayStatus = getTicketDisplayStatus(ticket)
      return displayStatus === "OPEN" || displayStatus === "WAITING_ON_SUPPORT"
    }).length

    return { open, inProgress, closed, waitingOnSupport }
  }, [tickets])

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-3">
          <Badge variant="secondary" className="w-fit">
            <ShieldCheckIcon data-icon="inline-start" />
            Staff Queue
          </Badge>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              Support Tickets
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Triage customer requests, assign attention, and keep every support
              conversation moving.
            </p>
          </div>
        </div>

        <Button variant="outline" onClick={loadTickets} disabled={loading}>
          <RefreshCwIcon data-icon="inline-start" />
          Refresh Queue
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Open tickets"
          value={stats.open.toString()}
          icon={<MessageSquareIcon className="size-4" />}
          loading={loading}
        />
        <AdminStatCard
          label="Waiting on support"
          value={stats.waitingOnSupport.toString()}
          icon={<Clock3Icon className="size-4" />}
          loading={loading}
        />
        <AdminStatCard
          label="In progress"
          value={stats.inProgress.toString()}
          icon={<LifeBuoyIcon className="size-4" />}
          loading={loading}
        />
        <AdminStatCard
          label="Resolved or closed"
          value={stats.closed.toString()}
          icon={<CheckCircle2Icon className="size-4" />}
          loading={loading}
        />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Could not load support queue</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle>Queue filters</CardTitle>
          <CardDescription>
            Search by requester, subject, ticket ID, or latest reply.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminTicketFilters
            search={search}
            status={statusFilter}
            priority={priorityFilter}
            department={departmentFilter}
            onSearchChange={setSearch}
            onStatusChange={setStatusFilter}
            onPriorityChange={setPriorityFilter}
            onDepartmentChange={setDepartmentFilter}
          />
        </CardContent>
      </Card>

      <AdminTicketTable
        tickets={filteredTickets}
        loading={loading}
        onOpenTicket={(ticketId) => router.push(`/admin/tickets/${ticketId}`)}
      />
    </div>
  )
}

function AdminTicketFilters({
  search,
  status,
  priority,
  department,
  onSearchChange,
  onStatusChange,
  onPriorityChange,
  onDepartmentChange,
}: {
  search: string
  status: FilterValue<TicketStatus>
  priority: FilterValue<TicketPriority>
  department: FilterValue<TicketCategory>
  onSearchChange: (value: string) => void
  onStatusChange: (value: FilterValue<TicketStatus>) => void
  onPriorityChange: (value: FilterValue<TicketPriority>) => void
  onDepartmentChange: (value: FilterValue<TicketCategory>) => void
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative min-w-0 flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search subject, requester, ticket ID, or reply..."
          className="pl-8"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:flex">
        <Select
          value={status}
          onValueChange={(value) => onStatusChange(value as FilterValue<TicketStatus>)}
        >
          <SelectTrigger className="w-full sm:min-w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {ADMIN_TICKET_FILTERS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label === "All" ? "All statuses" : option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={priority}
          onValueChange={(value) => onPriorityChange(value as FilterValue<TicketPriority>)}
        >
          <SelectTrigger className="w-full sm:min-w-36">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="ALL">All priorities</SelectItem>
              {TICKET_PRIORITIES.map((option) => (
                <SelectItem key={option} value={option}>
                  {TICKET_PRIORITY_LABELS[option]}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={department}
          onValueChange={(value) => onDepartmentChange(value as FilterValue<TicketCategory>)}
        >
          <SelectTrigger className="w-full sm:min-w-40">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="ALL">All departments</SelectItem>
              {TICKET_DEPARTMENTS.map((option) => (
                <SelectItem key={option} value={option}>
                  {TICKET_CATEGORY_LABELS[option]}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

function AdminTicketTable({
  tickets,
  loading,
  onOpenTicket,
}: {
  tickets: TicketSummary[]
  loading: boolean
  onOpenTicket: (ticketId: string) => void
}) {
  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle>Support queue</CardTitle>
        <CardDescription>
          Prioritize customer conversations by requester, status, priority, and
          last activity.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex flex-col gap-3 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : null}

        {!loading && tickets.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
              <InboxIcon className="size-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-medium">No tickets match</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Adjust filters or refresh the queue to see newly submitted
                support requests.
              </p>
            </div>
          </div>
        ) : null}

        {!loading && tickets.length > 0 ? (
          <>
            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket ID</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Last Reply</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => (
                    <AdminTicketRow
                      key={ticket.id}
                      ticket={ticket}
                      onOpenTicket={onOpenTicket}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 p-3 lg:hidden">
              {tickets.map((ticket) => (
                <AdminTicketMobileCard
                  key={ticket.id}
                  ticket={ticket}
                  onOpenTicket={onOpenTicket}
                />
              ))}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

function AdminTicketRow({
  ticket,
  onOpenTicket,
}: {
  ticket: TicketSummary
  onOpenTicket: (ticketId: string) => void
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onOpenTicket(ticket.id)
    }
  }

  return (
    <TableRow
      tabIndex={0}
      role="button"
      onClick={() => onOpenTicket(ticket.id)}
      onKeyDown={handleKeyDown}
      className="cursor-pointer"
    >
      <TableCell className="font-mono text-xs text-muted-foreground">
        {formatTicketId(ticket.id)}
      </TableCell>
      <TableCell className="max-w-72">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate font-medium">{ticket.subject}</span>
          <span className="truncate text-xs text-muted-foreground">
            {ticket.latestMessage?.message || "No replies yet"}
          </span>
        </div>
      </TableCell>
      <TableCell className="max-w-56">
        <div className="flex min-w-0 items-center gap-2">
          <UserRoundIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {ticket.requester?.name || ticket.requester?.email || "Unknown"}
          </span>
        </div>
      </TableCell>
      <TableCell>{TICKET_CATEGORY_LABELS[ticket.category]}</TableCell>
      <TableCell>
        <TicketStatusBadge status={ticket.status} />
      </TableCell>
      <TableCell>
        <TicketPriorityBadge priority={ticket.priority} />
      </TableCell>
      <TableCell>{formatTicketDate(ticket.lastMessageAt)}</TableCell>
      <TableCell>{formatTicketDate(ticket.createdAt)}</TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontalIcon />
              <span className="sr-only">Open ticket actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => onOpenTicket(ticket.id)}>
                <MessageSquareIcon />
                Open conversation
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}

function AdminTicketMobileCard({
  ticket,
  onOpenTicket,
}: {
  ticket: TicketSummary
  onOpenTicket: (ticketId: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpenTicket(ticket.id)}
      className="rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/40"
    >
      <div className="flex flex-col gap-3">
        <div>
          <p className="font-mono text-xs text-muted-foreground">
            {formatTicketId(ticket.id)}
          </p>
          <p className="mt-1 truncate font-medium">{ticket.subject}</p>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {ticket.requester?.name || ticket.requester?.email || "Unknown requester"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <TicketStatusBadge status={ticket.status} />
          <TicketPriorityBadge priority={ticket.priority} />
          <Badge variant="outline">{TICKET_CATEGORY_LABELS[ticket.category]}</Badge>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Last reply {formatTicketDate(ticket.lastMessageAt)}</span>
          <span>Created {formatTicketDate(ticket.createdAt)}</span>
        </div>
      </div>
    </button>
  )
}

function AdminStatCard({
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
