"use client"

import { use, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import AuthenticationContext from "@/app/_context/authentication"
import { api, type TicketDetail, type UserTicketStatus } from "@/lib/api"
import { getAccessToken } from "@/lib/auth"
import { useTicketLiveEvents } from "@/lib/ticket-live"
import {
  TICKET_CATEGORY_LABELS,
  formatTicketDate,
  formatTicketId,
  getTicketDisplayStatus,
} from "@/lib/tickets"
import {
  TicketMessageList,
  TicketMetadataGrid,
  TicketPriorityBadge,
  TicketReplyComposer,
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
  CheckCircle2Icon,
  LockIcon,
  LockOpenIcon,
  MoreHorizontalIcon,
} from "lucide-react"

export default function TicketDetailPage() {
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
      const data = await api.tickets.get(token, ticketId)
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

  const updateStatus = async (status: UserTicketStatus) => {
    const token = getAccessToken()
    if (!token) return

    try {
      setUpdatingStatus(true)
      setError(null)
      const updated = await api.tickets.updateStatus(token, ticketId, status)
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
      const updated = await api.tickets.reply(
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
    return <TicketDetailSkeleton />
  }

  if (!ticket) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 md:p-6">
        <Button variant="ghost" size="sm" asChild className="w-fit">
          <Link href="/tickets">
            <ArrowLeftIcon data-icon="inline-start" />
            Back to tickets
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Ticket unavailable</AlertTitle>
          <AlertDescription>
            {error || "This ticket could not be found."}
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
          <Link href="/tickets">
            <ArrowLeftIcon data-icon="inline-start" />
            Back to tickets
          </Link>
        </Button>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <TicketStatusBadge status={getTicketDisplayStatus(ticket)} />
              <TicketPriorityBadge priority={ticket.priority} />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {ticket.subject}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatTicketId(ticket.id)} · {TICKET_CATEGORY_LABELS[ticket.category]} · Created {formatTicketDate(ticket.createdAt)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {isClosed ? (
              <Button
                variant="outline"
                onClick={() => updateStatus("OPEN")}
                disabled={updatingStatus}
              >
                {updatingStatus ? (
                  <LockOpenIcon data-icon="inline-start" className="animate-spin" />
                ) : (
                  <LockOpenIcon data-icon="inline-start" />
                )}
                Reopen ticket
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => updateStatus("CLOSED")}
                disabled={updatingStatus}
              >
                {updatingStatus ? (
                  <CheckCircle2Icon data-icon="inline-start" className="animate-spin" />
                ) : (
                  <CheckCircle2Icon data-icon="inline-start" />
                )}
                Mark resolved
              </Button>
            )}

            {!isClosed ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreHorizontalIcon />
                    <span className="sr-only">More ticket actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => updateStatus("CLOSED")}
                    >
                      <LockIcon />
                      Close ticket
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle>Conversation</CardTitle>
              <CardDescription>
                Full support thread with customer and staff replies.
              </CardDescription>
            </CardHeader>
            <CardContent className="bg-muted/10 p-4 md:p-6">
              <TicketMessageList ticket={ticket} />
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
          />
        </div>

        <div className="flex flex-col gap-4">
          <TicketMetadataGrid ticket={ticket} />
          <Card>
            <CardHeader className="border-b pb-4">
              <CardTitle>Last Reply</CardTitle>
              <CardDescription>Latest activity for this request.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <span className="text-muted-foreground">
                {formatTicketDate(ticket.lastMessageAt)}
              </span>
              <p className="leading-6">
                {ticket.latestMessage?.message || "No replies have been added."}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function TicketDetailSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6">
      <Skeleton className="h-8 w-36" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full max-w-2xl" />
        <Skeleton className="h-5 w-80" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Skeleton className="h-[520px] rounded-xl" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
