"use client"

import Image from "next/image"
import { useRef, useState, type KeyboardEvent } from "react"
import type {
  TicketAuthor,
  TicketCategory,
  TicketDetail,
  TicketMeta,
  TicketPriority,
  TicketStatus,
  TicketSummary,
} from "@/lib/api"
import {
  TICKET_CATEGORY_LABELS,
  TICKET_DISPLAY_FILTERS,
  TICKET_DISPLAY_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  formatTicketDate,
  formatTicketId,
  getTicketDisplayStatus,
  getTicketMessageAuthorLabel,
  getTicketMessageRoleLabel,
  type TicketDisplayStatus,
} from "@/lib/tickets"
import { cn } from "@workspace/ui/lib/utils"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { Separator } from "@workspace/ui/components/separator"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Textarea } from "@workspace/ui/components/textarea"
import {
  ChevronRightIcon,
  FileIcon,
  InboxIcon,
  Loader2Icon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PaperclipIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react"

type FilterValue<T extends string> = "ALL" | T

interface CreateTicketValues {
  subject: string
  category: TicketCategory
  priority: TicketPriority
  message: string
  attachments?: File[]
}

function getInitials(author: TicketAuthor | null) {
  const source = author?.name || author?.email || "?"
  return source.trim().slice(0, 1).toUpperCase()
}

function getAvatarUrl(avatar: string | null | undefined) {
  if (!avatar) return null
  if (avatar.startsWith("http")) return avatar
  const base = (
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"
  ).replace(/\/api$/, "")
  return `${base}${avatar}`
}

function getAttachmentUrl(url: string) {
  if (url.startsWith("http")) return url
  const base = (
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"
  ).replace(/\/api$/, "")
  return `${base}${url}`
}

function formatFileSize(size?: number | null) {
  if (!size) return null
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function TicketStatusBadge({
  status,
  ticket,
}: {
  status: TicketStatus | TicketDisplayStatus
  ticket?: Pick<TicketSummary, "status" | "latestMessage" | "closedAt">
}) {
  const displayStatus = ticket ? getTicketDisplayStatus(ticket) : status
  const label =
    displayStatus in TICKET_DISPLAY_STATUS_LABELS
      ? TICKET_DISPLAY_STATUS_LABELS[displayStatus as TicketDisplayStatus]
      : TICKET_STATUS_LABELS[displayStatus as TicketStatus]

  const variant =
    displayStatus === "CLOSED" || displayStatus === "RESOLVED"
      ? "outline"
      : displayStatus === "WAITING_ON_CUSTOMER"
        ? "secondary"
        : "default"

  return <Badge variant={variant}>{label}</Badge>
}

export function TicketPriorityBadge({
  priority,
}: {
  priority: TicketPriority
}) {
  const variant =
    priority === "URGENT"
      ? "destructive"
      : priority === "HIGH"
        ? "secondary"
        : "outline"

  return <Badge variant={variant}>{TICKET_PRIORITY_LABELS[priority]}</Badge>
}

export function TicketFilters({
  search,
  status,
  priority,
  department,
  meta,
  onSearchChange,
  onStatusChange,
  onPriorityChange,
  onDepartmentChange,
}: {
  search: string
  status: FilterValue<TicketDisplayStatus>
  priority: FilterValue<TicketPriority>
  department: FilterValue<TicketCategory>
  meta: TicketMeta
  onSearchChange: (value: string) => void
  onStatusChange: (value: FilterValue<TicketDisplayStatus>) => void
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
          placeholder="Search subject or ticket ID..."
          className="pl-8"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:flex">
        <Select
          value={status}
          onValueChange={(value) =>
            onStatusChange(value as FilterValue<TicketDisplayStatus>)
          }
        >
          <SelectTrigger className="w-full sm:min-w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {TICKET_DISPLAY_FILTERS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={priority}
          onValueChange={(value) =>
            onPriorityChange(value as FilterValue<TicketPriority>)
          }
        >
          <SelectTrigger className="w-full sm:min-w-36">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="ALL">All priorities</SelectItem>
              {meta.priorities.map((option) => (
                <SelectItem key={option} value={option}>
                  {TICKET_PRIORITY_LABELS[option]}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select
          value={department}
          onValueChange={(value) =>
            onDepartmentChange(value as FilterValue<TicketCategory>)
          }
        >
          <SelectTrigger className="w-full sm:min-w-40">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="ALL">All departments</SelectItem>
              {meta.categories.map((option) => (
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

export function TicketTable({
  tickets,
  loading,
  onOpenTicket,
  onCreateTicket,
}: {
  tickets: TicketSummary[]
  loading: boolean
  onOpenTicket: (ticketId: string) => void
  onCreateTicket: () => void
}) {
  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle>Ticket history</CardTitle>
        <CardDescription>
          Review recent activity, status, priority, and support replies.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <TicketTableSkeleton /> : null}
        {!loading && tickets.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
              <InboxIcon className="size-5 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-medium">No tickets yet</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Create a support ticket when you need help with your account,
                billing, or servers.
              </p>
            </div>
            <Button onClick={onCreateTicket}>
              <PlusIcon data-icon="inline-start" />
              Create your first ticket
            </Button>
          </div>
        ) : null}
        {!loading && tickets.length > 0 ? (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket ID</TableHead>
                    <TableHead>Subject</TableHead>
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
                    <TicketTableRow
                      key={ticket.id}
                      ticket={ticket}
                      onOpenTicket={onOpenTicket}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-3 p-3 md:hidden">
              {tickets.map((ticket) => (
                <TicketMobileCard
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

function TicketTableRow({
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
      <TableCell>{TICKET_CATEGORY_LABELS[ticket.category]}</TableCell>
      <TableCell>
        <TicketStatusBadge status={getTicketDisplayStatus(ticket)} />
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

function TicketMobileCard({
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-muted-foreground">
            {formatTicketId(ticket.id)}
          </p>
          <p className="mt-1 truncate font-medium">{ticket.subject}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {TICKET_CATEGORY_LABELS[ticket.category]}
          </p>
        </div>
        <ChevronRightIcon className="size-4 text-muted-foreground" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <TicketStatusBadge status={getTicketDisplayStatus(ticket)} />
        <TicketPriorityBadge priority={ticket.priority} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>Last reply {formatTicketDate(ticket.lastMessageAt)}</span>
        <span>Created {formatTicketDate(ticket.createdAt)}</span>
      </div>
    </button>
  )
}

function TicketTableSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <Skeleton key={index} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  )
}

export function TicketSummaryCard({
  ticket,
  selected,
  onSelect,
  showRequester = false,
}: {
  ticket: TicketSummary
  selected: boolean
  onSelect: () => void
  showRequester?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl border border-border/70 bg-background/70 p-4 text-left transition-all hover:border-primary/35 hover:bg-muted/30",
        selected && "border-primary/55 bg-primary/6 shadow-sm"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-2xl bg-primary/8 text-primary">
          <MessageSquareIcon className="size-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{ticket.subject}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {TICKET_CATEGORY_LABELS[ticket.category]} ticket
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <TicketStatusBadge status={ticket.status} />
              <TicketPriorityBadge priority={ticket.priority} />
            </div>
          </div>

          {showRequester && ticket.requester ? (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <AuthorAvatar author={ticket.requester} />
              <span className="truncate">
                {ticket.requester.name || ticket.requester.email}
              </span>
            </div>
          ) : null}

          {ticket.latestMessage ? (
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
              {ticket.latestMessage.message}
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No messages yet.
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <SparklesIcon className="size-3.5" />
              {ticket.messageCount} updates
            </span>
            <span>{formatTicketDate(ticket.lastMessageAt)}</span>
          </div>
        </div>
      </div>
    </button>
  )
}

export function TicketMessageList({
  ticket,
  viewer = "user",
}: {
  ticket: TicketDetail
  viewer?: "user" | "admin"
}) {
  if (ticket.messages.length === 0) {
    return (
      <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-xl bg-muted/30 px-6 text-center">
        <InboxIcon className="size-8 text-muted-foreground" />
        <div className="flex flex-col gap-1">
          <p className="font-medium">No messages yet</p>
          <p className="text-sm text-muted-foreground">
            Replies will appear here once the conversation starts.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {ticket.messages.map((message) => {
        const author = message.author
        const isSupport = message.isAdmin
        const authorLabel = getTicketMessageAuthorLabel(message, viewer)
        const badgeLabel = getTicketMessageRoleLabel(message, viewer)

        return (
          <div
            key={message.id}
            className={cn(
              "flex w-full gap-3",
              isSupport ? "justify-start" : "justify-end"
            )}
          >
            {isSupport ? <AuthorAvatar author={author} size="lg" /> : null}
            <div
              className={cn(
                "max-w-3xl rounded-2xl border px-4 py-3.5 shadow-sm",
                isSupport ? "bg-muted/40" : "border-primary/25 bg-primary/8"
              )}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{authorLabel}</span>
                <Badge variant={isSupport ? "secondary" : "outline"}>
                  {badgeLabel}
                </Badge>
                <span>{formatTicketDate(message.createdAt)}</span>
              </div>
              <p className="mt-2 text-sm leading-6 whitespace-pre-wrap">
                {message.message}
              </p>
              {message.attachments && message.attachments.length > 0 ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {message.attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={getAttachmentUrl(attachment.url)}
                      target="_blank"
                      rel="noreferrer"
                      className="overflow-hidden rounded-lg border bg-background/70 text-xs hover:bg-muted/50"
                    >
                      {attachment.mimeType?.startsWith("image/") ? (
                        <div className="relative h-32 bg-muted">
                          <Image
                            src={getAttachmentUrl(attachment.url)}
                            alt={attachment.name}
                            fill
                            sizes="(max-width: 640px) 100vw, 320px"
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : null}
                      <div className="flex items-center gap-2 px-3 py-2">
                        <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">
                          {attachment.name}
                        </span>
                        {formatFileSize(attachment.size) ? (
                          <span className="text-muted-foreground">
                            {formatFileSize(attachment.size)}
                          </span>
                        ) : null}
                      </div>
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
            {!isSupport ? <AuthorAvatar author={author} size="lg" /> : null}
          </div>
        )
      })}
    </div>
  )
}

export function TicketThread({
  ticket,
  viewer = "user",
}: {
  ticket: TicketDetail
  viewer?: "user" | "admin"
}) {
  return <TicketMessageList ticket={ticket} viewer={viewer} />
}

export function TicketReplyComposer({
  value,
  onChange,
  onSend,
  sending,
  disabled,
  onReopen,
  reopening,
  title = "Reply",
  disabledDescription = "This ticket is resolved. Reopen it to reply.",
}: {
  value: string
  onChange: (value: string) => void
  onSend: (attachments: File[]) => Promise<void> | void
  sending: boolean
  disabled?: boolean
  onReopen?: () => void
  reopening?: boolean
  title?: string
  disabledDescription?: string
}) {
  const [attachments, setAttachments] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)

  const addAttachments = (files: FileList | null) => {
    if (!files) return
    setAttachments((current) => [...current, ...Array.from(files)].slice(0, 5))
    if (inputRef.current) inputRef.current.value = ""
  }

  const removeAttachment = (index: number) => {
    setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  const handleSend = async () => {
    await onSend(attachments)
    setAttachments([])
  }

  const canSend = value.trim().length > 0 && !sending

  return (
    <Card className="sticky bottom-4 shadow-sm">
      <CardHeader className="border-b pb-3">
        <CardTitle>{title}</CardTitle>
        {disabled ? <CardDescription>{disabledDescription}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Type your reply..."
          disabled={disabled || sending}
          className="min-h-28"
        />
        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <Badge key={`${file.name}-${index}`} variant="secondary">
                <PaperclipIcon data-icon="inline-start" />
                <span className="max-w-48 truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(index)}
                  className="ml-1 rounded-sm hover:text-foreground"
                >
                  <XIcon className="size-3" />
                  <span className="sr-only">Remove attachment</span>
                </button>
              </Badge>
            ))}
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="justify-between gap-3">
        <div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.txt"
            className="hidden"
            onChange={(event) => addAttachments(event.target.files)}
          />
          <Button
            variant="outline"
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || sending || attachments.length >= 5}
          >
            <PaperclipIcon data-icon="inline-start" />
            Attach
          </Button>
        </div>
        {disabled && onReopen ? (
          <Button variant="outline" onClick={onReopen} disabled={reopening}>
            {reopening ? (
              <Loader2Icon data-icon="inline-start" className="animate-spin" />
            ) : null}
            Reopen ticket
          </Button>
        ) : (
          <Button onClick={handleSend} disabled={!canSend}>
            {sending ? (
              <Loader2Icon data-icon="inline-start" className="animate-spin" />
            ) : (
              <SendIcon data-icon="inline-start" />
            )}
            Send Reply
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

export function CreateTicketDialog({
  open,
  onOpenChange,
  meta,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  meta: TicketMeta
  onCreate: (values: CreateTicketValues) => Promise<void>
}) {
  const [subject, setSubject] = useState("")
  const [category, setCategory] = useState<TicketCategory>("GENERAL")
  const [priority, setPriority] = useState<TicketPriority>("MEDIUM")
  const [message, setMessage] = useState("")
  const [attachments, setAttachments] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const subjectInvalid = submitted && !subject.trim()
  const messageInvalid = submitted && !message.trim()

  const reset = () => {
    setSubject("")
    setCategory("GENERAL")
    setPriority("MEDIUM")
    setMessage("")
    setAttachments([])
    setSubmitted(false)
    setError(null)
  }

  const addAttachments = (files: FileList | null) => {
    if (!files) return
    setAttachments((current) => [...current, ...Array.from(files)].slice(0, 5))
    if (inputRef.current) inputRef.current.value = ""
  }

  const removeAttachment = (index: number) => {
    setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  const handleCreate = async () => {
    setSubmitted(true)
    setError(null)

    if (!subject.trim() || !message.trim()) return

    try {
      setSubmitting(true)
      await onCreate({
        subject: subject.trim(),
        category,
        priority,
        message: message.trim(),
        attachments,
      })
      reset()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ticket")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) reset()
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Ticket</DialogTitle>
          <DialogDescription>
            Start a focused support request with the details our team needs.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {error ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-2" data-invalid={subjectInvalid || undefined}>
            <Label htmlFor="ticket-subject">Subject</Label>
            <Input
              id="ticket-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Briefly describe the issue"
              aria-invalid={subjectInvalid}
            />
            {subjectInvalid ? (
              <p className="text-xs text-destructive">Subject is required.</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ticket-category">Department</Label>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as TicketCategory)}
              >
                <SelectTrigger id="ticket-category" className="w-full">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {meta.categories.map((option) => (
                      <SelectItem key={option} value={option}>
                        {TICKET_CATEGORY_LABELS[option]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ticket-priority">Priority</Label>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as TicketPriority)}
              >
                <SelectTrigger id="ticket-priority" className="w-full">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {meta.priorities.map((option) => (
                      <SelectItem key={option} value={option}>
                        {TICKET_PRIORITY_LABELS[option]}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2" data-invalid={messageInvalid || undefined}>
            <Label htmlFor="ticket-message">Message</Label>
            <Textarea
              id="ticket-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Share what happened, what you expected, and what you already tried."
              aria-invalid={messageInvalid}
              className="min-h-36"
            />
            {messageInvalid ? (
              <p className="text-xs text-destructive">Message is required.</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt"
              className="hidden"
              onChange={(event) => addAttachments(event.target.files)}
            />
            <Button
              variant="outline"
              type="button"
              className="w-fit"
              onClick={() => inputRef.current?.click()}
              disabled={attachments.length >= 5}
            >
              <PaperclipIcon data-icon="inline-start" />
              Attach files
            </Button>
            {attachments.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {attachments.map((file, index) => (
                  <Badge key={`${file.name}-${index}`} variant="secondary">
                    <PaperclipIcon data-icon="inline-start" />
                    <span className="max-w-48 truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="ml-1 rounded-sm hover:text-foreground"
                    >
                      <XIcon className="size-3" />
                      <span className="sr-only">Remove attachment</span>
                    </button>
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={submitting}>
            {submitting ? (
              <Loader2Icon data-icon="inline-start" className="animate-spin" />
            ) : (
              <PlusIcon data-icon="inline-start" />
            )}
            Create Ticket
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function TicketRequesterCard({
  author,
}: {
  author: TicketAuthor | null
}) {
  if (!author) {
    return (
      <div className="rounded-xl border p-4 text-sm text-muted-foreground">
        Requester details are unavailable.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
      <div className="flex items-center gap-3">
        <AuthorAvatar author={author} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-medium">{author.name || author.email}</p>
          <p className="truncate text-sm text-muted-foreground">
            {author.email}
          </p>
        </div>
      </div>
    </div>
  )
}

export function TicketMetadataGrid({
  ticket,
  statusMode = "display",
}: {
  ticket: TicketDetail
  statusMode?: "display" | "raw"
}) {
  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle>Ticket Details</CardTitle>
        <CardDescription>{formatTicketId(ticket.id)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <MetadataRow label="Department" value={TICKET_CATEGORY_LABELS[ticket.category]} />
        <MetadataRow label="Created" value={formatTicketDate(ticket.createdAt)} />
        <MetadataRow label="Last updated" value={formatTicketDate(ticket.updatedAt)} />
        {/* TODO: Replace with assigned staff when the ticket API exposes assignee data. */}
        <MetadataRow label="Assigned staff" value="Unassigned" />
        <Separator />
        <div className="flex flex-wrap gap-2">
          <TicketStatusBadge
            status={
              statusMode === "raw" ? ticket.status : getTicketDisplayStatus(ticket)
            }
          />
          <TicketPriorityBadge priority={ticket.priority} />
        </div>
      </CardContent>
    </Card>
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

function AuthorAvatar({
  author,
  size = "default",
}: {
  author: TicketAuthor | null
  size?: "default" | "lg"
}) {
  return (
    <Avatar size={size}>
      {getAvatarUrl(author?.avatar) ? (
        <AvatarImage
          src={getAvatarUrl(author?.avatar)!}
          alt={author?.name || author?.email || "Avatar"}
        />
      ) : null}
      <AvatarFallback>{getInitials(author)}</AvatarFallback>
    </Avatar>
  )
}
