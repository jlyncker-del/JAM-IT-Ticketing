import nodemailer from "nodemailer";
import { env } from "../config/env.js";

interface MailMessage { to: string; subject: string; text: string; html?: string }
export interface MailService { send(message: MailMessage): Promise<void> }

class DevelopmentMailService implements MailService {
  async send(message: MailMessage): Promise<void> {
    if (env.NODE_ENV === "development") console.info(`[E-Mail-Vorschau]\nAn: ${message.to}\nBetreff: ${message.subject}\n${message.text}`);
  }
}

class SmtpMailService implements MailService {
  private readonly transporter = nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465, auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined });
  async send(message: MailMessage): Promise<void> { await this.transporter.sendMail({ from: env.MAIL_FROM, ...message }); }
}

export const mailService: MailService = env.MAIL_PROVIDER === "smtp" ? new SmtpMailService() : new DevelopmentMailService();
