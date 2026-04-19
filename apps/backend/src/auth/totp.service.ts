import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { authenticator } from '@otplib/preset-default';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';

@Injectable()
export class TotpService {
  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  async generateSetup(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const secret = authenticator.generateSecret();
    const panelName = (await this.settings.get('panel.name')) || 'Panel';
    const otpauth = authenticator.keyuri(user.email, panelName, secret);
    const qrCode = await QRCode.toDataURL(otpauth);

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secret, totpEnabled: false },
    });

    return { secret, qrCode };
  }

  async enable(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecret) throw new BadRequestException('2FA setup not started');
    if (!authenticator.verify({ token: code, secret: user.totpSecret })) {
      throw new BadRequestException('Invalid code');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { totpEnabled: true } });
    return { message: '2FA enabled' };
  }

  async disable(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpEnabled || !user?.totpSecret) throw new BadRequestException('2FA is not enabled');
    if (!authenticator.verify({ token: code, secret: user.totpSecret })) {
      throw new UnauthorizedException('Invalid code');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecret: null },
    });
    return { message: '2FA disabled' };
  }

  async verify(userId: string, code: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpEnabled || !user?.totpSecret) return true;
    return authenticator.verify({ token: code, secret: user.totpSecret });
  }

  async getStatus(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return { enabled: user?.totpEnabled ?? false };
  }
}
