import "dotenv/config";
import { z } from "zod";

const baseSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(32).optional(),
  REFRESH_TOKEN_SECRET: z.string().min(32).optional(),
  JWT_EXPIRES_IN: z.string().default("1d"),
  FRONTEND_URL: z.string().url().optional(),
  UPLOAD_STORAGE: z.enum(["local", "s3"]).default("local"),
  UPLOAD_DIR: z.string().default("uploads"),
  MAX_FILE_SIZE: z.coerce.number().int().positive().default(15 * 1024 * 1024),
  MAX_FILES_PER_REQUEST: z.coerce.number().int().positive().max(20).default(10),
  MAX_TOTAL_UPLOAD_SIZE: z.coerce.number().int().positive().default(50 * 1024 * 1024),
  MAIL_PROVIDER: z.enum(["development", "smtp"]).default("development"),
  MAIL_FROM: z.string().default("service@jam-it.local"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  APP_NAME: z.string().default("JAM IT HelpDesk"),
  COMPANY_NAME: z.string().default("JAM IT Dienstleistungen"),
});

const parsed = baseSchema.parse(process.env);
const production = parsed.NODE_ENV === "production";

function requiredSecret(name: "DATABASE_URL" | "JWT_SECRET" | "REFRESH_TOKEN_SECRET", developmentDefault: string): string {
  const value = parsed[name];
  if (value) return value;
  if (production) throw new Error(`${name} is required in production.`);
  return developmentDefault;
}

const databaseUrl = requiredSecret("DATABASE_URL", "postgresql://postgres:password@localhost:5432/jam_it_helpdesk");
const jwtSecret = requiredSecret("JWT_SECRET", "development-only-access-secret-change-me");
const refreshTokenSecret = requiredSecret("REFRESH_TOKEN_SECRET", "development-only-refresh-secret-change-me");
const frontendUrl = parsed.FRONTEND_URL ?? (production ? undefined : "http://localhost:5173");

if (!frontendUrl) {
  throw new Error("FRONTEND_URL is required in production.");
}

if (production && parsed.MAIL_PROVIDER === "smtp" && (!parsed.SMTP_HOST || !parsed.SMTP_USER || !parsed.SMTP_PASSWORD)) {
  throw new Error("SMTP_HOST, SMTP_USER and SMTP_PASSWORD are required when MAIL_PROVIDER=smtp in production.");
}
if (production && parsed.MAIL_PROVIDER !== "smtp") {
  console.warn("SMTP is not configured. Email delivery, including password-reset emails, is disabled.");
}
if (production && parsed.UPLOAD_STORAGE === "s3") {
  throw new Error("UPLOAD_STORAGE=s3 is not configured. Use a persistent storage adapter before enabling it in production.");
}

export const env = {
  ...parsed,
  DATABASE_URL: databaseUrl,
  JWT_SECRET: jwtSecret,
  REFRESH_TOKEN_SECRET: refreshTokenSecret,
  FRONTEND_URL: frontendUrl,
};

// Prisma reads DATABASE_URL from process.env. Keep the validated/defaulted value
// as the single runtime source of truth.
process.env.DATABASE_URL = env.DATABASE_URL;
