import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { AppError } from "../errors/AppError.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { writeAudit } from "../middleware/audit.js";
import { upload } from "../middleware/upload.js";
import { assignmentSchema, commentSchema, createTicketSchema, linkSchema, prioritySchema, statusSchema, ticketQuerySchema, ticketUpdateSchema } from "../schemas/tickets.js";
import { accessWhere, assertValidTransition, ensureTicketAccess, nextTicketNumber, slaForPriority, ticketInclude } from "../services/ticketService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { attachmentService } from "../services/attachmentService.js";
import { success } from "../utils/responses.js";
import { z } from "zod";

export const ticketRouter = Router();
ticketRouter.use(authenticate);

ticketRouter.get("/", asyncHandler(async (request, response) => {
  const query = ticketQuerySchema.parse(request.query);
  const user = request.user!;
  const slaFilter: Prisma.TicketWhereInput | undefined = query.sla === "breached"
    ? { resolutionDueAt: { lt: new Date() }, status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED", "MERGED"] } }
    : query.sla === "warning"
      ? { resolutionDueAt: { gte: new Date(), lte: new Date(Date.now() + 60 * 60_000) }, status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED", "MERGED"] } }
      : query.sla === "within"
        ? { OR: [{ resolutionDueAt: null }, { resolutionDueAt: { gt: new Date(Date.now() + 60 * 60_000) } }] }
        : undefined;
  const where: Prisma.TicketWhereInput = {
    ...accessWhere(user),
    ...(query.status ? { status: query.status } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.assignedAgentId ? { assignedAgentId: query.assignedAgentId } : {}),
    ...(query.assignedTeamId ? { assignedTeamId: query.assignedTeamId } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.unassigned === "true" ? { assignedAgentId: null } : {}),
    ...(query.withAttachments === "true" ? { attachments: { some: {} } } : {}),
    ...(query.withAttachments === "false" ? { attachments: { none: {} } } : {}),
    ...(slaFilter ? { AND: [slaFilter] } : {}),
    ...(query.search ? { OR: [
      { ticketNumber: { contains: query.search, mode: "insensitive" } },
      { subject: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
      { customer: { is: { OR: [{ firstName: { contains: query.search, mode: "insensitive" } }, { lastName: { contains: query.search, mode: "insensitive" } }, { email: { contains: query.search, mode: "insensitive" } }] } } },
      { attachments: { some: { originalName: { contains: query.search, mode: "insensitive" } } } },
    ] } : {}),
  };
  const [items, totalItems] = await prisma.$transaction([
    prisma.ticket.findMany({ where, skip: (query.page - 1) * query.limit, take: query.limit, orderBy: { [query.sortBy]: query.sortOrder }, include: { category: true, customer: { select: { firstName: true, lastName: true, email: true } }, assignedAgent: { select: { firstName: true, lastName: true } }, assignedTeam: true, _count: { select: { attachments: true, comments: true } } } }),
    prisma.ticket.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalItems / query.limit));
  return response.json({ success: true, data: items, pagination: { page: query.page, limit: query.limit, totalItems, totalPages, hasPreviousPage: query.page > 1, hasNextPage: query.page < totalPages } });
}));

ticketRouter.get("/:id", asyncHandler(async (request, response) => success(response, await ensureTicketAccess(String(request.params.id), request.user!))));

ticketRouter.post("/", asyncHandler(async (request, response) => {
  const input = createTicketSchema.parse(request.body);
  const user = request.user!;
  const category = await prisma.category.findFirst({ where: { id: input.categoryId, isActive: true } });
  if (!category) throw new AppError("Die ausgewählte Kategorie ist nicht verfügbar.", 400, "INVALID_CATEGORY");
  const priority = user.role === "CUSTOMER" ? category.defaultPriority : (input.priority ?? category.defaultPriority);
  const status = input.isDraft ? "DRAFT" : "NEW";
  let customerId = user.id;
  if (user.role !== "CUSTOMER" && !input.customerId) throw new AppError("Bitte wählen Sie einen Kunden aus.", 400, "CUSTOMER_REQUIRED");
  if (user.role !== "CUSTOMER" && input.customerId) {
    const customer = await prisma.user.findFirst({ where: { id: input.customerId, role: "CUSTOMER", isActive: true } });
    if (!customer) throw new AppError("Der ausgewählte Kunde ist nicht verfügbar.", 400, "INVALID_CUSTOMER");
    customerId = customer.id;
  }
  const { links, sensitiveDataConfirmed: _confirmed, isDraft: _draft, customerId: _customerId, ...data } = input;
  const deadlines = await slaForPriority(priority);
  const ticket = await prisma.ticket.create({ data: { ...data, priority, status, ticketNumber: await nextTicketNumber(), customerId, createdById: user.id, assignedTeamId: category.defaultTeamId, ...deadlines, links: { create: links?.map((link) => ({ ...link, createdById: user.id })) }, history: { create: { changedById: user.id, action: input.isDraft ? "DRAFT_CREATED" : "TICKET_CREATED", newValue: status } } }, include: ticketInclude });
  if (!input.isDraft) await prisma.notification.create({ data: { userId: customerId, type: "TICKET_CREATED", title: "Ticket erstellt", message: `${ticket.ticketNumber} wurde erfolgreich erstellt.`, entityType: "Ticket", entityId: ticket.id } });
  await writeAudit(request, "TICKET_CREATED", "Ticket", ticket.id, { ticketNumber: ticket.ticketNumber });
  return success(response, ticket, input.isDraft ? "Der Ticketentwurf wurde gespeichert." : "Ticket wurde erfolgreich erstellt.", 201);
}));

ticketRouter.patch("/:id", asyncHandler(async (request, response) => {
  const current = await ensureTicketAccess(String(request.params.id), request.user!);
  const input = ticketUpdateSchema.parse(request.body);
  if (request.user!.role === "CUSTOMER" && current.status !== "DRAFT") throw new AppError("Kunden können nur eigene Entwürfe bearbeiten.", 403, "FORBIDDEN");
  if (input.categoryId) {
    const category = await prisma.category.findFirst({ where: { id: input.categoryId, isActive: true } });
    if (!category) throw new AppError("Die ausgewählte Kategorie ist nicht verfügbar.", 400, "INVALID_CATEGORY");
  }
  const customerFields = new Set(["subject", "description", "categoryId", "affectedSystem", "device", "operatingSystem", "browser", "errorMessage", "urgencyDescription", "contactPhone", "preferredContactMethod", "preferredAvailability", "technicalInformation"]);
  const data = Object.fromEntries(Object.entries(input).filter(([key, value]) => value !== undefined && (request.user!.role !== "CUSTOMER" || customerFields.has(key)))) as Prisma.TicketUpdateInput;
  const currentRecord = current as unknown as Record<string, unknown>;
  const changes = Object.entries(data).filter(([key, value]) => String(currentRecord[key] ?? "") !== String(value ?? ""));
  const updated = await prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.update({ where: { id: current.id }, data });
    if (changes.length) await tx.ticketHistory.createMany({ data: changes.map(([field, value]) => ({ ticketId: current.id, changedById: request.user!.id, action: "TICKET_UPDATED", field, oldValue: String(currentRecord[field] ?? ""), newValue: String(value ?? "") })) });
    return ticket;
  });
  await writeAudit(request, "TICKET_UPDATED", "Ticket", current.id, { fields: changes.map(([field]) => field) });
  return success(response, updated, "Das Ticket wurde aktualisiert.");
}));

ticketRouter.post("/:id/submit", asyncHandler(async (request, response) => {
  const current = await ensureTicketAccess(String(request.params.id), request.user!);
  if (current.status !== "DRAFT") throw new AppError("Nur Entwürfe können eingereicht werden.", 409, "NOT_A_DRAFT");
  const updated = await prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.update({ where: { id: current.id }, data: { status: "NEW" } });
    await tx.ticketHistory.create({ data: { ticketId: current.id, changedById: request.user!.id, action: "DRAFT_SUBMITTED", field: "status", oldValue: "DRAFT", newValue: "NEW" } });
    return ticket;
  });
  await writeAudit(request, "DRAFT_SUBMITTED", "Ticket", current.id);
  return success(response, updated, "Der Entwurf wurde als Ticket eingereicht.");
}));

