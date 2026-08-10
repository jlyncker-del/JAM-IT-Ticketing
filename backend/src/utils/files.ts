import { createHash } from "node:crypto";
import { extname } from "node:path";
import { readFile } from "node:fs/promises";
import yauzl from "yauzl";
import { ALLOWED_EXTENSIONS, BLOCKED_EXTENSIONS } from "../constants/tickets.js";
import { AppError } from "../errors/AppError.js";

export function validateFileName(name: string): string {
  const lower = name.toLowerCase();
  const parts = lower.split(".");
  if (parts.length > 2 && parts.slice(1, -1).some((part) => BLOCKED_EXTENSIONS.has(`.${part}`))) {
    throw new AppError("Dateien mit gefährlichen Doppelerweiterungen sind nicht erlaubt.", 400, "INVALID_FILE_TYPE");
  }
  const extension = extname(lower);
  if (!ALLOWED_EXTENSIONS.has(extension) || BLOCKED_EXTENSIONS.has(extension)) {
    throw new AppError("Dieser Dateityp ist nicht erlaubt.", 400, "INVALID_FILE_TYPE");
  }
  return extension;
}

export async function sha256(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

export async function hasValidSignature(path: string, extension: string): Promise<boolean> {
  const buffer = (await readFile(path)).subarray(0, 16);
  const hex = buffer.toString("hex");
  if ([".jpg", ".jpeg"].includes(extension)) return hex.startsWith("ffd8ff");
  if (extension === ".png") return hex.startsWith("89504e470d0a1a0a");
  if (extension === ".gif") return buffer.toString("ascii", 0, 6) === "GIF87a" || buffer.toString("ascii", 0, 6) === "GIF89a";
  if (extension === ".webp") return buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  if (extension === ".pdf") return buffer.toString("ascii", 0, 5) === "%PDF-";
  if (extension === ".zip") return isZipSignature(hex);
  if (extension === ".docx" || extension === ".xlsx") {
    if (!isZipSignature(hex)) return false;
    return hasExpectedOfficeEntries(path, extension);
  }
  if ([".doc", ".xls"].includes(extension)) return hex.startsWith("d0cf11e0a1b11ae1");
  return !buffer.includes(0);
}

function isZipSignature(hex: string): boolean {
  return hex.startsWith("504b0304") || hex.startsWith("504b0506") || hex.startsWith("504b0708");
}

async function hasExpectedOfficeEntries(path: string, extension: ".docx" | ".xlsx"): Promise<boolean> {
  const required = extension === ".docx"
    ? ["[Content_Types].xml", "word/document.xml"]
    : ["[Content_Types].xml", "xl/workbook.xml"];
  return new Promise((resolve) => {
    yauzl.open(path, { lazyEntries: true, autoClose: true }, (openError, zipFile) => {
      if (openError || !zipFile) return resolve(false);
      const entries = new Set<string>();
      let count = 0;
      let settled = false;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        zipFile.close();
        resolve(value);
      };
      zipFile.on("entry", (entry) => {
        count += 1;
        if (count > 10_000) return finish(false);
        entries.add(entry.fileName.replaceAll("\\", "/"));
        if (required.every((name) => entries.has(name))) return finish(true);
        zipFile.readEntry();
      });
      zipFile.on("end", () => finish(required.every((name) => entries.has(name))));
      zipFile.on("error", () => finish(false));
      zipFile.readEntry();
    });
  });
}

export function attachmentType(extension: string): "IMAGE" | "LOG" | "DOCUMENT" | "ARCHIVE" | "OTHER" {
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extension)) return "IMAGE";
  if ([".log", ".txt", ".csv", ".json", ".xml"].includes(extension)) return "LOG";
  if ([".pdf", ".doc", ".docx", ".xls", ".xlsx"].includes(extension)) return "DOCUMENT";
  if (extension === ".zip") return "ARCHIVE";
  return "OTHER";
}

export function detectedMimeType(extension: string): string {
  const types: Record<string, string> = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
    ".log": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".csv": "text/csv; charset=utf-8", ".json": "application/json", ".xml": "application/xml",
    ".pdf": "application/pdf", ".doc": "application/msword", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".zip": "application/zip",
  };
  return types[extension] ?? "application/octet-stream";
}
