import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../errors/AppError.js";

const publicUserSelect = { id: true, firstName: true, lastName: true, email: true, role: true, phone: true, company: true, department: true, position: true, preferredLanguage: true, isActive: true, lastLoginAt: true, createdAt: true } as const;

function signAccessToken(user: { id: string; role: UserRole; tokenVersion: number }): string {
  return jwt.sign({ role: user.role, tokenVersion: user.tokenVersion }, env.JWT_SECRET, { subject: user.id, expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });
}

export async function authenticateUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  const genericError = new AppError("E-Mail-Adresse oder Passwort ist nicht korrekt.", 401, "INVALID_CREDENTIALS");
  if (!user) { await bcrypt.compare(password, "$2b$12$ZxZLzIgRlfzKZSQKJeyIauJgJie1IHFYA/UBxQqKcmTkB96x/JRUW"); throw genericError; }
  if (!user.isActive || (user.lockedUntil && user.lockedUntil > new Date())) throw genericError;
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    const attempts = user.failedLoginAttempts + 1;
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: attempts, ...(attempts >= 5 ? { lockedUntil: new Date(Date.now() + 15 * 60_000) } : {}) } });
    throw genericError;
  }
  const updated = await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() }, select: { ...publicUserSelect, tokenVersion: true } });
  return { user: updated, token: signAccessToken(updated) };
}

export async function createResetToken(email: string): Promise<string | undefined> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, isActive: true } });
  if (!user?.isActive) return undefined;
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 60 * 60_000) } }),
  ]);
  return token;
}

export async function useResetToken(token: string, password: string): Promise<void> {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!reset || reset.usedAt || reset.expiresAt <= new Date()) throw new AppError("Der Link zum Zurücksetzen ist ungültig oder abgelaufen.", 400, "INVALID_RESET_TOKEN");
  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: await bcrypt.hash(password, 12), tokenVersion: { increment: 1 }, failedLoginAttempts: 0, lockedUntil: null } }),
    prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
  ]);
}

export { publicUserSelect };