ticketRouter.delete("/:id", asyncHandler(async (request, response) => {
  const current = await ensureTicketAccess(String(request.params.id), request.user!);
  if (current.status !== "DRAFT") throw new AppError("Nur Entwürfe können gelöscht werden.", 409, "NOT_A_DRAFT");
  await writeAudit(request, "DRAFT_DELETED", "Ticket", current.id, { ticketNumber: current.ticketNumber });
  await prisma.ticket.delete({ where: { id: current.id } });
  return success(response, null, "Der Entwurf wurde gelöscht.");
}));

ticketRouter.patch("/:id/status", asyncHandler(async (request, response) => {
  const { status } = statusSchema.parse(request.body);
  const current = await ensureTicketAccess(String(request.params.id), request.user!);
  assertValidTransition(current.status, status, request.user!.role);
  const now = new Date();
  const data: Prisma.TicketUpdateInput = { status, ...(status === "RESOLVED" ? { resolvedAt: now } : {}), ...(status === "CLOSED" ? { closedAt: now } : {}), ...(["OPEN"].includes(status) && ["RESOLVED", "CLOSED"].includes(current.status) ? { reopenedAt: now } : {}) };
  const ticket = await prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({ where: { id: current.id }, data });
    await tx.ticketHistory.create({ data: { ticketId: current.id, changedById: request.user!.id, action: "STATUS_CHANGED", field: "status", oldValue: current.status, newValue: status } });
    const statusMessages: Partial<Record<typeof status, [string, string]>> = { WAITING_FOR_CUSTOMER: ["Rückmeldung erforderlich", `${current.ticketNumber} wartet auf Ihre Rückmeldung.`], RESOLVED: ["Ticket gelöst", `${current.ticketNumber} wurde als gelöst markiert.`], CLOSED: ["Ticket geschlossen", `${current.ticketNumber} wurde geschlossen.`], OPEN: ["Ticket wieder geöffnet", `${current.ticketNumber} wurde wieder geöffnet.`] };
    const notification: [string, string] = statusMessages[status] ?? ["Ticketstatus geändert", `Der Status von ${current.ticketNumber} wurde geändert.`];
    await tx.notification.create({ data: { userId: current.customerId, type: status === "OPEN" && ["RESOLVED", "CLOSED"].includes(current.status) ? "TICKET_REOPENED" : `STATUS_${status}`, title: notification[0], message: notification[1], entityType: "Ticket", entityId: current.id } });
    return updated;
  });
  await writeAudit(request, "STATUS_CHANGED", "Ticket", current.id, { from: current.status, to: status });
  return success(response, ticket, "Der Ticketstatus wurde aktualisiert.");
}));

