import { Controller, Get, Post, Body, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { JwtService } from '@nestjs/jwt';
import { TotpService } from './totp.service.js';
import { AuthService } from './auth.service.js';

@Controller('auth/2fa')
export class TotpController {
  constructor(
    private totpService: TotpService,
    private jwtService: JwtService,
    private authService: AuthService,
  ) {}

  private getUserId(req: Request): string {
    const auth = req.headers['authorization'] || '';
    const token = auth.replace('Bearer ', '');
    const payload: any = this.jwtService.verify(token);
    return payload.sub;
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  async status(@Req() req: Request) {
    const userId = this.getUserId(req);
    return this.totpService.getStatus(userId);
  }

  @Post('setup')
  @UseGuards(JwtAuthGuard)
  async setup(@Req() req: Request) {
    const userId = this.getUserId(req);
    return this.totpService.generateSetup(userId);
  }

  @Post('enable')
  @UseGuards(JwtAuthGuard)
  async enable(@Req() req: Request, @Body('code') code: string) {
    const userId = this.getUserId(req);
    return this.totpService.enable(userId, code);
  }

  @Post('disable')
  @UseGuards(JwtAuthGuard)
  async disable(@Req() req: Request, @Body('code') code: string) {
    const userId = this.getUserId(req);
    return this.totpService.disable(userId, code);
  }

  @Post('verify')
  async verify(
    @Body('challengeToken') challengeToken: string,
    @Body('code') code: string,
    @Req() req: Request,
  ) {
    let payload: any;
    try {
      payload = this.jwtService.verify(challengeToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired challenge token');
    }
    if (!payload.require2fa) throw new UnauthorizedException('Invalid challenge token');
    const valid = await this.totpService.verify(payload.sub, code);
    if (!valid) throw new UnauthorizedException('Invalid 2FA code');
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.authService.completeLogin(payload.sub, ipAddress, userAgent);
  }
}
