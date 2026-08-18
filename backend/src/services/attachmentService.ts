import { readFile, unlink } from "node:fs/promises";
import { basename } from "node:path";
import type { AttachmentVisibility } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import { attachmentType, detectedMimeType, hasValidSignature, sha256, validateFileName } from "../utils/files.js";
import { attachmentPublicSelect } from "./ticketService.js";

type SaveAttachmentsInput = {
  files: Express.Multer.File[];
  ticketId: string;
  uploadedById: string;
  visibility: AttachmentVisibility;
  commentId?: string;
};

async function removeFiles(paths: string[]): Promise<void> {
  await Promise.all(paths.map((path) => unlink(path).catch(() => undefined)));
}

class AttachmentService {
  async save(input: SaveAttachmentsInput) {
    const { files } = input;
    if (!files.length) throw new AppError("Bitte wählen Sie mindestens eine Datei aus.", 400, "NO_FILES");
    if (files.reduce((sum, file) => sum + file.size, 0) > env.MAX_TOTAL_UPLOAD_SIZE) {
      await removeFiles(files.map((file) => file.path));
      throw new AppError("Die Gesamtgröße der Dateien ist zu groß.", 400, "TOTAL_SIZE_EXCEEDED");
    }

    try {
      const metadata: Array<{ file: Express.Multer.File; extension: string; checksum: string; content: Uint8Array<ArrayBuffer> }> = [];
      for (const file of files) {
        const extension = validateFileName(file.originalname);
        if (!(await hasValidSignature(file.path, extension))) {
          throw new AppError(`Der tatsächliche Inhalt von „${file.originalname}“ stimmt nicht mit dem Dateityp überein.`, 400, "MIME_MISMATCH");
        }
        metadata.push({ file, extension, checksum: await sha256(file.path), content: Uint8Array.from(await readFile(file.path)) });
      }

      const records = await prisma.$transaction(async (tx) => Promise.all(metadata.map(({ file, extension, checksum, content }) => tx.attachment.create({
        data: {
          originalName: basename(file.originalname).slice(0, 255),
          storedName: file.filename,
          storageKey: file.filename,
          filePath: file.filename,
          mimeType: file.mimetype,
          detectedMimeType: detectedMimeType(extension),
          fileExtension: extension,
          fileSize: file.size,
          content,
          checksum,
          attachmentType: attachmentType(extension),
          visibility: input.visibility,
          scanStatus: "UNAVAILABLE",
          ticketId: input.ticketId,
          commentId: input.commentId,
          uploadedById: input.uploadedById,
        },
        select: attachmentPublicSelect,
      }))));
      await removeFiles(files.map((file) => file.path));
      return records;
    } catch (error) {
      await removeFiles(files.map((file) => file.path));
      throw error;
    }
  }
}

export const attachmentService = new AttachmentService();
