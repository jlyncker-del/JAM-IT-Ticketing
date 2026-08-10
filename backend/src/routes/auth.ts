import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../errors/AppError.js";
import { authenticate } from "../middleware/auth.js";
import { writeAudit } from "../middleware/audit.js";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "../schemas/auth.js";
import { authenticateUser, createResetToken, publicUserSelect, useResetToken } from "../services/authService.js";
import { mailService } from "../services/mailService.js";
import { passwordResetEmail } from "../templates/email.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success } from "../utils/responses.js";

export const authRouter = Router();

authRouter.post("/register", asyncHandler(async (request, response) => {
  const input = registerSchema.parse(request.body);
  const { password, ...profile } = input;
  const user = await prisma.user.create({ data: { ...profile, passwordHash: await bcrypt.hash(password, 12), emailVerifiedAt: new Date() }, select: publicUserSelect });
  await writeAudit(request, "USER_REGISTERED", "User", user.id);
  return success(response, user, "Ihr Konto wurde erfolgreich erstellt.", 201);
}));

authRouter.post("/login", asyncHandler(async (request, response) => {
  const input = loginSchema.parse(request.body);
  try {
    const result = await authenticateUser(input.email, input.password);
    request.user = { id: result.user.id, role: result.user.role, tokenVersion: result.user.tokenVersion };
    await writeAudit(request, "LOGIN_SUCCESS", "User", result.user.id);
    return success(response, { token: result.token, user: result.user }, "Sie wurden erfolgreich angemeldet.");
  } catch (error) {
    await writeAudit(request, "LOGIN_FAILURE", "User", undefined, { emailHash: await bcrypt.hash(input.email, 4) });
    throw error;
  }
}));

authRouter.post("/logout", authenticate, asyncHandler(async (request, response) => {
  await prisma.user.update({ where: { id: request.user!.id }, data: { tokenVersion: { increment: 1 } } });
  await writeAudit(request, "LOGOUT", "User", request.user?.id);
  return success(response, null, "Sie wurden erfolgreich abgemeldet.");
}));

authRouter.get("/me", authenticate, asyncHandler(async (request, response) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user?.id }, select: publicUserSelect });
  return success(response, user);
}));

authRouter.patch("/profile", authenticate, asyncHandler(async (request, response) => {
  const input = z.object({
    firstName: z.string().trim().min(2).max(80),
    lastName: z.string().trim().min(2).max(80),
    phone: z.string().trim().max(40).nullable(),
    company: z.string().trim().max(120).nullable(),
    department: z.string().trim().max(120).nullable(),
    position: z.string().trim().max(120).nullable(),
  }).partial().parse(request.body);
  const user = await prisma.user.update({ where: { id: request.user!.id }, data: input, select: publicUserSelect });
  await writeAudit(request, "PROFILE_UPDATED", "User", user.id);
  return success(response, user, "Ihr Profil wurde aktualisiert.");
}));

authRouter.post("/change-password", authenticate, asyncHandler(async (request, response) => {
  const input = z.object({ currentPassword: z.string().min(1), newPassword: resetPasswordSchema.shape.password }).parse(request.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user!.id } });
  if (!(await bcrypt.compare(input.currentPassword, user.passwordHash))) throw new AppError("Das aktuelle Passwort ist nicht korrekt.", 400, "INVALID_CURRENT_PASSWORD");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(input.newPassword, 12), tokenVersion: { increment: 1 } } });
  await writeAudit(request, "PASSWORD_CHANGED", "User", user.id);
  return success(response, null, "Ihr Passwort wurde geändert. Bitte melden Sie sich erneut an.");
}));

authRouter.post("/forgot-password", asyncHandler(async (request, response) => {
  const { email } = forgotPasswordSchema.parse(request.body);
  const token = await createResetToken(email);
  if (token) {
    const user = await prisma.user.findUnique({ where: { email }, select: { firstName: true, lastName: true } });
    if (user) {
      const resetUrl = `${env.FRONTEND_URL}/passwort-zuruecksetzen?token=${encodeURIComponent(token)}`;
      await mailService.send({ to: email, ...passwordResetEmail({ recipientName: `${user.firstName} ${user.lastName}`, resetUrl }) });
    }
  }
  const data = env.NODE_ENV !== "production" && token ? { developmentResetToken: token } : null;
  return success(response, data, "Falls ein aktives Konto existiert, wurde eine E-Mail zum Zurücksetzen versendet.");
}));

authRouter.post("/reset-password", asyncHandler(async (request, response) => {
  const input = resetPasswordSchema.parse(request.body);
  await useResetToken(input.token, input.password);
  await writeAudit(request, "PASSWORD_RESET", "User");
  return success(response, null, "Ihr Passwort wurde erfolgreich geändert.");
}));
