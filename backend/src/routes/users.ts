import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { AppError } from "../errors/AppError.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { writeAudit } from "../middleware/audit.js";
import { passwordSchema } from "../schemas/auth.js";
import { publicUserSelect } from "../services/authService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success } from "../utils/responses.js";

const userInput = z.object({ firstName: z.string().trim().min(2), lastName: z.string().trim().min(2), email: z.string().email().transform((value) => value.toLowerCase()), role: z.enum(["CUSTOMER", "AGENT", "ADMIN"]), phone: z.string().max(40).optional(), company: z.string().max(120).optional(), department: z.string().max(120).optional(), position: z.string().max(120).optional(), teamIds: z.array(z.string()).default([]) });
export const userRouter = Router();
userRouter.use(authenticate);

userRouter.get("/support-directory", authorize("AGENT", "ADMIN"), asyncHandler(async (_request, response) => success(response, await prisma.user.findMany({ where: { role: { in: ["AGENT", "ADMIN"] }, isActive: true }, select: { id: true, firstName: true, lastName: true, email: true, role: true }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }))));
userRouter.get("/customer-directory", authorize("AGENT", "ADMIN"), asyncHandler(async (request, response) => {
  const search = String(request.query.search ?? "").slice(0, 120);
  return success(response, await prisma.user.findMany({ where: { role: "CUSTOMER", isActive: true, ...(search ? { OR: [{ firstName: { contains: search, mode: "insensitive" } }, { lastName: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] } : {}) }, select: { id: true, firstName: true, lastName: true, email: true, company: true }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }], take: 100 }));
}));

userRouter.use(authorize("ADMIN"));