ticketRouter.patch("/:id/priority", authorize("AGENT", "ADMIN"), asyncHandler(async (request, response) => {
  const { priority } = prioritySchema.parse(request.body);
  const current = await ensureTicketAccess(String(request.params.id), request.user!);
  const deadlines = await slaForPriority(priority, current.createdAt);
  const ticket = await prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({ where: { id: current.id }, data: { priority, ...deadlines } });
    await tx.ticketHistory.create({ data: { ticketId: current.id, changedById: request.user!.id, action: "PRIORITY_CHANGED", field: "priority", oldValue: current.priority, newValue: priority } });
    await tx.notification.create({ data: { userId: current.customerId, type: "PRIORITY_CHANGED", title: "Priorität geändert", message: `Die Priorität von ${current.ticketNumber} wurde geändert.`, entityType: "Ticket", entityId: current.id } });
    return updated;
  });
  await writeAudit(request, "PRIORITY_CHANGED", "Ticket", current.id, { from: current.priority, to: priority });
  return success(response, ticket, "Die Priorität wurde aktualisiert.");
}));

ticketRouter.patch("/:id/assign", authorize("AGENT", "ADMIN"), asyncHandler(async (request, response) => {
  const input = assignmentSchema.parse(request.body);
  const current = await ensureTicketAccess(String(request.params.id), request.user!);
  const selfAssignment = input.assignedAgentId === undefined && input.assignedTeamId === undefined;
  const assignedAgentId = selfAssignment ? request.user!.id : input.assignedAgentId === undefined ? current.assignedAgentId : input.assignedAgentId;
  const assignedTeamId = input.assignedTeamId === undefined ? current.assignedTeamId : input.assignedTeamId;
  if (assignedAgentId) {
    const agent = await prisma.user.findFirst({ where: { id: assignedAgentId, role: { in: ["AGENT", "ADMIN"] }, isActive: true } });
    if (!agent) throw new AppError("Der gewählte Bearbeiter ist nicht verfügbar.", 400, "INVALID_AGENT");
  }
  if (assignedTeamId) {
    const team = await prisma.supportTeam.findFirst({ where: { id: assignedTeamId, isActive: true } });
    if (!team) throw new AppError("Das gewählte Supportteam ist nicht verfügbar.", 400, "INVALID_TEAM");
  }
  const ticket = await prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({ where: { id: current.id }, data: { assignedAgentId, assignedTeamId, status: current.status === "NEW" || current.status === "OPEN" ? "ASSIGNED" : current.status } });
    await tx.ticketHistory.createMany({ data: [
      { ticketId: current.id, changedById: request.user!.id, action: "TICKET_ASSIGNED", field: "assignedAgentId", oldValue: current.assignedAgentId, newValue: assignedAgentId },
      { ticketId: current.id, changedById: request.user!.id, action: "TEAM_ASSIGNED", field: "assignedTeamId", oldValue: current.assignedTeamId, newValue: assignedTeamId },
    ] });
    const recipients = new Set([current.customerId, ...(assignedAgentId ? [assignedAgentId] : [])]);
    for (const userId of recipients) await tx.notification.create({ data: { userId, type: "TICKET_ASSIGNED", title: "Ticket zugewiesen", message: `${current.ticketNumber} wurde neu zugewiesen.`, entityType: "Ticket", entityId: current.id } });
    return updated;
  });
  await writeAudit(request, "TICKET_ASSIGNED", "Ticket", current.id, { assignedAgentId, assignedTeamId });
  return success(response, ticket, "Das Ticket wurde zugewiesen.");
}));

