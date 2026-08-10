import type { Request } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";

export async function writeAudit(request: Request, action: string, entityType: string, entityId?: string, metadata?: Record<string, unknown>): Promise<void> {
  await prisma.auditLog.create({ data: { userId: request.user?.id, action, entityType, entityId, ipAddress: request.ip, userAgent: request.get("user-agent")?.slice(0, 500), metadata: metadata as Prisma.InputJsonObject | undefined } });
}
