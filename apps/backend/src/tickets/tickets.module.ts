import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service.js';
import { TicketsGateway } from './tickets.gateway.js';
import {
  AdminTicketsController,
  TicketsController,
} from './tickets.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [TicketsController, AdminTicketsController],
  providers: [TicketsService, TicketsGateway],
  exports: [TicketsService],
})
export class TicketsModule {}
