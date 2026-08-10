import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { AppError } from "../errors/AppError.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { writeAudit } from "../middleware/audit.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success } from "../utils/responses.js";

export const categoryRouter = Router();
categoryRouter.use(authenticate);
categoryRouter.get("/", asyncHandler(async (request, response) => success(response, await prisma.category.findMany({ where: request.user!.role === "ADMIN" ? {} : { isActive: true }, include: { defaultTeam: true, _count: { select: { tickets: true } } }, orderBy: { name: "asc" } }))));
categoryRouter.post("/", authorize("ADMIN"), asyncHandler(async (request, response) => {
  const input = z.object({ name: z.string().trim().min(2).max(100), description: z.string().max(500).optional(), icon: z.string().max(50).optional(), defaultPriority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"), defaultTeamId: z.string().nullable().optional(), isActive: z.boolean().default(true) }).parse(request.body);
  const item = await prisma.category.create({ data: input }); await writeAudit(request, "CATEGORY_CREATED", "Category", item.id); return success(response, item, "Die Kategorie wurde erstellt.", 201);
}));
categoryRouter.patch("/:id", authorize("ADMIN"), asyncHandler(async (request, response) => {
  const input = z.object({ name: z.string().trim().min(2).max(100), description: z.string().max(500).nullable(), icon: z.string().max(50).nullable(), defaultPriority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]), defaultTeamId: z.string().nullable(), isActive: z.boolean() }).partial().parse(request.body);
  const item = await prisma.category.update({ where: { id: String(request.params.id) }, data: input }); await writeAudit(request, "CATEGORY_UPDATED", "Category", item.id); return success(response, item, "Die Kategorie wurde aktualisiert.");
}));
categoryRouter.delete("/:id", authorize("ADMIN"), asyncHandler(async (request, response) => {
  await prisma.category.update({ where: { id: String(request.params.id) }, data: { isActive: false } }); await writeAudit(request, "CATEGORY_DEACTIVATED", "Category", String(request.params.id)); return success(response, null, "Die Kategorie wurde deaktiviert.");
}));

export const teamRouter = Router();
teamRouter.use(authenticate);
teamRouter.get("/", asyncHandler(async (_request, response) => success(response, await prisma.supportTeam.findMany({ include: { memberships: { include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } } }, _count: { select: { tickets: true } } }, orderBy: { name: "asc" } }))));
teamRouter.post("/", authorize("ADMIN"), asyncHandler(async (request, response) => { const input = z.object({ name: z.string().min(2).max(100), description: z.string().max(500).optional(), isActive: z.boolean().default(true), memberIds: z.array(z.string()).optional() }).parse(request.body); const { memberIds = [], ...data } = input; const ids = [...new Set(memberIds)]; const eligible = await prisma.user.count({ where: { id: { in: ids }, role: { in: ["AGENT", "ADMIN"] }, isActive: true } }); if (eligible !== ids.length) throw new AppError("Mindestens ein Teammitglied ist nicht verfügbar oder kein Supportmitarbeiter.", 400, "INVALID_TEAM_MEMBER"); const item = await prisma.supportTeam.create({ data: { ...data, memberships: { create: ids.map((userId) => ({ userId })) } } }); await writeAudit(request, "TEAM_CREATED", "SupportTeam", item.id); return success(response, item, "Das Team wurde erstellt.", 201); }));
teamRouter.patch("/:id", authorize("ADMIN"), asyncHandler(async (request, response) => { const input = z.object({ name: z.string().min(2).max(100), description: z.string().max(500).nullable(), isActive: z.boolean() }).partial().parse(request.body); const item = await prisma.supportTeam.update({ where: { id: String(request.params.id) }, data: input }); await writeAudit(request, "TEAM_UPDATED", "SupportTeam", item.id); return success(response, item, "Das Team wurde aktualisiert."); }));
teamRouter.put("/:id/members", authorize("ADMIN"), asyncHandler(async (request, response) => {
  const teamId = String(request.params.id); const { memberIds } = z.object({ memberIds: z.array(z.string()).max(100) }).parse(request.body); const ids = [...new Set(memberIds)];
  const eligible = await prisma.user.count({ where: { id: { in: ids }, role: { in: ["AGENT", "ADMIN"] }, isActive: true } });
  if (eligible !== ids.length) throw new AppError("Mindestens ein Teammitglied ist nicht verfügbar oder kein Supportmitarbeiter.", 400, "INVALID_TEAM_MEMBER");
  await prisma.$transaction(async (tx) => { await tx.teamMembership.deleteMany({ where: { teamId } }); if (ids.length) await tx.teamMembership.createMany({ data: ids.map((userId) => ({ teamId, userId })) }); });
  await writeAudit(request, "TEAM_MEMBERS_UPDATED", "SupportTeam", teamId, { memberIds: ids });
  return success(response, null, "Die Teammitglieder wurden aktualisiert.");
}));
teamRouter.delete("/:id", authorize("ADMIN"), asyncHandler(async (request, response) => { await prisma.supportTeam.update({ where: { id: String(request.params.id) }, data: { isActive: false } }); await writeAudit(request, "TEAM_DEACTIVATED", "SupportTeam", String(request.params.id)); return success(response, null, "Das Team wurde deaktiviert."); }));

