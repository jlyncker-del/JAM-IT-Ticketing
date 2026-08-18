import { Prisma, type TicketPriority, type TicketStatus, type UserRole } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { VALID_STATUS_TRANSITIONS } from "../constants/tickets.js";
import { AppError } from "../errors/AppError.js";
import { formatTicketNumber } from "../utils/ticketNumber.js";

export const attachmentPublicSelect = {
  id: true,
  originalName: true,
  mimeType: true,
  detectedMimeType: true,
  fileExtension: true,
  fileSize: true,
  attachmentType: true,
  visibility: true,
  scanStatus: true,
  ticketId: true,
  commentId: true,
  uploadedById: true,
  createdAt: true,
} satisfies Prisma.AttachmentSelect;

export const ticketInclude = {
  category: true,
  customer: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, company: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true, role: true } },
  assignedAgent: { select: { id: true, firstName: true, lastName: true, email: true } },
  assignedTeam: true,
  slaPolicy: true,
  tags: { include: { tag: true } },
  watchers: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
  links: true,
  attachments: { select: attachmentPublicSelect },
  comments: { where: { deletedAt: null }, include: { author: { select: { id: true, firstName: true, lastName: true, role: true } }, attachments: { select: attachmentPublicSelect } }, orderBy: { createdAt: "asc" as const } },
  history: { include: { changedBy: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.TicketInclude;

export function accessWhere(user: Express.User): Prisma.TicketWhereInput {
  return user.role === "CUSTOMER" ? { customerId: user.id } : {};
}

export async function ensureTicketAccess(ticketId: string, user: Express.User) {
  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, ...accessWhere(user) }, include: ticketInclude });
  if (!ticket) throw new AppError("Das Ticket wurde nicht gefunden oder Sie haben keinen Zugriff darauf.", 404, "TICKET_NOT_FOUND");
  if (user.role === "CUSTOMER") {
    ticket.comments = ticket.comments.filter((comment) => !comment.isInternal);
    ticket.attachments = ticket.attachments.filter((attachment) => attachment.visibility === "PUBLIC");
    for (const comment of ticket.comments) comment.attachments = comment.attachments.filter((attachment) => attachment.visibility === "PUBLIC");
  }
  return ticket;
}

export async function nextTicketNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `JAM-${year}-`;
  const [counter] = await prisma.$queryRaw<Array<{ lastValue: number }>>(Prisma.sql`
    INSERT INTO "TicketSequence" ("year", "lastValue", "updatedAt")
    SELECT ${year}, COALESCE(MAX(CAST(SPLIT_PART("ticketNumber", '-', 3) AS INTEGER)), 0) + 1, CURRENT_TIMESTAMP
    FROM "Ticket"
    WHERE "ticketNumber" LIKE ${`${prefix}%`}
    ON CONFLICT ("year") DO UPDATE SET
      "lastValue" = GREATEST("TicketSequence"."lastValue" + 1, EXCLUDED."lastValue"),
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "lastValue"
  `);
  if (!counter) throw new AppError("Die nächste Ticketnummer konnte nicht reserviert werden.", 500, "TICKET_NUMBER_ERROR");
  return formatTicketNumber(counter.lastValue, year);
}

export async function slaForPriority(priority: TicketPriority, createdAt = new Date()) {
  const policy = await prisma.slaPolicy.findFirst({ where: { priority, isActive: true }, orderBy: { createdAt: "asc" } });
  if (!policy) throw new AppError(`Für die Priorität ${priority} ist keine aktive SLA-Richtlinie konfiguriert.`, 409, "SLA_POLICY_MISSING");
  // Bei einer Prioritätsänderung werden Fristen ab dem ursprünglichen
  // Erstellungszeitpunkt neu berechnet. So bleibt die gesamte Laufzeit messbar.
  return {
    slaPolicyId: policy.id,
    firstResponseDueAt: new Date(createdAt.getTime() + policy.firstResponseMinutes * 60_000),
    resolutionDueAt: new Date(createdAt.getTime() + policy.resolutionMinutes * 60_000),
  };
}

export function assertValidTransition(from: TicketStatus, to: TicketStatus, role: UserRole): void {
  if (!VALID_STATUS_TRANSITIONS[from].includes(to)) throw new AppError(`Der Statuswechsel von ${from} zu ${to} ist nicht zulässig.`, 409, "INVALID_STATUS_TRANSITION");
  if (role === "CUSTOMER" && !((from === "RESOLVED" && ["CLOSED", "OPEN"].includes(to)) || (from === "CLOSED" && to === "OPEN"))) {
    throw new AppError("Sie sind nicht berechtigt, diesen Statuswechsel auszuführen.", 403, "FORBIDDEN");
  }
}
