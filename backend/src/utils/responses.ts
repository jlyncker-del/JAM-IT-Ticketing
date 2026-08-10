import type { Response } from "express";

export function success<T>(response: Response, data: T, message?: string, status = 200): Response {
  return response.status(status).json({ success: true, ...(message ? { message } : {}), data });
}
