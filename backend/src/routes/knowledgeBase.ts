import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { AppError } from "../errors/AppError.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { writeAudit } from "../middleware/audit.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { success } from "../utils/responses.js";

const articleSchema = z.object({ title: z.string().trim().min(3).max(180), slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), summary: z.string().trim().min(10).max(500), content: z.string().trim().min(20).max(50_000), categoryId: z.string().nullable().optional(), status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT") });
export const knowledgeBaseRouter = Router();
knowledgeBaseRouter.use(authenticate);
knowledgeBaseRouter.get("/articles", asyncHandler(async (request, response) => {
  const search = String(request.query.search ?? "").slice(0, 120);
  const categoryId = String(request.query.categoryId ?? "").slice(0, 80);
  const articles = await prisma.knowledgeBaseArticle.findMany({ where: { ...(request.user!.role === "CUSTOMER" ? { status: "PUBLISHED" } : {}), ...(categoryId ? { categoryId } : {}), ...(search ? { OR: [{ title: { contains: search, mode: "insensitive" } }, { summary: { contains: search, mode: "insensitive" } }] } : {}) }, include: { category: true, author: { select: { firstName: true, lastName: true } } }, orderBy: { updatedAt: "desc" } });
  return success(response, articles);
}));
knowledgeBaseRouter.get("/articles/:slug", asyncHandler(async (request, response) => { const article = await prisma.knowledgeBaseArticle.findFirst({ where: { slug: String(request.params.slug), ...(request.user!.role === "CUSTOMER" ? { status: "PUBLISHED" } : {}) }, include: { category: true, author: { select: { firstName: true, lastName: true } } } }); if (!article) throw new AppError("Der Artikel wurde nicht gefunden.", 404, "NOT_FOUND"); return success(response, article); }));
knowledgeBaseRouter.post("/articles", authorize("AGENT", "ADMIN"), asyncHandler(async (request, response) => { const input = articleSchema.parse(request.body); const article = await prisma.knowledgeBaseArticle.create({ data: { ...input, authorId: request.user!.id, publishedAt: input.status === "PUBLISHED" ? new Date() : null } }); await writeAudit(request, "ARTICLE_CREATED", "KnowledgeBaseArticle", article.id, { status: article.status }); return success(response, article, "Der Artikel wurde erstellt.", 201); }));
knowledgeBaseRouter.patch("/articles/:id", authorize("AGENT", "ADMIN"), asyncHandler(async (request, response) => { const input = articleSchema.partial().parse(request.body); const article = await prisma.knowledgeBaseArticle.update({ where: { id: String(request.params.id) }, data: { ...input, ...(input.status === "PUBLISHED" ? { publishedAt: new Date() } : {}) } }); await writeAudit(request, "ARTICLE_UPDATED", "KnowledgeBaseArticle", article.id, { status: article.status }); return success(response, article, "Der Artikel wurde aktualisiert."); }));
knowledgeBaseRouter.delete("/articles/:id", authorize("ADMIN"), asyncHandler(async (request, response) => { await prisma.knowledgeBaseArticle.update({ where: { id: String(request.params.id) }, data: { status: "ARCHIVED" } }); await writeAudit(request, "ARTICLE_ARCHIVED", "KnowledgeBaseArticle", String(request.params.id)); return success(response, null, "Der Artikel wurde archiviert."); }));