ticketRouter.get("/:ticketId/comments", asyncHandler(async (request, response) => {
  const ticket = await ensureTicketAccess(String(request.params.ticketId), request.user!);
  return success(response, ticket.comments);
}));

ticketRouter.post("/:ticketId/comments", asyncHandler(async (request, response) => {
  const input = commentSchema.parse(request.body);
  const ticket = await ensureTicketAccess(String(request.params.ticketId), request.user!);
  if (input.isInternal && request.user!.role === "CUSTOMER") throw new AppError("Interne Notizen sind nur für Supportmitarbeitende verfügbar.", 403, "FORBIDDEN");
  const now = new Date();
  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({ data: { content: input.content, isInternal: input.isInternal, type: input.isInternal ? "INTERNAL" : "PUBLIC", ticketId: ticket.id, authorId: request.user!.id }, include: { author: { select: { id: true, firstName: true, lastName: true, role: true } }, attachments: true } });
    const replyData = request.user!.role === "CUSTOMER" ? { lastCustomerReplyAt: now } : input.isInternal ? {} : { lastAgentReplyAt: now, ...(ticket.firstRespondedAt ? {} : { firstRespondedAt: now }) };
    if (Object.keys(replyData).length) await tx.ticket.update({ where: { id: ticket.id }, data: replyData });
    await tx.ticketHistory.create({ data: { ticketId: ticket.id, changedById: request.user!.id, action: input.isInternal ? "INTERNAL_NOTE_CREATED" : "COMMENT_CREATED" } });
    if (!input.isInternal) await tx.notification.create({ data: { userId: request.user!.role === "CUSTOMER" ? (ticket.assignedAgentId ?? ticket.createdById) : ticket.customerId, type: request.user!.role === "CUSTOMER" ? "CUSTOMER_REPLY" : "AGENT_REPLY", title: "Neue Nachricht", message: `Zu ${ticket.ticketNumber} liegt eine neue öffentliche Nachricht vor.`, entityType: "Ticket", entityId: ticket.id } });
    return created;
  });
  await writeAudit(request, input.isInternal ? "INTERNAL_NOTE_CREATED" : "COMMENT_CREATED", "Comment", comment.id, { ticketId: ticket.id });
  return success(response, comment, input.isInternal ? "Die interne Notiz wurde gespeichert." : "Ihre Nachricht wurde gesendet.", 201);
}));

