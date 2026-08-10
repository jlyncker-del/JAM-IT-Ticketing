import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";

const server = app.listen(env.PORT, () => {
  console.log(`JAM IT HelpDesk API läuft auf http://localhost:${env.PORT}`);
  console.log(`Swagger: http://localhost:${env.PORT}/api-docs`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} empfangen – Server wird beendet.`);
  server.close(async () => { await prisma.$disconnect(); process.exit(0); });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
