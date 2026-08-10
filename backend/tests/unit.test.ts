import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createTicketSchema, linkSchema } from "../src/schemas/tickets.js";
import { assertValidTransition } from "../src/services/ticketService.js";
import { formatTicketNumber } from "../src/utils/ticketNumber.js";
import { hasValidSignature, validateFileName } from "../src/utils/files.js";

describe("Ticket-Fachlogik", () => {
  it("generiert formatierte Ticketnummern", () => expect(formatTicketNumber(123, new Date("2026-08-06"))).toBe("JAM-2026-000123"));
  it("erlaubt gültige Statuswechsel", () => expect(() => assertValidTransition("IN_PROGRESS", "RESOLVED", "AGENT")).not.toThrow());
  it("blockiert ungültige Statuswechsel", () => expect(() => assertValidTransition("NEW", "CLOSED", "AGENT")).toThrow(/nicht zulässig/));
  it("beschränkt Kunden auf Bestätigung oder Wiederöffnung", () => expect(() => assertValidTransition("NEW", "OPEN", "CUSTOMER")).toThrow(/nicht berechtigt/));
});

describe("Validierung", () => {
  it("akzeptiert ausschließlich HTTP- und HTTPS-Links", () => { expect(linkSchema.safeParse({ url: "https://jam-it.example/hilfe" }).success).toBe(true); expect(linkSchema.safeParse({ url: "javascript:alert(1)" }).success).toBe(false); });
  it("lehnt gefährliche und doppelte Dateiendungen ab", () => { expect(() => validateFileName("bericht.pdf")).not.toThrow(); expect(() => validateFileName("rechnung.pdf.exe")).toThrow(); expect(() => validateFileName("skript.js")).toThrow(); });
  it("lehnt eine ZIP-Signatur ohne DOCX-Struktur ab", async () => { const directory = await mkdtemp(join(tmpdir(), "jam-it-test-")); try { const path = join(directory, "fake.docx"); await writeFile(path, Buffer.from("504b030400000000", "hex")); await expect(hasValidSignature(path, ".docx")).resolves.toBe(false); } finally { await rm(directory, { recursive: true }); } });
  it("verlangt eine ausführliche Beschreibung und Sicherheitsbestätigung", () => { const result = createTicketSchema.safeParse({ subject: "VPN defekt", description: "zu kurz", categoryId: "category", sensitiveDataConfirmed: false }); expect(result.success).toBe(false); });
});
