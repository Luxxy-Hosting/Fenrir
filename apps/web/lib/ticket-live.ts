"use client"

import { useEffect, useRef } from "react"
import type { TicketDetail } from "@/lib/api"
import { getAccessToken } from "@/lib/auth"

type TicketLiveEvent = {
  type: "ticket.created" | "ticket.updated" | "ticket.message.created"
  ticket: TicketDetail
}

type TicketLiveOptions = {
  onTicketCreated?: (ticket: TicketDetail) => void
  onTicketUpdated?: (ticket: TicketDetail) => void
  onTicketMessage?: (ticket: TicketDetail) => void
}

function getTicketsWebSocketUrl(token: string) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"
  const wsBase = apiBase.replace(/^http/, "ws").replace(/\/$/, "")
  return `${wsBase}/tickets/ws?token=${encodeURIComponent(token)}`
}

export function useTicketLiveEvents(options: TicketLiveOptions) {
  const optionsRef = useRef(options)

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  useEffect(() => {
    const token = getAccessToken()
    if (!token) return

    let closed = false
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let socket: WebSocket | null = null

    const connect = () => {
      if (closed) return
      socket = new WebSocket(getTicketsWebSocketUrl(token))

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as TicketLiveEvent | { type: string }
          if (!("ticket" in data)) return

          if (data.type === "ticket.created") {
            optionsRef.current.onTicketCreated?.(data.ticket)
          } else if (data.type === "ticket.updated") {
            optionsRef.current.onTicketUpdated?.(data.ticket)
          } else if (data.type === "ticket.message.created") {
            optionsRef.current.onTicketMessage?.(data.ticket)
          }
        } catch {
          // Ignore malformed socket messages.
        }
      }

      socket.onclose = () => {
        if (closed) return
        reconnectTimer = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      closed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [])
}
