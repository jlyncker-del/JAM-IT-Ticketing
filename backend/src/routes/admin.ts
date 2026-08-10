import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { writeAudit } from "../middleware/audit.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success } from "../utils/responses.js";

export const auditRouter = Router();
auditRouter.use(authenticate, authorize("ADMIN"));
auditRouter.get("/", asyncHandler(async (request, response) => {
  const page = z.coerce.number().int().positive().default(1).parse(request.query.page);
  const limit = z.coerce.number().int().min(1).max(100).default(50).parse(request.query.limit);
  const [items, totalItems] = await prisma.$transaction([prisma.auditLog.findMany({ skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" }, include: { user: { select: { firstName: true, lastName: true, email: true } } } }), prisma.auditLog.count()]);
  return response.json({ success: true, data: items, pagination: { page, limit, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / limit)) } });
}));

export const reportRouter = Router();
reportRouter.use(authenticate, authorize("ADMIN"));
const reportQuerySchema = z.object({ from: z.string().date().optional(), to: z.string().date().optional(), status: z.enum(["DRAFT", "NEW", "OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "WAITING_FOR_THIRD_PARTY", "RESOLVED", "CLOSED", "CANCELLED", "MERGED"]).optional(), priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(), categoryId: z.string().optional(), assignedAgentId: z.string().optional(), assignedTeamId: z.string().optional(), sla: z.enum(["within", "breached"]).optional() });
function reportWhere(query: z.infer<typeof reportQuerySchema>): Prisma.TicketWhereInput {
  const end = query.to ? new Date(`${query.to}T23:59:59.999Z`) : undefined;
  return {
    ...(query.from || end ? { createdAt: { ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}), ...(end ? { lte: end } : {}) } } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.assignedAgentId ? { assignedAgentId: query.assignedAgentId } : {}),
    ...(query.assignedTeamId ? { assignedTeamId: query.assignedTeamId } : {}),
  };
}
const isSlaBreached = (ticket: { resolutionDueAt: Date | null; resolvedAt: Date | null }, now = new Date()) =>
  Boolean(ticket.resolutionDueAt && (ticket.resolvedAt ?? now) > ticket.resolutionDueAt);
async function scopedReportWhere(query: z.infer<typeof reportQuerySchema>): Promise<Prisma.TicketWhereInput> {
  const where = reportWhere(query);
  if (!query.sla) return where;
  const candidates = await prisma.ticket.findMany({ where, select: { id: true, resolutionDueAt: true, resolvedAt: true } });
  const ids = candidates.filter((ticket) => query.sla === "breached" ? isSlaBreached(ticket) : !isSlaBreached(ticket)).map((ticket) => ticket.id);
  return { AND: [where, { id: { in: ids } }] };
}
reportRouter.get("/tickets", asyncHandler(async (request, response) => {
  const where = await scopedReportWhere(reportQuerySchema.parse(request.query));
  const [total, resolved, closed, averageRating, slaTickets, responseTimes, resolutionTimes, workloadGroups] = await Promise.all([prisma.ticket.count({ where }), prisma.ticket.count({ where: { AND: [where, { status: "RESOLVED" }] } }), prisma.ticket.count({ where: { AND: [where, { status: "CLOSED" }] } }), prisma.ticket.aggregate({ where, _avg: { customerRating: true }, _count: { customerRating: true } }), prisma.ticket.findMany({ where, select: { resolutionDueAt: true, resolvedAt: true } }), prisma.ticket.findMany({ where: { ...where, firstRespondedAt: { not: null } }, select: { createdAt: true, firstRespondedAt: true } }), prisma.ticket.findMany({ where: { ...where, resolvedAt: { not: null } }, select: { createdAt: true, resolvedAt: true } }), prisma.ticket.groupBy({ by: ["assignedAgentId"], where: { AND: [where, { assignedAgentId: { not: null } }] }, _count: { _all: true } })]);
  const breached = slaTickets.filter((ticket) => isSlaBreached(ticket)).length;
  const workloadUsers = await prisma.user.findMany({ where: { id: { in: workloadGroups.flatMap((item) => item.assignedAgentId ? [item.assignedAgentId] : []) } }, select: { id: true, firstName: true, lastName: true } });
  const names = new Map(workloadUsers.map((item) => [item.id, `${item.firstName} ${item.lastName}`]));
  const average = (items: Array<{ createdAt: Date; end: Date | null }>) => items.length ? Math.round(items.reduce((sum, item) => sum + (item.end!.getTime() - item.createdAt.getTime()) / 60_000, 0) / items.length) : 0;
  return success(response, {
    total,
    resolved,
    closed,
    resolutionRate: total ? Math.round(((resolved + closed) / total) * 1000) / 10 : 0,
    averageRating: averageRating._avg.customerRating ?? 0,
    ratingCount: averageRating._count.customerRating,
    slaCompliance: total ? Math.round(((total - breached) / total) * 1000) / 10 : 100,
    averageFirstResponseMinutes: average(responseTimes.map((item) => ({ createdAt: item.createdAt, end: item.firstRespondedAt }))),
    averageResolutionMinutes: average(resolutionTimes.map((item) => ({ createdAt: item.createdAt, end: item.resolvedAt }))),
    agentWorkload: workloadGroups.flatMap((item) => item.assignedAgentId ? [{ id: item.assignedAgentId, name: names.get(item.assignedAgentId) ?? "Unbekannter Bearbeiter", count: item._count._all }] : []),
  });
}));
reportRouter.get("/performance", asyncHandler(async (_request, response) => { const agents = await prisma.user.findMany({ where: { role: { in: ["AGENT", "ADMIN"] } }, select: { id: true, firstName: true, lastName: true, _count: { select: { assignedTickets: true } } } }); return success(response, agents); }));
reportRouter.get("/sla", asyncHandler(async (_request, response) => { const tickets = await prisma.ticket.findMany({ select: { resolutionDueAt: true, resolvedAt: true } }); const total = tickets.length; const breached = tickets.filter((ticket) => isSlaBreached(ticket)).length; return success(response, { total, breached, compliancePercent: total ? Math.round(((total - breached) / total) * 1000) / 10 : 100 }); }));
reportRouter.get("/export", asyncHandler(async (request, response) => {
  const where = await scopedReportWhere(reportQuerySchema.parse(request.query));
  const tickets = await prisma.ticket.findMany({ where, include: { category: true, customer: { select: { firstName: true, lastName: true, email: true } }, assignedAgent: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" } });
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const statusLabels: Record<string, string> = { DRAFT: "Entwurf", NEW: "Neu", OPEN: "Offen", ASSIGNED: "Zugewiesen", IN_PROGRESS: "In Bearbeitung", WAITING_FOR_CUSTOMER: "Wartet auf Kunden", WAITING_FOR_THIRD_PARTY: "Wartet auf Drittanbieter", RESOLVED: "Gelöst", CLOSED: "Geschlossen", CANCELLED: "Storniert", MERGED: "Zusammengeführt" };
  const priorityLabels: Record<string, string> = { LOW: "Niedrig", MEDIUM: "Mittel", HIGH: "Hoch", CRITICAL: "Kritisch" };
  const rows = [["Ticketnummer", "Betreff", "Status", "Priorität", "Kategorie", "Kunde", "E-Mail", "Bearbeiter", "Erstellt am"], ...tickets.map((ticket) => [ticket.ticketNumber, ticket.subject, statusLabels[ticket.status], priorityLabels[ticket.priority], ticket.category.name, `${ticket.customer.firstName} ${ticket.customer.lastName}`, ticket.customer.email, ticket.assignedAgent ? `${ticket.assignedAgent.firstName} ${ticket.assignedAgent.lastName}` : "", ticket.createdAt.toLocaleString("de-DE")])];
  await writeAudit(request, "REPORT_EXPORTED", "Report");
  response.type("text/csv; charset=utf-8").setHeader("Content-Disposition", "attachment; filename=jam-it-ticketbericht.csv").send(`\uFEFF${rows.map((row) => row.map(escape).join(";")).join("\n")}`);
}));
