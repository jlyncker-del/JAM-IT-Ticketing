import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { AppError } from "../errors/AppError.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { writeAudit } from "../middleware/audit.js";
import { ensureTicketAccess } from "../services/ticketService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success } from "../utils/responses.js";
import { storageService } from "../services/storageService.js";

export const attachmentRouter = Router();
attachmentRouter.use(authenticate);

async function accessibleAttachment(id: string, user: Express.User) {
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) throw new AppError("Die Datei wurde nicht gefunden.", 404, "NOT_FOUND");
  await ensureTicketAccess(attachment.ticketId, user);
  if (user.role === "CUSTOMER" && attachment.visibility === "INTERNAL") throw new AppError("Sie sind nicht berechtigt, diese Datei aufzurufen.", 403, "FORBIDDEN");
  return attachment;
}

attachmentRouter.get("/:id", asyncHandler(async (request, response) => {
  const attachment = await accessibleAttachment(String(request.params.id), request.user!);
  return success(response, { ...attachment, filePath: undefined, storedName: undefined });
}));

attachmentRouter.get("/:id/download", asyncHandler(async (request, response) => {
  const attachment = await accessibleAttachment(String(request.params.id), request.user!);
  response.setHeader("Content-Type", attachment.detectedMimeType);
  response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`);
  response.setHeader("X-Content-Type-Options", "nosniff");
  await writeAudit(request, "ATTACHMENT_DOWNLOADED", "Attachment", attachment.id);
  storageService.createReadStream(attachment.filePath).pipe(response);
}));

attachmentRouter.get("/:id/preview", asyncHandler(async (request, response) => {
  const attachment = await accessibleAttachment(String(request.params.id), request.user!);
  if (attachment.attachmentType === "IMAGE") {
    response.setHeader("Content-Type", attachment.detectedMimeType);
    response.setHeader("Content-Disposition", "inline");
    response.setHeader("X-Content-Type-Options", "nosniff");
    storageService.createReadStream(attachment.filePath).pipe(response);
    return;
  }
  if (attachment.attachmentType !== "LOG") throw new AppError("Für diesen Dateityp ist keine Vorschau verfügbar.", 400, "PREVIEW_UNAVAILABLE");
  const content = (await storageService.readText(attachment.filePath, 100_000)).split(/\r?\n/).slice(0, 500).join("\n");
  response.type("text/plain; charset=utf-8").send(content);
}));

attachmentRouter.delete("/:id", authorize("AGENT", "ADMIN"), asyncHandler(async (request, response) => {
  const attachment = await accessibleAttachment(String(request.params.id), request.user!);
  await prisma.attachment.delete({ where: { id: attachment.id } });
  await storageService.delete(attachment.filePath).catch(() => undefined);
  await writeAudit(request, "ATTACHMENT_DELETED", "Attachment", attachment.id);
  return success(response, null, "Die Datei wurde gelöscht.");
}));
