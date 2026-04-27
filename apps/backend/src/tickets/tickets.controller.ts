import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { TicketsService } from './tickets.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { Permissions } from '../auth/decorators/permissions.decorator.js';

type AuthenticatedRequest = {
  user: {
    id: string;
  };
};

type UploadedTicketFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const ticketUploadOptions = {
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
};

@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private ticketsService: TicketsService) {}

  @Get('meta')
  getMeta() {
    return this.ticketsService.getMeta();
  }

  @Get()
  listMyTickets(
    @Request() req: AuthenticatedRequest,
    @Query('status') status?: string,
  ) {
    return this.ticketsService.listForUser(req.user.id, status);
  }

  @Post()
  @UseInterceptors(FilesInterceptor('attachments', 5, ticketUploadOptions))
  createTicket(
    @Request() req: AuthenticatedRequest,
    @Body()
    body: {
      subject?: string;
      message?: string;
      category?: string;
      priority?: string;
    },
    @UploadedFiles() files?: UploadedTicketFile[],
  ) {
    return this.ticketsService.createForUser(req.user.id, body, files ?? []);
  }

  @Get(':id')
  getMyTicket(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.ticketsService.getForUser(req.user.id, id);
  }

  @Post(':id/messages')
  @UseInterceptors(FilesInterceptor('attachments', 5, ticketUploadOptions))
  addMyReply(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { message?: string },
    @UploadedFiles() files?: UploadedTicketFile[],
  ) {
    return this.ticketsService.addReplyForUser(
      req.user.id,
      id,
      body,
      files ?? [],
    );
  }

  @Patch(':id/status')
  updateMyStatus(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { status?: string },
  ) {
    return this.ticketsService.updateStatusForUser(req.user.id, id, body);
  }
}

@Controller('admin/tickets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminTicketsController {
  constructor(private ticketsService: TicketsService) {}

  @Get()
  @Permissions('tickets.read')
  listTickets(@Query('status') status?: string) {
    return this.ticketsService.listForAdmin(status);
  }

  @Get(':id')
  @Permissions('tickets.read')
  getTicket(@Param('id') id: string) {
    return this.ticketsService.getForAdmin(id);
  }

  @Post(':id/messages')
  @Permissions('tickets.write')
  @UseInterceptors(FilesInterceptor('attachments', 5, ticketUploadOptions))
  addReply(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { message?: string },
    @UploadedFiles() files?: UploadedTicketFile[],
  ) {
    return this.ticketsService.addReplyForAdmin(
      req.user.id,
      id,
      body,
      files ?? [],
    );
  }

  @Patch(':id/status')
  @Permissions('tickets.write')
  updateStatus(@Param('id') id: string, @Body() body: { status?: string }) {
    return this.ticketsService.updateStatusForAdmin(id, body);
  }
}