export const tagRouter = Router();
tagRouter.use(authenticate);
tagRouter.get("/", asyncHandler(async (_request, response) => success(response, await prisma.tag.findMany({ orderBy: { name: "asc" } }))));
tagRouter.post("/", authorize("ADMIN"), asyncHandler(async (request, response) => { const input = z.object({ name: z.string().min(2).max(60), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/) }).parse(request.body); const item = await prisma.tag.create({ data: input }); await writeAudit(request, "TAG_CREATED", "Tag", item.id); return success(response, item, "Der Tag wurde erstellt.", 201); }));
tagRouter.patch("/:id", authorize("ADMIN"), asyncHandler(async (request, response) => { const input = z.object({ name: z.string().min(2).max(60), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/) }).partial().parse(request.body); const item = await prisma.tag.update({ where: { id: String(request.params.id) }, data: input }); await writeAudit(request, "TAG_UPDATED", "Tag", item.id); return success(response, item, "Der Tag wurde aktualisiert."); }));
tagRouter.delete("/:id", authorize("ADMIN"), asyncHandler(async (request, response) => { await prisma.tag.delete({ where: { id: String(request.params.id) } }); await writeAudit(request, "TAG_DELETED", "Tag", String(request.params.id)); return success(response, null, "Der Tag wurde gelöscht."); }));

export const slaRouter = Router();
slaRouter.use(authenticate);
slaRouter.get("/", asyncHandler(async (_request, response) => success(response, await prisma.slaPolicy.findMany({ orderBy: { resolutionMinutes: "asc" } }))));
const slaInput = z.object({ name: z.string().min(2).max(100), description: z.string().max(500).optional(), priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]), firstResponseMinutes: z.number().int().positive(), resolutionMinutes: z.number().int().positive(), businessHoursOnly: z.literal(false, { error: "Geschäftszeiten-SLAs sind in dieser Version nicht aktiviert." }).default(false), isActive: z.boolean().default(true) }).refine((value) => value.resolutionMinutes >= value.firstResponseMinutes, { message: "Die Lösungsfrist darf nicht kürzer als die Reaktionsfrist sein.", path: ["resolutionMinutes"] });
slaRouter.post("/", authorize("ADMIN"), asyncHandler(async (request, response) => { const input = slaInput.parse(request.body); if (input.isActive && await prisma.slaPolicy.count({ where: { priority: input.priority, isActive: true } })) throw new AppError("Für diese Priorität existiert bereits eine aktive SLA-Richtlinie.", 409, "ACTIVE_SLA_EXISTS"); const item = await prisma.slaPolicy.create({ data: input }); await writeAudit(request, "SLA_CREATED", "SlaPolicy", item.id); return success(response, item, "Die SLA-Richtlinie wurde erstellt.", 201); }));
slaRouter.patch("/:id", authorize("ADMIN"), asyncHandler(async (request, response) => { const id = String(request.params.id); const input = slaInput.partial().parse(request.body); const current = await prisma.slaPolicy.findUniqueOrThrow({ where: { id } }); const priority = input.priority ?? current.priority; const active = input.isActive ?? current.isActive; if (active && await prisma.slaPolicy.count({ where: { priority, isActive: true, id: { not: id } } })) throw new AppError("Für diese Priorität existiert bereits eine andere aktive SLA-Richtlinie.", 409, "ACTIVE_SLA_EXISTS"); const item = await prisma.slaPolicy.update({ where: { id }, data: input }); await writeAudit(request, "SLA_UPDATED", "SlaPolicy", item.id); return success(response, item, "Die SLA-Richtlinie wurde aktualisiert."); }));
slaRouter.delete("/:id", authorize("ADMIN"), asyncHandler(async (request, response) => { await prisma.slaPolicy.update({ where: { id: String(request.params.id) }, data: { isActive: false } }); await writeAudit(request, "SLA_DEACTIVATED", "SlaPolicy", String(request.params.id)); return success(response, null, "Die SLA-Richtlinie wurde deaktiviert."); }));
