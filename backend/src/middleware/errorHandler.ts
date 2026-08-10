import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { ZodError } from "zod";
import { AppError } from "../errors/AppError.js";

export const notFound: import("express").RequestHandler = (_request, _response, next) => {
  next(new AppError("Die angeforderte Ressource wurde nicht gefunden.", 404, "NOT_FOUND"));
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({ success: false, message: "Die eingegebenen Daten sind ungültig.", code: "VALIDATION_ERROR", errors: error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })) });
    return;
  }
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE" ? "Die Datei überschreitet die maximal zulässige Größe." : "Die Dateien konnten nicht hochgeladen werden.";
    response.status(400).json({ success: false, message, code: "UPLOAD_ERROR" });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    response.status(409).json({ success: false, message: "Dieser Datensatz ist bereits vorhanden.", code: "CONFLICT" });
    return;
  }
  const appError = error instanceof AppError ? error : new AppError("Ein unerwarteter Fehler ist aufgetreten.");
  response.status(appError.statusCode).json({ success: false, message: appError.message, code: appError.code, ...(appError.details ? { errors: appError.details } : {}) });
};
