"use client"

import { use, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import AuthenticationContext from "@/app/_context/authentication"
import { api, type TicketDetail, type TicketStatus } from "@/lib/api"
import { getAccessToken } from "@/lib/auth"
import { useTicketLiveEvents } from "@/lib/ticket-live"
import {
  TICKET_CATEGORY_LABELS,
  TICKET_STATUS_LABELS,
  formatTicketDate,
  formatTicketId,
} from "@/lib/tickets"
import {
  TicketMessageList,
  TicketMetadataGrid,
  TicketPriorityBadge,
  TicketReplyComposer,
  TicketRequesterCard,
  TicketStatusBadge,
} from "@/components/tickets/ticket-ui"
import { Alert, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
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
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CircleDotIcon,
  LockIcon,
  LockOpenIcon,
  MoreHorizontalIcon,
} from "lucide-react"

const STAFF_STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "CLOSED"]

export default function AdminTicketDetailPage() {
  use(AuthenticationContext)
  const params = useParams<{ id: string }>()
  const ticketId = params.id
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [replying, setReplying] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [reply, setReply] = useState("")
  const [error, setError] = useState<string | null>(null)

  const loadTicket = useCallback(async () => {
    const token = getAccessToken()
    if (!token) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await api.admin.getTicket(token, ticketId)
      setTicket(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ticket")
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => {
    loadTicket()
  }, [loadTicket])

  useTicketLiveEvents({
    onTicketUpdated: (updatedTicket) => {
      if (updatedTicket.id === ticketId) setTicket(updatedTicket)
    },
    onTicketMessage: (updatedTicket) => {
      if (updatedTicket.id === ticketId) setTicket(updatedTicket)
    },
  })

  const updateStatus = async (status: TicketStatus) => {
    const token = getAccessToken()
    if (!token) return

    try {
      setUpdatingStatus(true)
      setError(null)
      const updated = await api.admin.updateTicketStatus(token, ticketId, status)
      setTicket(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update ticket")
    } finally {
      setUpdatingStatus(false)
    }
  }

  const sendReply = async (attachments: File[]) => {
    const token = getAccessToken()
    if (!token || !reply.trim() || !ticket || ticket.status === "CLOSED") return

    try {
      setReplying(true)
      setError(null)
      const updated = await api.admin.replyToTicket(
        token,
        ticketId,
        reply.trim(),
        attachments
      )
      setTicket(updated)
      setReply("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reply")
    } finally {
      setReplying(false)
    }
  }

  if (loading) {
    return <AdminTicketDetailSkeleton />
  }

  if (!ticket) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 md:p-6">
        <Button variant="ghost" size="sm" asChild className="w-fit">
          <Link href="/admin/tickets">
            <ArrowLeftIcon data-icon="inline-start" />
            Back to queue
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Ticket unavailable</AlertTitle>
          <AlertDescription>
            {error || "This support ticket could not be found."}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const isClosed = ticket.status === "CLOSED"

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" asChild className="w-fit">
          <Link href="/admin/tickets">
            <ArrowLeftIcon data-icon="inline-start" />
            Back to queue
          </Link>
        </Button>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <TicketStatusBadge status={ticket.status} />
              <TicketPriorityBadge priority={ticket.priority} />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {ticket.subject}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatTicketId(ticket.id)} · {TICKET_CATEGORY_LABELS[ticket.category]} · {ticket.requester?.email || "Unknown requester"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {STAFF_STATUSES.map((status) => (
              <Button
                key={status}
                variant={ticket.status === status ? "default" : "outline"}
                onClick={() => updateStatus(status)}
                disabled={updatingStatus || ticket.status === status}
              >
                {ticket.status === status && updatingStatus ? (
                  <CircleDotIcon data-icon="inline-start" className="animate-spin" />
                ) : null}
                {TICKET_STATUS_LABELS[status]}
              </Button>
            ))}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontalIcon />
                  <span className="sr-only">More ticket actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  {isClosed ? (
                    <DropdownMenuItem onClick={() => updateStatus("OPEN")}>
                      <LockOpenIcon />
                      Reopen ticket
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => updateStatus("CLOSED")}
                    >
                      <LockIcon />
                      Close ticket
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Ticket action failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle>Conversation</CardTitle>
              <CardDescription>
                Staff and customer messages in chronological order.
              </CardDescription>
            </CardHeader>
            <CardContent className="bg-muted/10 p-4 md:p-6">
              <TicketMessageList ticket={ticket} viewer="admin" />
            </CardContent>
          </Card>

          <TicketReplyComposer
            value={reply}
            onChange={setReply}
            onSend={sendReply}
            sending={replying}
            disabled={isClosed}
            onReopen={() => updateStatus("OPEN")}
            reopening={updatingStatus}
            title="Staff Reply"
            disabledDescription="This ticket is closed. Reopen it before sending a staff reply."
          />
        </div>

        <div className="flex flex-col gap-4">
          <TicketRequesterCard author={ticket.requester} />
          <TicketMetadataGrid ticket={ticket} statusMode="raw" />
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle>Staff Summary</CardTitle>
              <CardDescription>Operational context for triage.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              <MetadataRow label="Messages" value={ticket.messageCount.toString()} />
              <MetadataRow label="Created" value={formatTicketDate(ticket.createdAt)} />
              <MetadataRow label="Last reply" value={formatTicketDate(ticket.lastMessageAt)} />
              <MetadataRow label="Last updated" value={formatTicketDate(ticket.updatedAt)} />
              <MetadataRow
                label="Closed"
                value={ticket.closedAt ? formatTicketDate(ticket.closedAt) : "Not closed"}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

function AdminTicketDetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6">
      <Skeleton className="h-8 w-36" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full max-w-2xl" />
        <Skeleton className="h-5 w-96" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-[520px] rounded-xl" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
