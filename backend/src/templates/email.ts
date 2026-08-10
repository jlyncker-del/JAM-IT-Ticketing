import { env } from "../config/env.js";

const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

export function passwordResetEmail(input: { recipientName: string; resetUrl: string }): { subject: string; text: string; html: string } {
  const subject = `Passwort für ${env.APP_NAME} zurücksetzen`;
  const text = `Hallo ${input.recipientName},\n\nüber den folgenden Link können Sie Ihr Passwort zurücksetzen:\n${input.resetUrl}\n\nDer Link ist 60 Minuten gültig. Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.\n\n${env.COMPANY_NAME}`;
  const html = `<p>Hallo ${escapeHtml(input.recipientName)},</p><p>über den folgenden Link können Sie Ihr Passwort zurücksetzen:</p><p><a href="${escapeHtml(input.resetUrl)}">Passwort zurücksetzen</a></p><p>Der Link ist 60 Minuten gültig. Falls Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.</p><p>${escapeHtml(env.COMPANY_NAME)}</p>`;
  return { subject, text, html };
}
