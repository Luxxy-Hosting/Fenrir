import {
  BadRequestException,
  Injectable,
  NotFoundException,
  type OnModuleInit,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TicketsGateway } from './tickets.gateway.js';

const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'CLOSED'] as const;
const USER_TICKET_STATUSES = ['OPEN', 'CLOSED'] as const;
const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const TICKET_CATEGORIES = [
  'GENERAL',
  'BILLING',
  'TECHNICAL',
  'ACCOUNT',
] as const;

const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
] as const;

const MAX_TICKET_ATTACHMENTS = 5;
const MAX_TICKET_ATTACHMENT_SIZE = 8 * 1024 * 1024;

const ticketAuthorSelect = {
  id: true,
  name: true,
  email: true,
  avatar: true,
} satisfies Prisma.UserSelect;

const ticketListArgs = {
  include: {
    user: {
      select: ticketAuthorSelect,
    },
    messages: {
      orderBy: { createdAt: 'desc' },
      take: 1,
      include: {
        user: {
          select: ticketAuthorSelect,
        },
        attachments: true,
      },
    },
    _count: {
      select: { messages: true },
    },
  },
} satisfies Prisma.TicketDefaultArgs;

const ticketDetailArgs = {
  include: {
    user: {
      select: ticketAuthorSelect,
    },
    messages: {
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: ticketAuthorSelect,
        },
        attachments: true,
      },
    },
    _count: {
      select: { messages: true },
    },
  },
} satisfies Prisma.TicketDefaultArgs;

type TicketListRecord = Prisma.TicketGetPayload<typeof ticketListArgs>;
type TicketDetailRecord = Prisma.TicketGetPayload<typeof ticketDetailArgs>;

type CreateTicketBody = {
  subject?: string;
  message?: string;
  category?: string;
  priority?: string;
};

type ReplyBody = {
  message?: string;
};

type UploadedTicketFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

type StatusBody = {
  status?: string;
};

