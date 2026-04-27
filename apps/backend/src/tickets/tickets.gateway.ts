import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { IncomingMessage } from 'http';
import type { Server, WebSocket } from 'ws';
import { AuthService } from '../auth/auth.service.js';

type TicketClientUser = {
  id: string;
  role?: { name?: string; permissions?: { permission: { name: string } }[] };
};

type TicketEventPayload = {
  id: string;
  requester: { id: string } | null;
};

@WebSocketGateway({ path: '/api/tickets/ws' })
export class TicketsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private clients = new Map<WebSocket, TicketClientUser>();

  constructor(private authService: AuthService) {}

  async handleConnection(client: WebSocket, ...args: unknown[]) {
    try {
      const req = args[0] as IncomingMessage | undefined;
      const token = this.getToken(req);

      if (!token) {
        client.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }));
        client.close(4001, 'Unauthorized');
        return;
      }

      const user = await this.authService.validateToken(token);
      if (!user) {
        client.send(
          JSON.stringify({ type: 'error', message: 'Invalid token' }),
        );
        client.close(4001, 'Invalid token');
        return;
      }

      this.clients.set(client, user);
      client.on('close', () => this.clients.delete(client));
      client.send(JSON.stringify({ type: 'connected' }));
    } catch {
      try {
        client.close(4000, 'Connection error');
      } catch {
        this.clients.delete(client);
      }
    }
  }

  handleDisconnect(client: WebSocket) {
    this.clients.delete(client);
  }

  broadcastTicketCreated(ticket: TicketEventPayload) {
    this.broadcast('ticket.created', ticket);
  }

  broadcastTicketUpdated(ticket: TicketEventPayload) {
    this.broadcast('ticket.updated', ticket);
  }

  broadcastTicketMessage(ticket: TicketEventPayload) {
    this.broadcast('ticket.message.created', ticket);
  }

  private broadcast(type: string, ticket: TicketEventPayload) {
    for (const [client, user] of this.clients.entries()) {
      if (!this.canReceiveTicket(user, ticket)) continue;

      try {
        client.send(JSON.stringify({ type, ticket }));
      } catch {
        this.clients.delete(client);
      }
    }
  }

  private canReceiveTicket(user: TicketClientUser, ticket: TicketEventPayload) {
    if (ticket.requester?.id === user.id) return true;
    if (user.role?.name === 'admin') return true;
    return user.role?.permissions?.some(
      (rolePermission) => rolePermission.permission.name === 'tickets.read',
    );
  }

  private getToken(req?: IncomingMessage) {
    if (req?.url) {
      const url = new URL(req.url, 'http://localhost');
      const token = url.searchParams.get('token');
      if (token) return token;
    }

    if (req?.headers?.authorization) {
      return req.headers.authorization.replace('Bearer ', '');
    }

    return null;
  }
}
