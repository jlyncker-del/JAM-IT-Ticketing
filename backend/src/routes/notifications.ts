import { Router } from "express";
import { prisma } from "../config/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success } from "../utils/responses.js";

export const notificationRouter = Router();
notificationRouter.use(authenticate);
notificationRouter.get("/", asyncHandler(async (request, response) => success(response, await prisma.notification.findMany({ where: { userId: request.user!.id }, orderBy: { createdAt: "desc" }, take: 100 }))));
notificationRouter.patch("/read-all", asyncHandler(async (request, response) => { await prisma.notification.updateMany({ where: { userId: request.user!.id, readAt: null }, data: { readAt: new Date() } }); return success(response, null, "Alle Benachrichtigungen wurden als gelesen markiert."); }));
notificationRouter.patch("/:id/read", asyncHandler(async (request, response) => { const item = await prisma.notification.updateMany({ where: { id: String(request.params.id), userId: request.user!.id }, data: { readAt: new Date() } }); return success(response, item, "Die Benachrichtigung wurde als gelesen markiert."); }));
