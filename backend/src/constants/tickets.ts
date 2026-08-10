import type { TicketStatus } from "@prisma/client";

export const VALID_STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  DRAFT: ["NEW", "CANCELLED"],
  NEW: ["OPEN", "ASSIGNED", "CANCELLED"],
  OPEN: ["ASSIGNED", "IN_PROGRESS", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "OPEN", "CANCELLED"],
  IN_PROGRESS: ["WAITING_FOR_CUSTOMER", "WAITING_FOR_THIRD_PARTY", "RESOLVED", "CANCELLED"],
  WAITING_FOR_CUSTOMER: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  WAITING_FOR_THIRD_PARTY: ["IN_PROGRESS", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "OPEN"],
  CLOSED: ["OPEN"],
  CANCELLED: ["OPEN"],
  MERGED: [],
};

export const ALLOWED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".log", ".txt", ".csv", ".json", ".xml",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".zip",
]);

export const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".com", ".scr", ".ps1", ".sh", ".php", ".js", ".jar", ".msi", ".dll", ".vbs",
]);
