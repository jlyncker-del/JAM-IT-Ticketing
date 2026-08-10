import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import multer from "multer";
import { env } from "../config/env.js";
import { validateFileName } from "../utils/files.js";

export const uploadDirectory = resolve(process.cwd(), env.UPLOAD_DIR);
const temporaryUploadDirectory = join(uploadDirectory, ".tmp");
mkdirSync(temporaryUploadDirectory, { recursive: true });

export const upload = multer({
  storage: multer.diskStorage({
    destination: temporaryUploadDirectory,
    filename: (_request, file, callback) => {
      const extension = validateFileName(basename(file.originalname));
      callback(null, `${randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: env.MAX_FILE_SIZE, files: env.MAX_FILES_PER_REQUEST },
  fileFilter: (_request, file, callback) => {
    try { validateFileName(basename(file.originalname)); callback(null, true); }
    catch (error) { callback(error as Error); }
  },
});