ticketRouter.patch("/:ticketId/comments/:commentId", asyncHandler(async (request, response) => {
  const ticket = await ensureTicketAccess(String(request.params.ticketId), request.user!);
  const { content } = commentSchema.pick({ content: true }).parse(request.body);
  const comment = await prisma.comment.findFirst({ where: { id: String(request.params.commentId), ticketId: ticket.id, deletedAt: null } });
  if (!comment) throw new AppError("Der Kommentar wurde nicht gefunden.", 404, "COMMENT_NOT_FOUND");
  if (comment.authorId !== request.user!.id && request.user!.role !== "ADMIN") throw new AppError("Sie dürfen diesen Kommentar nicht bearbeiten.", 403, "FORBIDDEN");
  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.comment.update({ where: { id: comment.id }, data: { content } });
    await tx.ticketHistory.create({ data: { ticketId: ticket.id, changedById: request.user!.id, action: "COMMENT_UPDATED", metadata: { commentId: comment.id } } });
    return item;
  });
  await writeAudit(request, "COMMENT_UPDATED", "Comment", comment.id, { ticketId: ticket.id });
  return success(response, updated, "Der Kommentar wurde bearbeitet.");
}));

ticketRouter.delete("/:ticketId/comments/:commentId", asyncHandler(async (request, response) => {
  const ticket = await ensureTicketAccess(String(request.params.ticketId), request.user!);
  const comment = await prisma.comment.findFirst({ where: { id: String(request.params.commentId), ticketId: ticket.id, deletedAt: null } });
  if (!comment) throw new AppError("Der Kommentar wurde nicht gefunden.", 404, "COMMENT_NOT_FOUND");
  if (comment.authorId !== request.user!.id && request.user!.role !== "ADMIN") throw new AppError("Sie dürfen diesen Kommentar nicht löschen.", 403, "FORBIDDEN");
  await prisma.$transaction([
    prisma.comment.update({ where: { id: comment.id }, data: { deletedAt: new Date(), content: "[Kommentar gelöscht]" } }),
    prisma.ticketHistory.create({ data: { ticketId: ticket.id, changedById: request.user!.id, action: "COMMENT_DELETED", metadata: { commentId: comment.id } } }),
  ]);
  await writeAudit(request, "COMMENT_DELETED", "Comment", comment.id, { ticketId: ticket.id });
  return success(response, null, "Der Kommentar wurde gelöscht.");
}));

ticketRouter.post("/:ticketId/links", asyncHandler(async (request, response) => {
  const input = linkSchema.parse(request.body);
  const ticket = await ensureTicketAccess(String(request.params.ticketId), request.user!);
  const link = await prisma.ticketLink.create({ data: { ...input, ticketId: ticket.id, createdById: request.user!.id } });
  await writeAudit(request, "LINK_CREATED", "TicketLink", link.id, { ticketId: ticket.id });
  return success(response, link, "Der Link wurde hinzugefügt.", 201);
}));