@Injectable()
export class TicketsService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private ticketsGateway: TicketsGateway,
  ) {}

  async onModuleInit() {
    await this.ensureTicketPermissions();
  }

  async listForUser(userId: string, status?: string) {
    const normalizedStatus = status
      ? this.validateStatus(status, USER_TICKET_STATUSES)
      : undefined;

    const tickets = await this.prisma.ticket.findMany({
      where: {
        userId,
        ...(normalizedStatus ? { status: normalizedStatus } : {}),
      },
      ...ticketListArgs,
      orderBy: { lastMessageAt: 'desc' },
    });

    return tickets.map((ticket) => this.toTicketSummary(ticket));
  }

  async getForUser(userId: string, ticketId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, userId },
      ...ticketDetailArgs,
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const detail = this.toTicketDetail(ticket);
    this.ticketsGateway.broadcastTicketCreated(detail);
    return detail;
  }

  async createForUser(
    userId: string,
    body: CreateTicketBody,
    files: UploadedTicketFile[] = [],
  ) {
    const subject = this.normalizeSubject(body.subject);
    const message = this.normalizeMessage(body.message);
    const category = this.validateCategory(body.category);
    const priority = this.validatePriority(body.priority);
    const attachments = this.saveAttachments(files);
    const now = new Date();

    const ticket = await this.prisma.ticket.create({
      data: {
        userId,
        subject,
        category,
        priority,
        status: 'OPEN',
        lastMessageAt: now,
        messages: {
          create: {
            userId,
            isAdmin: false,
            message,
            attachments: attachments.length
              ? {
                  create: attachments,
                }
              : undefined,
          },
        },
      },
      ...ticketDetailArgs,
    });

    const detail = this.toTicketDetail(ticket);
    this.ticketsGateway.broadcastTicketMessage(detail);
    return detail;
  }

  async addReplyForUser(
    userId: string,
    ticketId: string,
    body: ReplyBody,
    files: UploadedTicketFile[] = [],
  ) {
    await this.assertOwnership(ticketId, userId);
    const message = this.normalizeMessage(body.message);
    const attachments = this.saveAttachments(files);
    const now = new Date();

    const ticket = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: 'OPEN',
        closedAt: null,
        lastMessageAt: now,
        messages: {
          create: {
            userId,
            isAdmin: false,
            message,
            attachments: attachments.length
              ? {
                  create: attachments,
                }
              : undefined,
          },
        },
      },
      ...ticketDetailArgs,
    });

    const detail = this.toTicketDetail(ticket);
    this.ticketsGateway.broadcastTicketUpdated(detail);
    return detail;
  }

  async updateStatusForUser(
    userId: string,
    ticketId: string,
    body: StatusBody,
  ) {
    await this.assertOwnership(ticketId, userId);
    const status = this.validateStatus(body.status, USER_TICKET_STATUSES);

    const ticket = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status,
        closedAt: status === 'CLOSED' ? new Date() : null,
      },
      ...ticketDetailArgs,
    });

    const detail = this.toTicketDetail(ticket);
    this.ticketsGateway.broadcastTicketMessage(detail);
    return detail;
  }

  async listForAdmin(status?: string) {
    const normalizedStatus = status
      ? this.validateStatus(status, TICKET_STATUSES)
      : undefined;

    const tickets = await this.prisma.ticket.findMany({
      where: normalizedStatus ? { status: normalizedStatus } : undefined,
      ...ticketListArgs,
      orderBy: { lastMessageAt: 'desc' },
    });

    return tickets.map((ticket) => this.toTicketSummary(ticket));
  }

  async getForAdmin(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      ...ticketDetailArgs,
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const detail = this.toTicketDetail(ticket);
    this.ticketsGateway.broadcastTicketUpdated(detail);
    return detail;
  }

  async addReplyForAdmin(
    adminUserId: string,
    ticketId: string,
    body: ReplyBody,
    files: UploadedTicketFile[] = [],
  ) {
    await this.assertTicketExists(ticketId);
    const message = this.normalizeMessage(body.message);
    const attachments = this.saveAttachments(files);
    const now = new Date();

    const ticket = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: 'IN_PROGRESS',
        closedAt: null,
        lastMessageAt: now,
        messages: {
          create: {
            userId: adminUserId,
            isAdmin: true,
            message,
            attachments: attachments.length
              ? {
                  create: attachments,
                }
              : undefined,
          },
        },
      },
      ...ticketDetailArgs,
    });

    return this.toTicketDetail(ticket);
  }

  async updateStatusForAdmin(ticketId: string, body: StatusBody) {
    await this.assertTicketExists(ticketId);
    const status = this.validateStatus(body.status, TICKET_STATUSES);

    const ticket = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status,
        closedAt: status === 'CLOSED' ? new Date() : null,
      },
      ...ticketDetailArgs,
    });

    return this.toTicketDetail(ticket);
  }

  getMeta() {
    return {
      statuses: [...TICKET_STATUSES],
      userStatuses: [...USER_TICKET_STATUSES],
      priorities: [...TICKET_PRIORITIES],
      categories: [...TICKET_CATEGORIES],
    };
  }

  private toTicketSummary(ticket: TicketListRecord | TicketDetailRecord) {
    const latestMessage = ticket.messages[0] ?? null;

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
      messageCount: ticket._count.messages,
      requester: {
        id: ticket.user.id,
        name: ticket.user.name,
        email: ticket.user.email,
        avatar: ticket.user.avatar,
      },
      latestMessage: latestMessage
        ? {
            id: latestMessage.id,
            message: latestMessage.message,
            createdAt: latestMessage.createdAt,
            isAdmin: latestMessage.isAdmin,
            attachments: latestMessage.attachments.map((attachment) =>
              this.toAttachment(attachment),
            ),
            author: latestMessage.user
              ? {
                  id: latestMessage.user.id,
                  name: latestMessage.user.name,
                  email: latestMessage.user.email,
                  avatar: latestMessage.user.avatar,
                }
              : null,
          }
        : null,
    };
  }

  private toTicketDetail(ticket: TicketDetailRecord) {
    return {
      ...this.toTicketSummary(ticket),
      messages: ticket.messages.map((message) => ({
        id: message.id,
        message: message.message,
        createdAt: message.createdAt,
        isAdmin: message.isAdmin,
        attachments: message.attachments.map((attachment) =>
          this.toAttachment(attachment),
        ),
        author: message.user
          ? {
              id: message.user.id,
              name: message.user.name,
              email: message.user.email,
              avatar: message.user.avatar,
            }
          : null,
      })),
    };
  }

  private toAttachment(
    attachment: TicketDetailRecord['messages'][number]['attachments'][number],
  ) {
    return {
      id: attachment.id,
      name: attachment.originalName,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      url: attachment.url,
      createdAt: attachment.createdAt,
    };
  }

  private normalizeSubject(subject?: string) {
    const value = subject?.trim() ?? '';
    if (value.length < 3) {
      throw new BadRequestException('Subject must be at least 3 characters');
    }
    if (value.length > 120) {
      throw new BadRequestException('Subject must be 120 characters or fewer');
    }
    return value;
  }

  private normalizeMessage(message?: string) {
    const value = message?.trim() ?? '';
    if (value.length < 5) {
      throw new BadRequestException('Message must be at least 5 characters');
    }
    if (value.length > 5000) {
      throw new BadRequestException('Message must be 5000 characters or fewer');
    }
    return value;
  }

  private saveAttachments(files: UploadedTicketFile[]) {
    if (files.length === 0) return [];
    if (files.length > MAX_TICKET_ATTACHMENTS) {
      throw new BadRequestException(
        `You can attach up to ${MAX_TICKET_ATTACHMENTS} files`,
      );
    }

    const uploadDir = path.join(process.cwd(), 'uploads', 'tickets');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    return files.map((file) => {
      if (!file) throw new BadRequestException('Invalid attachment');
      if (file.size > MAX_TICKET_ATTACHMENT_SIZE) {
        throw new BadRequestException('Attachment too large (max 8MB)');
      }
      if (
        !ALLOWED_ATTACHMENT_MIME_TYPES.includes(
          file.mimetype as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number],
        )
      ) {
        throw new BadRequestException(
          'Attachments must be images, PDFs, or plain text files',
        );
      }

      const ext = path.extname(file.originalname).toLowerCase();
      const fileName = `${randomUUID()}${ext}`;
      const filePath = path.join(uploadDir, fileName);
      fs.writeFileSync(filePath, file.buffer);

      return {
        fileName,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: `/uploads/tickets/${fileName}`,
      };
    });
  }

  private validateCategory(category?: string) {
    if (!category) return 'GENERAL';
    return this.validateStringEnum(
      category,
      TICKET_CATEGORIES,
      'Invalid ticket category',
    );
  }

  private validatePriority(priority?: string) {
    if (!priority) return 'MEDIUM';
    return this.validateStringEnum(
      priority,
      TICKET_PRIORITIES,
      'Invalid ticket priority',
    );
  }

  private validateStatus<T extends readonly string[]>(
    status: string | undefined,
    allowed: T,
  ) {
    if (!status) {
      throw new BadRequestException('Status is required');
    }
    return this.validateStringEnum(status, allowed, 'Invalid ticket status');
  }

  private validateStringEnum<T extends readonly string[]>(
    value: string,
    allowed: T,
    errorMessage: string,
  ): T[number] {
    const normalized = value.trim().toUpperCase();
    if (!allowed.includes(normalized as T[number])) {
      throw new BadRequestException(errorMessage);
    }
    return normalized as T[number];
  }

  private async assertOwnership(ticketId: string, userId: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, userId },
      select: { id: true },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
  }

  private async assertTicketExists(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
  }

  private async ensureTicketPermissions() {
    const adminRole = await this.prisma.role.findUnique({
      where: { name: 'admin' },
      select: { id: true },
    });

    const permissions = [
      { name: 'tickets.read', description: 'View support tickets' },
      {
        name: 'tickets.write',
        description: 'Reply to and update support tickets',
      },
    ];

    for (const permissionData of permissions) {
      const permission = await this.prisma.permission.upsert({
        where: { name: permissionData.name },
        update: { description: permissionData.description },
        create: permissionData,
      });

      if (adminRole) {
        await this.prisma.rolePermission
          .create({
            data: {
              roleId: adminRole.id,
              permissionId: permission.id,
            },
          })
          .catch(() => {});
      }
    }
  }
}
