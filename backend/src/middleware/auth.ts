import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@prisma/client";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../errors/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

type TokenPayload = { sub: string; role: UserRole; tokenVersion: number };

export const authenticate = asyncHandler(async (request, _response, next) => {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new AppError("Bitte melden Sie sich an.", 401, "UNAUTHORIZED");
  let payload: TokenPayload;
  try {
    payload = jwt.verify(header.slice(7), env.JWT_SECRET) as TokenPayload;
  } catch {
    throw new AppError("Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.", 401, "INVALID_TOKEN");
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, isActive: true, tokenVersion: true } });
  if (!user?.isActive || user.tokenVersion !== payload.tokenVersion) throw new AppError("Ihre Sitzung ist nicht mehr gültig.", 401, "INVALID_SESSION");
  request.user = { id: user.id, role: user.role, tokenVersion: user.tokenVersion };
  next();
});

export function authorize(...roles: UserRole[]) {
  return (request: Request, _response: Response, next: NextFunction): void => {
    if (!request.user || !roles.includes(request.user.role)) return next(new AppError("Sie sind nicht berechtigt, diese Aktion auszuführen.", 403, "FORBIDDEN"));
    next();
  };
}