ticketRouter.patch("/:ticketId/links/:linkId", asyncHandler(async (request, response) => {
  const ticket = await ensureTicketAccess(String(request.params.ticketId), request.user!);
  const existing = await prisma.ticketLink.findFirst({ where: { id: String(request.params.linkId), ticketId: ticket.id } });
  if (!existing) throw new AppError("Der Link wurde nicht gefunden.", 404, "LINK_NOT_FOUND");
  if (existing.createdById !== request.user!.id && request.user!.role !== "ADMIN") throw new AppError("Sie dürfen diesen Link nicht bearbeiten.", 403, "FORBIDDEN");
  const item = await prisma.ticketLink.update({ where: { id: existing.id }, data: linkSchema.partial().parse(request.body) });
  await writeAudit(request, "LINK_UPDATED", "TicketLink", item.id, { ticketId: ticket.id });
  return success(response, item, "Der Link wurde aktualisiert.");
}));

ticketRouter.delete("/:ticketId/links/:linkId", asyncHandler(async (request, response) => {
  const ticket = await ensureTicketAccess(String(request.params.ticketId), request.user!);
  const existing = await prisma.ticketLink.findFirst({ where: { id: String(request.params.linkId), ticketId: ticket.id } });
  if (!existing) throw new AppError("Der Link wurde nicht gefunden.", 404, "LINK_NOT_FOUND");
  if (existing.createdById !== request.user!.id && request.user!.role !== "ADMIN") throw new AppError("Sie dürfen diesen Link nicht löschen.", 403, "FORBIDDEN");
  await prisma.ticketLink.delete({ where: { id: existing.id } });
  await writeAudit(request, "LINK_DELETED", "TicketLink", existing.id, { ticketId: ticket.id });
  return success(response, null, "Der Link wurde gelöscht.");
}));

const authorizeTicketUpload = asyncHandler(async (request, _response, next) => {
  await ensureTicketAccess(String(request.params.ticketId), request.user!);
  next();
});

ticketRouter.post("/:ticketId/attachments", authorizeTicketUpload, upload.array("files"), asyncHandler(async (request, response) => {
  const ticket = await ensureTicketAccess(String(request.params.ticketId), request.user!);
  const files = (request.files as Express.Multer.File[] | undefined) ?? [];
  if (request.body.visibility === "INTERNAL" && request.user!.role === "CUSTOMER") {
    await Promise.all(files.map(async (file) => { const { unlink } = await import("node:fs/promises"); await unlink(file.path).catch(() => undefined); }));
    throw new AppError("Interne Anhänge sind nur für Supportmitarbeitende verfügbar.", 403, "FORBIDDEN");
  }
  const visibility = request.body.visibility === "INTERNAL" ? "INTERNAL" : "PUBLIC";
  const records = await attachmentService.save({ files, ticketId: ticket.id, uploadedById: request.user!.id, visibility });
  await writeAudit(request, "ATTACHMENT_UPLOADED", "Ticket", ticket.id, { count: records.length, visibility });
  return success(response, records, `${records.length} Datei(en) wurden sicher hochgeladen.`, 201);
}));

const authorizeCommentUpload = asyncHandler(async (request, _response, next) => {
  const ticket = await ensureTicketAccess(String(request.params.ticketId), request.user!);
  const comment = await prisma.comment.findFirst({ where: { id: String(request.params.commentId), ticketId: ticket.id, deletedAt: null } });
  if (!comment) throw new AppError("Der Kommentar wurde nicht gefunden.", 404, "COMMENT_NOT_FOUND");
  if (request.user!.role === "CUSTOMER" && comment.isInternal) {
    throw new AppError("Der Kommentar wurde nicht gefunden.", 404, "COMMENT_NOT_FOUND");
  }
  if (request.user!.role !== "ADMIN" && comment.authorId !== request.user!.id) {
    throw new AppError("Sie können Dateien nur zu eigenen Nachrichten hinzufügen.", 403, "FORBIDDEN");
  }
  next();
});

