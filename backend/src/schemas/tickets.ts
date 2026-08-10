import { TicketPriority, TicketSource, TicketStatus } from "@prisma/client";
import { z } from "zod";

export const linkSchema = z.object({
  url: z.string().url("Bitte geben Sie eine gültige Webadresse ein.").max(2048).refine((url) => ["http:", "https:"].includes(new URL(url).protocol), "Nur HTTP- und HTTPS-Adressen sind erlaubt."),
  title: z.string().trim().max(160).optional(),
  description: z.string().trim().max(500).optional(),
});

export const createTicketSchema = z.object({
  subject: z.string().trim().min(3, "Bitte geben Sie einen Betreff ein.").max(150, "Der Betreff darf maximal 150 Zeichen enthalten."),
  description: z.string().trim().min(20, "Bitte beschreiben Sie das Problem ausführlich.").max(20_000),
  categoryId: z.string().min(1, "Bitte wählen Sie eine Kategorie aus."),
  priority: z.nativeEnum(TicketPriority).optional(),
  source: z.nativeEnum(TicketSource).optional(),
  isDraft: z.boolean().optional().default(false),
  sensitiveDataConfirmed: z.literal(true, { error: "Bitte bestätigen Sie den Hinweis zu vertraulichen Zugangsdaten." }),
  affectedSystem: z.string().trim().max(120).optional(),
  device: z.string().trim().max(120).optional(),
  operatingSystem: z.string().trim().max(120).optional(),
  browser: z.string().trim().max(120).optional(),
  errorMessage: z.string().trim().max(2_000).optional(),
  urgencyDescription: z.string().trim().max(1_000).optional(),
  contactPhone: z.string().trim().max(40).optional(),
  preferredContactMethod: z.string().trim().max(40).optional(),
  preferredAvailability: z.string().trim().max(200).optional(),
  technicalInformation: z.string().trim().max(5_000).optional(),
  links: z.array(linkSchema).max(10, "Es sind höchstens 10 Links erlaubt.").optional(),
  customerId: z.string().optional(),
});

export const ticketUpdateSchema = createTicketSchema.omit({ sensitiveDataConfirmed: true, isDraft: true, links: true, customerId: true }).partial();

export const ticketQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(150).optional(),
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  categoryId: z.string().optional(),
  assignedAgentId: z.string().optional(),
  assignedTeamId: z.string().optional(),
  source: z.nativeEnum(TicketSource).optional(),
  sla: z.enum(["warning", "breached", "within"]).optional(),
  withAttachments: z.enum(["true", "false"]).optional(),
  unassigned: z.enum(["true", "false"]).optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "priority", "status", "resolutionDueAt", "ticketNumber"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const commentSchema = z.object({ content: z.string().trim().min(2, "Bitte geben Sie eine Nachricht ein.").max(10_000), isInternal: z.boolean().default(false) });
export const statusSchema = z.object({ status: z.nativeEnum(TicketStatus) });
export const prioritySchema = z.object({ priority: z.nativeEnum(TicketPriority) });
export const assignmentSchema = z.object({ assignedAgentId: z.string().nullable().optional(), assignedTeamId: z.string().nullable().optional() });