userRouter.get("/", asyncHandler(async (request, response) => {
  const search = String(request.query.search ?? "").slice(0, 120);
  const role = z.enum(["CUSTOMER", "AGENT", "ADMIN"]).optional().parse(request.query.role || undefined);
  const users = await prisma.user.findMany({ where: { ...(role ? { role } : {}), ...(search ? { OR: [{ firstName: { contains: search, mode: "insensitive" } }, { lastName: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] } : {}) }, select: { ...publicUserSelect, memberships: { select: { teamId: true, team: { select: { name: true } } } }, _count: { select: { customerTickets: true, assignedTickets: true } } }, orderBy: { createdAt: "desc" } });
  return success(response, users);
}));

userRouter.post("/", asyncHandler(async (request, response) => {
  const input = userInput.extend({ password: passwordSchema }).parse(request.body);
  const { password, teamIds, ...profile } = input;
  if (teamIds.length && profile.role === "CUSTOMER") throw new AppError("Kunden können keinem Supportteam zugeordnet werden.", 400, "INVALID_TEAM_MEMBERSHIP");
  if (teamIds.length && await prisma.supportTeam.count({ where: { id: { in: [...new Set(teamIds)] }, isActive: true } }) !== new Set(teamIds).size) throw new AppError("Mindestens ein Supportteam ist nicht verfügbar.", 400, "INVALID_TEAM");
  const user = await prisma.user.create({ data: { ...profile, passwordHash: await bcrypt.hash(password, 12), emailVerifiedAt: new Date(), memberships: { create: teamIds.map((teamId) => ({ teamId })) } }, select: publicUserSelect });
  await writeAudit(request, "USER_CREATED", "User", user.id, { role: user.role });
  return success(response, user, "Der Benutzer wurde erstellt.", 201);
}));

userRouter.patch("/:id", asyncHandler(async (request, response) => {
  const input = userInput.omit({ email: true, role: true, teamIds: true }).partial().parse(request.body);
  const user = await prisma.user.update({ where: { id: String(request.params.id) }, data: input, select: publicUserSelect });
  await writeAudit(request, "USER_UPDATED", "User", user.id);
  return success(response, user, "Der Benutzer wurde aktualisiert.");
}));

userRouter.patch("/:id/status", asyncHandler(async (request, response) => {
  const { isActive } = z.object({ isActive: z.boolean() }).parse(request.body);
  if (request.params.id === request.user!.id && !isActive) throw new AppError("Sie können Ihr eigenes Administratorkonto nicht deaktivieren.", 409, "SELF_DEACTIVATION");
  const target = await prisma.user.findUniqueOrThrow({ where: { id: String(request.params.id) }, select: { role: true, isActive: true } });
  if (!isActive && target.role === "ADMIN" && target.isActive && await prisma.user.count({ where: { role: "ADMIN", isActive: true } }) <= 1) throw new AppError("Der letzte aktive Administrator kann nicht deaktiviert werden.", 409, "LAST_ADMIN");
  const user = await prisma.$transaction(async (tx) => { const updated = await tx.user.update({ where: { id: String(request.params.id) }, data: { isActive, tokenVersion: { increment: 1 } }, select: publicUserSelect }); if (!isActive) await tx.ticket.updateMany({ where: { assignedAgentId: updated.id, status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED", "MERGED"] } }, data: { assignedAgentId: null } }); return updated; });
  await writeAudit(request, isActive ? "USER_REACTIVATED" : "USER_DEACTIVATED", "User", user.id);
  return success(response, user, isActive ? "Der Benutzer wurde reaktiviert." : "Der Benutzer wurde deaktiviert.");
}));

userRouter.patch("/:id/role", asyncHandler(async (request, response) => {
  const { role } = z.object({ role: z.enum(["CUSTOMER", "AGENT", "ADMIN"]) }).parse(request.body);
  if (request.params.id === request.user!.id && role !== "ADMIN") throw new AppError("Sie können Ihre eigene Administratorrolle nicht entfernen.", 409, "SELF_ROLE_CHANGE");
  const target = await prisma.user.findUniqueOrThrow({ where: { id: String(request.params.id) }, select: { role: true, isActive: true } });
  if (role !== "ADMIN" && target.role === "ADMIN" && target.isActive && await prisma.user.count({ where: { role: "ADMIN", isActive: true } }) <= 1) throw new AppError("Die Rolle des letzten aktiven Administrators kann nicht geändert werden.", 409, "LAST_ADMIN");
  if (role === "CUSTOMER" && await prisma.ticket.count({ where: { assignedAgentId: String(request.params.id), status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED", "MERGED"] } } })) throw new AppError("Die Rolle kann erst geändert werden, wenn alle aktiven Zuweisungen entfernt wurden.", 409, "ACTIVE_ASSIGNMENTS");
  const user = await prisma.$transaction(async (tx) => { const updated = await tx.user.update({ where: { id: String(request.params.id) }, data: { role, tokenVersion: { increment: 1 } }, select: publicUserSelect }); if (role === "CUSTOMER") await tx.teamMembership.deleteMany({ where: { userId: updated.id } }); return updated; });
  await writeAudit(request, "ROLE_CHANGED", "User", user.id, { role });
  return success(response, user, "Die Rolle wurde geändert.");
}));

userRouter.post("/:id/reset-password", asyncHandler(async (request, response) => {
  const { password } = z.object({ password: passwordSchema }).parse(request.body);
  await prisma.user.update({ where: { id: String(request.params.id) }, data: { passwordHash: await bcrypt.hash(password, 12), tokenVersion: { increment: 1 } } });
  await writeAudit(request, "PASSWORD_RESET_BY_ADMIN", "User", String(request.params.id));
  return success(response, null, "Das Passwort wurde zurückgesetzt.");
}));

userRouter.put("/:id/teams", asyncHandler(async (request, response) => {
  const { teamIds } = z.object({ teamIds: z.array(z.string()).max(50) }).parse(request.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: String(request.params.id) }, select: { id: true, role: true } });
  if (user.role === "CUSTOMER" && teamIds.length) throw new AppError("Kunden können keinem Supportteam zugeordnet werden.", 400, "INVALID_TEAM_MEMBERSHIP");
  const activeTeams = await prisma.supportTeam.count({ where: { id: { in: teamIds }, isActive: true } });
  if (activeTeams !== new Set(teamIds).size) throw new AppError("Mindestens ein Supportteam ist nicht verfügbar.", 400, "INVALID_TEAM");
  await prisma.$transaction(async (tx) => {
    await tx.teamMembership.deleteMany({ where: { userId: user.id } });
    if (teamIds.length) await tx.teamMembership.createMany({ data: [...new Set(teamIds)].map((teamId) => ({ userId: user.id, teamId })) });
  });
  await writeAudit(request, "TEAM_MEMBERSHIP_UPDATED", "User", user.id, { teamIds });
  return success(response, null, "Die Teamzugehörigkeiten wurden aktualisiert.");
}));
