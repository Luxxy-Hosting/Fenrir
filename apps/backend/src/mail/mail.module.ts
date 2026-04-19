import { Module, Global } from '@nestjs/common';
import { MailService } from './mail.service.js';
import { SettingsModule } from '../settings/settings.module.js';

@Global()
@Module({
  imports: [SettingsModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
