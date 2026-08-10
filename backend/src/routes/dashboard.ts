import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { accessWhere } from "../services/ticketService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success } from "../utils/responses.js";

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

dashboardRouter.get("/summary", asyncHandler(async (request, response) => {
  const user = request.user!;
  const base: Prisma.TicketWhereInput = user.role === "CUSTOMER" ? accessWhere(user) : user.role === "AGENT" ? { OR: [{ assignedAgentId: user.id }, { assignedAgentId: null }] } : {};
  const now = new Date();
  if (user.role !== "CUSTOMER") {
    const warningTickets = await prisma.ticket.findMany({ where: { assignedAgentId: user.id, resolutionDueAt: { gte: now, lte: new Date(now.getTime() + 60 * 60_000) }, status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED", "MERGED"] } }, select: { id: true, ticketNumber: true } });
    const existing = await prisma.notification.findMany({ where: { userId: user.id, type: "SLA_WARNING", entityId: { in: warningTickets.map((ticket) => ticket.id) } }, select: { entityId: true } });
    const existingIds = new Set(existing.map((item) => item.entityId));
    const missing = warningTickets.filter((ticket) => !existingIds.has(ticket.id));
    if (missing.length) await prisma.notification.createMany({ data: missing.map((ticket) => ({ userId: user.id, type: "SLA_WARNING", title: "SLA-Warnung", message: `Die Lösungsfrist von ${ticket.ticketNumber} läuft in weniger als 60 Minuten ab.`, entityType: "Ticket", entityId: ticket.id })) });
  }
  const [total, open, inProgress, waiting, resolved, critical, unassigned, slaBreached, unread, recent] = await prisma.$transaction([
    prisma.ticket.count({ where: base }), prisma.ticket.count({ where: { ...base, status: { in: ["NEW", "OPEN", "ASSIGNED"] } } }), prisma.ticket.count({ where: { ...base, status: "IN_PROGRESS" } }), prisma.ticket.count({ where: { ...base, status: "WAITING_FOR_CUSTOMER" } }), prisma.ticket.count({ where: { ...base, status: "RESOLVED" } }), prisma.ticket.count({ where: { ...base, priority: "CRITICAL", status: { notIn: ["CLOSED", "CANCELLED", "MERGED"] } } }), prisma.ticket.count({ where: { ...base, assignedAgentId: null } }), prisma.ticket.count({ where: { ...base, resolutionDueAt: { lt: now }, status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED", "MERGED"] } } }), prisma.notification.count({ where: { userId: user.id, readAt: null } }), prisma.ticket.findMany({ where: base, orderBy: { updatedAt: "desc" }, take: 6, include: { category: true, assignedAgent: { select: { firstName: true, lastName: true } } } }),
  ]);
  const [closed, slaWarning, ratings, responseTimes, resolutionTimes] = await Promise.all([
    prisma.ticket.count({ where: { ...base, status: "CLOSED" } }),
    prisma.ticket.count({ where: { ...base, resolutionDueAt: { gte: now, lte: new Date(now.getTime() + 60 * 60_000) }, status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED", "MERGED"] } } }),
    prisma.ticket.aggregate({ where: { ...base, customerRating: { not: null } }, _avg: { customerRating: true }, _count: { customerRating: true } }),
    prisma.ticket.findMany({ where: { ...base, firstRespondedAt: { not: null } }, select: { createdAt: true, firstRespondedAt: true } }),
    prisma.ticket.findMany({ where: { ...base, resolvedAt: { not: null } }, select: { createdAt: true, resolvedAt: true } }),
  ]);
  const averageMinutes = (values: Array<{ createdAt: Date; end: Date | null }>) => values.length ? Math.round(values.reduce((sum, value) => sum + (value.end!.getTime() - value.createdAt.getTime()) / 60_000, 0) / values.length) : 0;
  return success(response, { total, open, inProgress, waiting, resolved, closed, critical, unassigned, slaBreached, slaWarning, unread, averageRating: ratings._avg.customerRating ?? 0, ratingCount: ratings._count.customerRating, averageFirstResponseMinutes: averageMinutes(responseTimes.map((item) => ({ createdAt: item.createdAt, end: item.firstRespondedAt }))), averageResolutionMinutes: averageMinutes(resolutionTimes.map((item) => ({ createdAt: item.createdAt, end: item.resolvedAt }))), recent });
}));

for (const [path, field] of [["tickets-by-status", "status"], ["tickets-by-priority", "priority"], ["tickets-by-source", "source"], ["tickets-by-category", "categoryId"]] as const) {
  dashboardRouter.get(`/${path}`, asyncHandler(async (request, response) => {
    const where = accessWhere(request.user!);
    const groups = await prisma.ticket.groupBy({ by: [field], where, _count: { _all: true } });
    return success(response, groups.map((group) => ({ key: String(group[field]), count: group._count._all })));
  }));
}

dashboardRouter.get("/agent-workload", asyncHandler(async (_request, response) => {
  const agents = await prisma.user.findMany({ where: { role: { in: ["AGENT", "ADMIN"] }, isActive: true }, select: { id: true, firstName: true, lastName: true, _count: { select: { assignedTickets: { where: { status: { notIn: ["CLOSED", "CANCELLED", "MERGED"] } } } } } } });
  return success(response, agents.map((agent) => ({ id: agent.id, name: `${agent.firstName} ${agent.lastName}`, count: agent._count.assignedTickets })));
}));

dashboardRouter.get("/sla-performance", asyncHandler(async (request, response) => {
  const where = accessWhere(request.user!); const now = new Date();
  const tickets = await prisma.ticket.findMany({ where, select: { resolutionDueAt: true, resolvedAt: true } });
  const total = tickets.length;
  const breached = tickets.filter((ticket) => ticket.resolutionDueAt && (ticket.resolvedAt ?? now) > ticket.resolutionDueAt).length;
  return success(response, { total, breached, compliancePercent: total ? Math.round(((total - breached) / total) * 1000) / 10 : 100 });
}));