ticketRouter.post("/:ticketId/comments/:commentId/attachments", authorizeCommentUpload, upload.array("files"), asyncHandler(async (request, response) => {
  const ticket = await ensureTicketAccess(String(request.params.ticketId), request.user!);
  const comment = await prisma.comment.findFirstOrThrow({ where: { id: String(request.params.commentId), ticketId: ticket.id, deletedAt: null } });
  const files = (request.files as Express.Multer.File[] | undefined) ?? [];
  if (request.body.visibility === "INTERNAL" && request.user!.role === "CUSTOMER") {
    await Promise.all(files.map(async (file) => { const { unlink } = await import("node:fs/promises"); await unlink(file.path).catch(() => undefined); }));
    throw new AppError("Interne Anhänge sind nur für Supportmitarbeitende verfügbar.", 403, "FORBIDDEN");
  }
  const visibility = comment.isInternal ? "INTERNAL" : request.user!.role === "CUSTOMER" ? "PUBLIC" : request.body.visibility === "INTERNAL" ? "INTERNAL" : "PUBLIC";
  const records = await attachmentService.save({ files, ticketId: ticket.id, commentId: comment.id, uploadedById: request.user!.id, visibility });
  await writeAudit(request, "COMMENT_ATTACHMENT_UPLOADED", "Comment", comment.id, { ticketId: ticket.id, count: records.length, visibility });
  return success(response, records, `${records.length} Datei(en) wurden zur Nachricht hinzugefügt.`, 201);
}));

ticketRouter.post("/:id/tags/:tagId", authorize("AGENT", "ADMIN"), asyncHandler(async (request, response) => {
  const ticket = await ensureTicketAccess(String(request.params.id), request.user!);
  const tag = await prisma.tag.findUnique({ where: { id: String(request.params.tagId) } });
  if (!tag) throw new AppError("Der Tag wurde nicht gefunden.", 404, "TAG_NOT_FOUND");
  await prisma.ticketTag.upsert({ where: { ticketId_tagId: { ticketId: ticket.id, tagId: tag.id } }, update: {}, create: { ticketId: ticket.id, tagId: tag.id } });
  await writeAudit(request, "TAG_ADDED", "Ticket", ticket.id, { tagId: tag.id });
  return success(response, tag, "Der Tag wurde hinzugefügt.", 201);
}));

ticketRouter.delete("/:id/tags/:tagId", authorize("AGENT", "ADMIN"), asyncHandler(async (request, response) => {
  const ticket = await ensureTicketAccess(String(request.params.id), request.user!);
  await prisma.ticketTag.deleteMany({ where: { ticketId: ticket.id, tagId: String(request.params.tagId) } });
  await writeAudit(request, "TAG_REMOVED", "Ticket", ticket.id, { tagId: String(request.params.tagId) });
  return success(response, null, "Der Tag wurde entfernt.");
}));

async function applyStatusAction(ticketId: string, status: "OPEN" | "RESOLVED" | "CLOSED", user: Express.User) {
  const current = await ensureTicketAccess(ticketId, user);
  assertValidTransition(current.status, status, user.role);
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.update({ where: { id: current.id }, data: { status, ...(status === "RESOLVED" ? { resolvedAt: now } : {}), ...(status === "CLOSED" ? { closedAt: now } : {}), ...(status === "OPEN" ? { reopenedAt: now } : {}) } });
    await tx.ticketHistory.create({ data: { ticketId: current.id, changedById: user.id, action: status === "OPEN" ? "TICKET_REOPENED" : status === "RESOLVED" ? "TICKET_RESOLVED" : "TICKET_CLOSED", field: "status", oldValue: current.status, newValue: status } });
    return ticket;
  });
}

