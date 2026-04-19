import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { SettingsService } from '../settings/settings.service.js';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class MailService {
  constructor(private settings: SettingsService) {}

  private async getTransporter(): Promise<Transporter | null> {
    const config = await this.settings.getMany([
      'mail.enabled',
      'mail.host',
      'mail.port',
      'mail.secure',
      'mail.user',
      'mail.pass',
      'mail.from',
    ]);

    if (config['mail.enabled'] !== 'true') return null;
    if (!config['mail.host'] || !config['mail.user']) return null;

    return nodemailer.createTransport({
      host: config['mail.host'],
      port: parseInt(config['mail.port'] || '587', 10),
      secure: config['mail.secure'] === 'true',
      auth: {
        user: config['mail.user'],
        pass: config['mail.pass'] || '',
      },
    });
  }

  private async getBrand(): Promise<{ name: string; logo: string; url: string }> {
    const brand = await this.settings.getMany(['panel.name', 'panel.logo', 'mail.from']);
    const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
    return {
      name: brand['panel.name'] || 'Panel',
      logo: brand['panel.logo'] || '',
      url: corsOrigin,
    };
  }

  private loadTemplate(templateName: string): string {
    const templatePath = path.join(process.cwd(), 'src', 'mail', 'templates', `${templateName}.html`);
    // Fallback: check dist path for production builds
    if (!fs.existsSync(templatePath)) {
      const distPath = path.join(process.cwd(), 'dist', 'src', 'mail', 'templates', `${templateName}.html`);
      if (fs.existsSync(distPath)) return fs.readFileSync(distPath, 'utf-8');
    }
    return fs.readFileSync(templatePath, 'utf-8');
  }

  private renderTemplate(template: string, variables: Record<string, string>): string {
    let html = template;
    for (const [key, value] of Object.entries(variables)) {
      html = html.replaceAll(`{{${key}}}`, value);
    }
    return html;
  }

  async sendVerificationEmail(email: string, name: string, token: string): Promise<boolean> {
    const transporter = await this.getTransporter();
    if (!transporter) return false;

    const brand = await this.getBrand();
    const fromAddress = (await this.settings.get('mail.from')) || `noreply@${brand.name.toLowerCase().replace(/\s/g, '')}.com`;
    const verifyUrl = `${brand.url}/authentication/verify?token=${token}`;

    try {
      const template = this.loadTemplate('verify-email');
      const html = this.renderTemplate(template, {
        name: name || 'User',
        panelName: brand.name,
        panelLogo: brand.logo,
        panelUrl: brand.url,
        verifyUrl,
        year: new Date().getFullYear().toString(),
      });

      await transporter.sendMail({
        from: `"${brand.name}" <${fromAddress}>`,
        to: email,
        subject: `Verify your email — ${brand.name}`,
        html,
      });
      return true;
    } catch (err: any) {
      console.error('[Mail] Failed to send verification email:', err.message);
      return false;
    }
  }

  async sendNewLoginEmail(
    email: string,
    name: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<boolean> {
    const transporter = await this.getTransporter();
    if (!transporter) return false;

    const loginNotify = await this.settings.get('mail.login_notify');
    if (loginNotify === 'false') return false;

    const brand = await this.getBrand();
    const fromAddress = (await this.settings.get('mail.from')) || `noreply@${brand.name.toLowerCase().replace(/\s/g, '')}.com`;

    try {
      const template = this.loadTemplate('new-login');
      const html = this.renderTemplate(template, {
        name: name || 'User',
        panelName: brand.name,
        panelLogo: brand.logo,
        panelUrl: brand.url,
        ipAddress: ipAddress || 'Unknown',
        userAgent: userAgent || 'Unknown',
        time: new Date().toUTCString(),
        year: new Date().getFullYear().toString(),
      });

      await transporter.sendMail({
        from: `"${brand.name}" <${fromAddress}>`,
        to: email,
        subject: `New login detected — ${brand.name}`,
        html,
      });
      return true;
    } catch (err: any) {
      console.error('[Mail] Failed to send new login email:', err.message);
      return false;
    }
  }

  async sendTestEmail(toEmail: string): Promise<{ success: boolean; error?: string }> {
    const transporter = await this.getTransporter();
    if (!transporter) return { success: false, error: 'Email is disabled or not configured' };

    const brand = await this.getBrand();
    const fromAddress = (await this.settings.get('mail.from')) || `noreply@${brand.name.toLowerCase().replace(/\s/g, '')}.com`;

    try {
      const template = this.loadTemplate('test');
      const html = this.renderTemplate(template, {
        panelName: brand.name,
        panelLogo: brand.logo,
        panelUrl: brand.url,
        year: new Date().getFullYear().toString(),
      });

      await transporter.sendMail({
        from: `"${brand.name}" <${fromAddress}>`,
        to: toEmail,
        subject: `Test email — ${brand.name}`,
        html,
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