ticketRouter.post("/:id/reopen", asyncHandler(async (request, response) => success(response, await applyStatusAction(String(request.params.id), "OPEN", request.user!), "Das Ticket wurde wieder geöffnet.")));
ticketRouter.post("/:id/resolve", authorize("AGENT", "ADMIN"), asyncHandler(async (request, response) => success(response, await applyStatusAction(String(request.params.id), "RESOLVED", request.user!), "Das Ticket wurde als gelöst markiert.")));
ticketRouter.post("/:id/close", asyncHandler(async (request, response) => success(response, await applyStatusAction(String(request.params.id), "CLOSED", request.user!), "Das Ticket wurde geschlossen.")));

ticketRouter.post("/:id/watchers", authorize("AGENT", "ADMIN"), asyncHandler(async (request, response) => {
  const { userId } = z.object({ userId: z.string().optional() }).parse(request.body); const ticket = await ensureTicketAccess(String(request.params.id), request.user!); const watcher = await prisma.ticketWatcher.upsert({ where: { ticketId_userId: { ticketId: ticket.id, userId: userId ?? request.user!.id } }, update: {}, create: { ticketId: ticket.id, userId: userId ?? request.user!.id } }); return success(response, watcher, "Beobachter wurde hinzugefügt.", 201);
}));
ticketRouter.delete("/:id/watchers/:userId", authorize("AGENT", "ADMIN"), asyncHandler(async (request, response) => { const ticket = await ensureTicketAccess(String(request.params.id), request.user!); await prisma.ticketWatcher.deleteMany({ where: { ticketId: ticket.id, userId: String(request.params.userId) } }); return success(response, null, "Beobachter wurde entfernt."); }));

ticketRouter.post("/:id/merge", authorize("AGENT", "ADMIN"), asyncHandler(async (request, response) => {
  const { targetTicketId } = z.object({ targetTicketId: z.string() }).parse(request.body); const source = await ensureTicketAccess(String(request.params.id), request.user!); const target = await ensureTicketAccess(targetTicketId, request.user!); if (source.id === target.id) throw new AppError("Ein Ticket kann nicht mit sich selbst zusammengeführt werden.", 400, "INVALID_MERGE");
  await prisma.$transaction([prisma.ticket.update({ where: { id: source.id }, data: { status: "MERGED", mergedIntoId: target.id } }), prisma.ticketHistory.create({ data: { ticketId: source.id, changedById: request.user!.id, action: "TICKET_MERGED", newValue: target.ticketNumber, metadata: { targetTicketId: target.id } } }), prisma.ticketHistory.create({ data: { ticketId: target.id, changedById: request.user!.id, action: "MERGE_RECEIVED", newValue: source.ticketNumber, metadata: { sourceTicketId: source.id } } })]);
  await writeAudit(request, "TICKET_MERGED", "Ticket", source.id, { targetTicketId: target.id }); return success(response, { sourceId: source.id, targetId: target.id }, "Die Tickets wurden ohne Datenverlust verknüpft.");
}));

ticketRouter.post("/:id/rating", asyncHandler(async (request, response) => { const ticket = await ensureTicketAccess(String(request.params.id), request.user!); if (request.user!.role !== "CUSTOMER" || !["RESOLVED", "CLOSED"].includes(ticket.status)) throw new AppError("Eine Bewertung ist erst nach der Lösung möglich.", 409, "RATING_NOT_ALLOWED"); const input = z.object({ rating: z.number().int().min(1).max(5), feedback: z.string().max(2000).optional() }).parse(request.body); const result = await prisma.ticket.updateMany({ where: { id: ticket.id, customerRating: null }, data: { customerRating: input.rating, customerFeedback: input.feedback } }); if (!result.count) throw new AppError("Dieses Ticket wurde bereits bewertet.", 409, "RATING_EXISTS"); const updated = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }); await writeAudit(request, "TICKET_RATED", "Ticket", ticket.id, { rating: input.rating }); return success(response, updated, "Vielen Dank für Ihre Bewertung."); }));
