import { createHash } from "node:crypto";
import { readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import request from "supertest";
import { ZipFile } from "yazl";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";

const databaseAvailable = Boolean(process.env.TEST_DATABASE_URL);
function officeArchive(kind: "docx" | "xlsx"): Promise<Buffer> {
  return new Promise((resolveArchive, reject) => {
    const zip = new ZipFile(); const chunks: Buffer[] = [];
    zip.outputStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    zip.outputStream.on("end", () => resolveArchive(Buffer.concat(chunks)));
    zip.outputStream.on("error", reject);
    zip.addBuffer(Buffer.from("<?xml version=\"1.0\"?><Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"></Types>"), "[Content_Types].xml");
    zip.addBuffer(Buffer.from("<?xml version=\"1.0\"?><root/>"), kind === "docx" ? "word/document.xml" : "xl/workbook.xml");
    zip.end();
  });
}
describe.skipIf(!databaseAvailable).sequential("API-Integration", () => {
  let customerToken = ""; let otherCustomerToken = ""; let agentToken = ""; let adminToken = ""; let agentId = ""; let categoryId = ""; let teamId = ""; let ticketId = ""; let publicAttachmentId = ""; let registeredUserId = ""; const uniqueEmail = `integration-${Date.now()}@example.test`;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const [customer, otherCustomer, agent, admin, category, team] = await Promise.all([
      request(app).post("/api/v1/auth/login").send({ email: "kunde@jam-it.local", password: "Kunde123!" }),
      request(app).post("/api/v1/auth/login").send({ email: "anna.schmidt@beispiel.local", password: "Kunde123!" }),
      request(app).post("/api/v1/auth/login").send({ email: "agent@jam-it.local", password: "Agent123!" }),
      request(app).post("/api/v1/auth/login").send({ email: "admin@jam-it.local", password: "Admin123!" }),
      prisma.category.findFirstOrThrow({ where: { isActive: true } }),
      prisma.supportTeam.findFirstOrThrow({ where: { isActive: true } }),
    ]);
    customerToken = customer.body.data.token; otherCustomerToken = otherCustomer.body.data.token; agentToken = agent.body.data.token; adminToken = admin.body.data.token; agentId = agent.body.data.user.id; categoryId = category.id; teamId = team.id;
  });

  it("liefert Healthcheck und umfangreiche OpenAPI-Dokumentation", async () => { const health = await request(app).get("/health"); const docs = await request(app).get("/api-docs.json"); expect(health.status).toBe(200); expect(health.body.data.application).toBe("JAM IT HelpDesk"); expect(Object.keys(docs.body.paths).length).toBeGreaterThan(20); });
  it("registriert ein Kundenkonto", async () => { const response = await request(app).post("/api/v1/auth/register").send({ firstName: "Integration", lastName: "Kunde", email: uniqueEmail, password: "Sicheres123!", company: "Test GmbH" }); expect(response.status).toBe(201); expect(response.body.data.role).toBe("CUSTOMER"); registeredUserId = response.body.data.id; });
  it("weist ungültige Anmeldung generisch ab", async () => { const response = await request(app).post("/api/v1/auth/login").send({ email: uniqueEmail, password: "Falsch123!" }); expect(response.status).toBe(401); expect(response.body.message).toBe("E-Mail-Adresse oder Passwort ist nicht korrekt."); });
  it("weist ein gesperrtes Konto generisch ab", async () => { const email = `locked-${Date.now()}@example.test`; await prisma.user.create({ data: { firstName: "Gesperrt", lastName: "Konto", email, passwordHash: await bcrypt.hash("Sicheres123!", 4), lockedUntil: new Date(Date.now() + 60_000) } }); const response = await request(app).post("/api/v1/auth/login").send({ email, password: "Sicheres123!" }); expect(response.status).toBe(401); expect(response.body.code).toBe("INVALID_CREDENTIALS"); });
  it("sperrt ein Konto nach fünf falschen Passwörtern", async () => { const email = `lockout-${Date.now()}@example.test`; const user = await prisma.user.create({ data: { firstName: "Lockout", lastName: "Test", email, passwordHash: await bcrypt.hash("Sicheres123!", 4) } }); for (let attempt = 0; attempt < 5; attempt += 1) expect((await request(app).post("/api/v1/auth/login").send({ email, password: "Falsch123!" })).status).toBe(401); expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).lockedUntil).toBeTruthy(); });
  it("schützt Endpunkte ohne Token", async () => { expect((await request(app).get("/api/v1/tickets")).status).toBe(401); });
  it("lädt den aktuell angemeldeten Benutzer", async () => { const response = await request(app).get("/api/v1/auth/me").set(auth(customerToken)); expect(response.status).toBe(200); expect(response.body.data.email).toBe("kunde@jam-it.local"); expect(response.body.data.passwordHash).toBeUndefined(); });
  it("erstellt ein Kundenticket mit SLA-Richtlinie", async () => { const response = await request(app).post("/api/v1/tickets").set(auth(customerToken)).send({ subject: "Integrationstest Upload und Workflow", description: "Dieses Ticket prüft den vollständigen Workflow mit ausreichender Beschreibung.", categoryId, sensitiveDataConfirmed: true }); expect(response.status).toBe(201); ticketId = response.body.data.id; expect(response.body.data.ticketNumber).toMatch(/^JAM-\d{4}-\d{6}$/); expect(response.body.data.slaPolicyId).toBeTruthy(); expect(response.body.data.resolutionDueAt).toBeTruthy(); });
  it("verhindert Ticketzuweisung durch Kunden", async () => { const response = await request(app).patch(`/api/v1/tickets/${ticketId}/assign`).set(auth(customerToken)).send({ selfAssign: true }); expect(response.status).toBe(403); });
  it("erstellt als Agent ein Ticket für den ausgewählten Kunden", async () => { const response = await request(app).post("/api/v1/tickets").set(auth(agentToken)).send({ subject: "Ticket im Kundenauftrag", description: "Der Support erfasst dieses Ticket ausdrücklich im Auftrag des ausgewählten Kunden.", categoryId, customerId: registeredUserId, priority: "HIGH", sensitiveDataConfirmed: true }); expect(response.status).toBe(201); expect(response.body.data.customerId).toBe(registeredUserId); expect(response.body.data.createdById).not.toBe(registeredUserId); });
  it("verlangt bei Supporttickets eine Kundenauswahl", async () => { const response = await request(app).post("/api/v1/tickets").set(auth(agentToken)).send({ subject: "Ohne Kundenbezug", description: "Dieser Datensatz darf ohne ausgewählten Kunden nicht angelegt werden.", categoryId, sensitiveDataConfirmed: true }); expect(response.status).toBe(400); expect(response.body.code).toBe("CUSTOMER_REQUIRED"); });
  it("speichert, bearbeitet, reicht ein und löscht Ticketentwürfe", async () => { const first = await request(app).post("/api/v1/tickets").set(auth(customerToken)).send({ subject: "Entwurf für Integration", description: "Dieser Entwurf wird vor dem Einreichen noch fachlich überarbeitet und geprüft.", categoryId, isDraft: true, sensitiveDataConfirmed: true }); expect(first.body.data.status).toBe("DRAFT"); const edited = await request(app).patch(`/api/v1/tickets/${first.body.data.id}`).set(auth(customerToken)).send({ subject: "Überarbeiteter Integrationsentwurf" }); expect(edited.status).toBe(200); expect((await request(app).post(`/api/v1/tickets/${first.body.data.id}/submit`).set(auth(customerToken)).send()).body.data.status).toBe("NEW"); const second = await request(app).post("/api/v1/tickets").set(auth(customerToken)).send({ subject: "Zu löschender Entwurf", description: "Dieser zweite Entwurf wird im Integrationstest kontrolliert wieder gelöscht.", categoryId, isDraft: true, sensitiveDataConfirmed: true }); expect((await request(app).delete(`/api/v1/tickets/${second.body.data.id}`).set(auth(customerToken))).status).toBe(200); });
  it("generiert Ticketnummern unter Parallelität eindeutig", async () => { const responses = await Promise.all(Array.from({ length: 5 }, (_, index) => request(app).post("/api/v1/tickets").set(auth(customerToken)).send({ subject: `Paralleles Ticket ${index}`, description: "Parallel erzeugtes Ticket zur Prüfung der datenbankgestützten Nummernfolge.", categoryId, sensitiveDataConfirmed: true }))); const numbers = responses.map((response) => response.body.data.ticketNumber); expect(responses.every((response) => response.status === 201)).toBe(true); expect(new Set(numbers).size).toBe(numbers.length); });
  it("sucht, filtert, sortiert und paginiert Tickets", async () => {
    const response = await request(app).get("/api/v1/tickets").set(auth(customerToken)).query({ search: "Integrationstest", priority: "MEDIUM", sortBy: "createdAt", sortOrder: "asc", page: 1, limit: 5 });
    expect(response.status).toBe(200);
    expect(response.body.pagination.page).toBe(1);
    expect(response.body.pagination.limit).toBe(5);
    expect(response.body.data.some((ticket: { id: string }) => ticket.id === ticketId)).toBe(true);
  });
  it("weist Bearbeiter und Team zu und erzeugt Benachrichtigungen", async () => { const agent = await prisma.user.findUniqueOrThrow({ where: { email: "agent@jam-it.local" } }); const response = await request(app).patch(`/api/v1/tickets/${ticketId}/assign`).set(auth(adminToken)).send({ assignedAgentId: agent.id, assignedTeamId: teamId }); expect(response.status).toBe(200); expect(response.body.data.assignedTeamId).toBe(teamId); expect(await prisma.notification.count({ where: { entityId: ticketId, type: "TICKET_ASSIGNED" } })).toBeGreaterThan(0); });
  it("ändert Priorität mit passender SLA-Richtlinie", async () => { const response = await request(app).patch(`/api/v1/tickets/${ticketId}/priority`).set(auth(agentToken)).send({ priority: "CRITICAL" }); expect(response.status).toBe(200); const policy = await prisma.slaPolicy.findUniqueOrThrow({ where: { id: response.body.data.slaPolicyId } }); expect(policy.priority).toBe("CRITICAL"); });
  it("erlaubt gültige und blockiert ungültige Statuswechsel", async () => { const valid = await request(app).patch(`/api/v1/tickets/${ticketId}/status`).set(auth(agentToken)).send({ status: "IN_PROGRESS" }); expect(valid.status).toBe(200); const invalid = await request(app).patch(`/api/v1/tickets/${ticketId}/status`).set(auth(agentToken)).send({ status: "NEW" }); expect(invalid.status).toBe(409); });
  it("speichert öffentliche und interne Kommentare mit Sichtbarkeit", async () => { const publicComment = await request(app).post(`/api/v1/tickets/${ticketId}/comments`).set(auth(customerToken)).send({ content: "Öffentliche Rückmeldung des Kunden", isInternal: false }); const internal = await request(app).post(`/api/v1/tickets/${ticketId}/comments`).set(auth(agentToken)).send({ content: "Interne technische Analyse", isInternal: true }); expect(publicComment.status).toBe(201); expect(internal.status).toBe(201); const customerView = await request(app).get(`/api/v1/tickets/${ticketId}`).set(auth(customerToken)); expect(customerView.body.data.comments.some((comment: { isInternal: boolean }) => comment.isInternal)).toBe(false); });
  it("bearbeitet eigene Kommentare und löscht sie weich", async () => { const created = await request(app).post(`/api/v1/tickets/${ticketId}/comments`).set(auth(customerToken)).send({ content: "Kommentar für Bearbeitung", isInternal: false }); const edited = await request(app).patch(`/api/v1/tickets/${ticketId}/comments/${created.body.data.id}`).set(auth(customerToken)).send({ content: "Bearbeiteter Kommentarinhalt" }); expect(edited.status).toBe(200); const deleted = await request(app).delete(`/api/v1/tickets/${ticketId}/comments/${created.body.data.id}`).set(auth(customerToken)); expect(deleted.status).toBe(200); expect((await prisma.comment.findUniqueOrThrow({ where: { id: created.body.data.id } })).deletedAt).toBeTruthy(); });
  it("lädt Kommentar-Anhänge und öffentliches Bild mit korrekter Sichtbarkeit hoch", async () => {
    const comment = await request(app).post(`/api/v1/tickets/${ticketId}/comments`).set(auth(agentToken)).send({ content: "Antwort mit angehängter Logdatei", isInternal: false });
    const commentUpload = await request(app).post(`/api/v1/tickets/${ticketId}/comments/${comment.body.data.id}/attachments`).set(auth(agentToken)).field("visibility", "PUBLIC").attach("files", Buffer.from("2026-08-10 INFO Test erfolgreich\n"), { filename: "diagnose.log", contentType: "text/plain" });
    expect(commentUpload.status).toBe(201);
    expect(commentUpload.body.data[0].commentId).toBe(comment.body.data.id);
    expect((await request(app).post(`/api/v1/tickets/${ticketId}/comments/${comment.body.data.id}/attachments`).set(auth(customerToken)).attach("files", Buffer.from("fremder Anhang"), { filename: "fremd.txt", contentType: "text/plain" })).status).toBe(403);

    const internalComment = await request(app).post(`/api/v1/tickets/${ticketId}/comments`).set(auth(agentToken)).send({ content: "Interne Notiz mit internem Anhang", isInternal: true });
    const internalUpload = await request(app).post(`/api/v1/tickets/${ticketId}/comments/${internalComment.body.data.id}/attachments`).set(auth(agentToken)).field("visibility", "PUBLIC").attach("files", Buffer.from("interne technische Daten\n"), { filename: "intern.log", contentType: "text/plain" });
    expect(internalUpload.status).toBe(201);
    expect(internalUpload.body.data[0].visibility).toBe("INTERNAL");
    expect((await request(app).post(`/api/v1/tickets/${ticketId}/comments/${internalComment.body.data.id}/attachments`).set(auth(customerToken)).attach("files", Buffer.from("nicht sichtbar"), { filename: "unsichtbar.txt", contentType: "text/plain" })).status).toBe(404);
    const internalAttachmentId = internalUpload.body.data[0].id;
    const customerView = await request(app).get(`/api/v1/tickets/${ticketId}`).set(auth(customerToken));
    expect(JSON.stringify(customerView.body.data)).not.toContain(internalAttachmentId);
    expect((await request(app).get(`/api/v1/attachments/${internalAttachmentId}/download`).set(auth(customerToken))).status).toBe(403);

    const image = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
    const upload = await request(app).post(`/api/v1/tickets/${ticketId}/attachments`).set(auth(customerToken)).attach("files", image, { filename: "screenshot.png", contentType: "image/png" });
    expect(upload.status).toBe(201);
    publicAttachmentId = upload.body.data[0].id;
  });
  it("akzeptiert die freigegebenen Bild-, Text- und Archivtypen", async () => {
    const response = await request(app).post(`/api/v1/tickets/${ticketId}/attachments`).set(auth(customerToken))
      .attach("files", Buffer.from("ffd8ffe000104a464946", "hex"), { filename: "foto.jpg", contentType: "image/jpeg" })
      .attach("files", Buffer.from("89504e470d0a1a0a0000000d49484452", "hex"), { filename: "bild.png", contentType: "text/plain" })
      .attach("files", Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]), { filename: "ansicht.webp", contentType: "image/webp" })
      .attach("files", Buffer.from("Textdatei\n"), { filename: "hinweis.txt", contentType: "text/plain" })
      .attach("files", Buffer.from("INFO Logdatei\n"), { filename: "system.log", contentType: "text/plain" })
      .attach("files", Buffer.from("spalte,wert\nstatus,ok\n"), { filename: "daten.csv", contentType: "text/csv" })
      .attach("files", Buffer.from('{"status":"ok"}'), { filename: "daten.json", contentType: "application/json" })
      .attach("files", await officeArchive("docx"), { filename: "archiv.zip", contentType: "application/zip" });
    expect(response.status).toBe(201);
    expect(response.body.data).toHaveLength(8);
    expect(response.body.data.find((item: { originalName: string }) => item.originalName === "bild.png").detectedMimeType).toBe("image/png");
  });
  it("weist gefährliche Endungen und manipulierte Inhalte ab", async () => {
    for (const filename of ["programm.exe", "start.bat", "befehl.cmd", "skript.js", "rechnung.pdf.exe"]) {
      const response = await request(app).post(`/api/v1/tickets/${ticketId}/attachments`).set(auth(customerToken)).attach("files", Buffer.from("MZfake"), { filename, contentType: "application/octet-stream" });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe("INVALID_FILE_TYPE");
    }
    const fakeImage = await request(app).post(`/api/v1/tickets/${ticketId}/attachments`).set(auth(customerToken)).attach("files", Buffer.from("%PDF-1.4"), { filename: "falsch.png", contentType: "image/png" });
    expect(fakeImage.status).toBe(400);
    expect(fakeImage.body.code).toBe("MIME_MISMATCH");
    for (const extension of ["docx", "xlsx"]) {
      const response = await request(app).post(`/api/v1/tickets/${ticketId}/attachments`).set(auth(customerToken)).attach("files", Buffer.from("504b030400000000", "hex"), { filename: `fake.${extension}`, contentType: "application/zip" });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe("MIME_MISMATCH");
    }
  });
  it("weist übergroße Dateien ohne Metadatensatz ab", async () => { const before = await prisma.attachment.count({ where: { ticketId } }); const response = await request(app).post(`/api/v1/tickets/${ticketId}/attachments`).set(auth(customerToken)).attach("files", Buffer.alloc(15 * 1024 * 1024 + 1, 65), { filename: "zu-gross.log", contentType: "text/plain" }); expect(response.status).toBe(400); expect(response.body.code).toBe("UPLOAD_ERROR"); expect(await prisma.attachment.count({ where: { ticketId } })).toBe(before); });
  it("rollt einen Mehrfachupload bei einem ungültigen Teil vollständig zurück", async () => { const before = await prisma.attachment.count({ where: { ticketId } }); const response = await request(app).post(`/api/v1/tickets/${ticketId}/attachments`).set(auth(customerToken)).attach("files", Buffer.from("89504e470d0a1a0a0000000d49484452", "hex"), { filename: "gueltig.png", contentType: "image/png" }).attach("files", Buffer.from("504b030400000000", "hex"), { filename: "ungueltig.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }); expect(response.status).toBe(400); expect(await prisma.attachment.count({ where: { ticketId } })).toBe(before); expect(await readdir(resolve(process.cwd(), ".test-uploads", ".tmp"))).toHaveLength(0); });
  it("akzeptiert PDF sowie echte DOC-, DOCX-, XLS- und XLSX-Strukturen", async () => { const ole = Buffer.from("d0cf11e0a1b11ae1", "hex"); const response = await request(app).post(`/api/v1/tickets/${ticketId}/attachments`).set(auth(customerToken)).attach("files", Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n"), { filename: "bericht.pdf", contentType: "application/pdf" }).attach("files", ole, { filename: "bericht.doc", contentType: "application/msword" }).attach("files", await officeArchive("docx"), { filename: "bericht.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }).attach("files", ole, { filename: "daten.xls", contentType: "application/vnd.ms-excel" }).attach("files", await officeArchive("xlsx"), { filename: "daten.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }); expect(response.status).toBe(201); expect(response.body.data).toHaveLength(5); });
  it("erlaubt autorisierten Download und isoliert andere Kunden ohne Upload-Reste", async () => { const download = await request(app).get(`/api/v1/attachments/${publicAttachmentId}/download`).set(auth(customerToken)); expect(download.status).toBe(200); expect((await request(app).get(`/api/v1/attachments/${publicAttachmentId}/download`).set(auth(otherCustomerToken))).status).toBe(404); const other = await prisma.ticket.findFirstOrThrow({ where: { customer: { email: "anna.schmidt@beispiel.local" } } }); const isolated = await request(app).get(`/api/v1/tickets/${other.id}`).set(auth(customerToken)); expect(isolated.status).toBe(404); const before = await readdir(resolve(process.cwd(), ".test-uploads")); const unauthorized = await request(app).post(`/api/v1/tickets/${other.id}/attachments`).set(auth(customerToken)).attach("files", Buffer.from("nicht speichern"), { filename: "unerlaubt.txt", contentType: "text/plain" }); expect(unauthorized.status).toBe(404); expect(await readdir(resolve(process.cwd(), ".test-uploads"))).toEqual(before); });
  it("löst ein Ticket, nimmt genau eine Kundenbewertung an und aktualisiert Berichte", async () => { const resolved = await request(app).patch(`/api/v1/tickets/${ticketId}/status`).set(auth(agentToken)).send({ status: "RESOLVED" }); expect(resolved.status).toBe(200); const rating = await request(app).post(`/api/v1/tickets/${ticketId}/rating`).set(auth(customerToken)).send({ rating: 5, feedback: "Sehr gute Unterstützung" }); expect(rating.status).toBe(200); expect((await request(app).post(`/api/v1/tickets/${ticketId}/rating`).set(auth(customerToken)).send({ rating: 4 })).status).toBe(409); const report = await request(app).get("/api/v1/reports/tickets").set(auth(adminToken)); expect(report.status).toBe(200); expect(report.body.data.ratingCount).toBeGreaterThan(0); });
  it("führt Passwort-Reset einmalig und mit Ablaufprüfung aus", async () => { const forgot = await request(app).post("/api/v1/auth/forgot-password").send({ email: uniqueEmail }); const token = forgot.body.data.developmentResetToken; expect(token).toBeTruthy(); const reset = await request(app).post("/api/v1/auth/reset-password").send({ token, password: "NeuesSicheres123!" }); expect(reset.status).toBe(200); expect((await request(app).post("/api/v1/auth/reset-password").send({ token, password: "NochNeueres123!" })).status).toBe(400); const expiredToken = `expired-token-${Date.now()}`; await prisma.passwordResetToken.create({ data: { userId: registeredUserId, tokenHash: createHash("sha256").update(expiredToken).digest("hex"), expiresAt: new Date(Date.now() - 1_000) } }); expect((await request(app).post("/api/v1/auth/reset-password").send({ token: expiredToken, password: "NochNeueres123!" })).status).toBe(400); });
  it("verwaltet Benutzerrolle, Status und Teamzugehörigkeit als Administrator", async () => { const created = await request(app).post("/api/v1/users").set(auth(adminToken)).send({ firstName: "Neuer", lastName: "Support", email: `support-${Date.now()}@example.test`, password: "Sicheres123!", role: "AGENT", teamIds: [teamId] }); expect(created.status).toBe(201); const role = await request(app).patch(`/api/v1/users/${created.body.data.id}/role`).set(auth(adminToken)).send({ role: "ADMIN" }); expect(role.status).toBe(200); const membership = await request(app).put(`/api/v1/users/${created.body.data.id}/teams`).set(auth(adminToken)).send({ teamIds: [teamId] }); expect(membership.status).toBe(200); const status = await request(app).patch(`/api/v1/users/${created.body.data.id}/status`).set(auth(adminToken)).send({ isActive: false }); expect(status.status).toBe(200); });
  it("schützt interne Verzeichnisse und Verwaltungsaktionen vor Kunden", async () => {
    expect((await request(app).get("/api/v1/teams").set(auth(customerToken))).status).toBe(403);
    expect((await request(app).get("/api/v1/dashboard/agent-workload").set(auth(customerToken))).status).toBe(403);
    expect((await request(app).get("/api/v1/users").set(auth(customerToken))).status).toBe(403);
    expect((await request(app).post("/api/v1/categories").set(auth(customerToken)).send({ name: "Nicht erlaubt" })).status).toBe(403);
    expect((await request(app).get("/api/v1/audit-logs").set(auth(agentToken))).status).toBe(403);
    expect((await request(app).get("/api/v1/reports/tickets").set(auth(agentToken))).status).toBe(403);
  });
  it("verwaltet Kategorien, Teams, Tags und SLA-Richtlinien als Administrator", async () => {
    const suffix = Date.now();
    const category = await request(app).post("/api/v1/categories").set(auth(adminToken)).send({ name: `Testkategorie ${suffix}`, description: "Temporäre Integrationskategorie", defaultPriority: "LOW" });
    expect(category.status).toBe(201);
    expect((await request(app).patch(`/api/v1/categories/${category.body.data.id}`).set(auth(adminToken)).send({ description: "Aktualisierte Integrationskategorie" })).status).toBe(200);

    const team = await request(app).post("/api/v1/teams").set(auth(adminToken)).send({ name: `Testteam ${suffix}`, description: "Temporäres Integrationsteam", memberIds: [agentId] });
    expect(team.status).toBe(201);
    expect((await request(app).put(`/api/v1/teams/${team.body.data.id}/members`).set(auth(adminToken)).send({ memberIds: [agentId] })).status).toBe(200);

    const tag = await request(app).post("/api/v1/tags").set(auth(adminToken)).send({ name: `Testtag ${suffix}`, color: "#123D34" });
    expect(tag.status).toBe(201);
    expect((await request(app).post(`/api/v1/tickets/${ticketId}/tags/${tag.body.data.id}`).set(auth(agentToken))).status).toBe(201);
    expect((await request(app).delete(`/api/v1/tickets/${ticketId}/tags/${tag.body.data.id}`).set(auth(agentToken))).status).toBe(200);

    const sla = await request(app).post("/api/v1/sla-policies").set(auth(adminToken)).send({ name: `Test-SLA ${suffix}`, description: "Inaktive Testregel", priority: "LOW", firstResponseMinutes: 60, resolutionMinutes: 240, isActive: false });
    expect(sla.status).toBe(201);
    expect((await request(app).patch(`/api/v1/sla-policies/${sla.body.data.id}`).set(auth(adminToken)).send({ description: "Aktualisierte Testregel" })).status).toBe(200);

    expect((await request(app).delete(`/api/v1/categories/${category.body.data.id}`).set(auth(adminToken))).status).toBe(200);
    expect((await request(app).delete(`/api/v1/teams/${team.body.data.id}`).set(auth(adminToken))).status).toBe(200);
    expect((await request(app).delete(`/api/v1/tags/${tag.body.data.id}`).set(auth(adminToken))).status).toBe(200);
    expect((await request(app).delete(`/api/v1/sla-policies/${sla.body.data.id}`).set(auth(adminToken))).status).toBe(200);
  });
  it("liefert Dashboards, Benachrichtigungen, Wissen, Berichte und Auditdaten", async () => {
    for (const token of [customerToken, agentToken, adminToken]) {
      const dashboard = await request(app).get("/api/v1/dashboard/summary").set(auth(token));
      expect(dashboard.status).toBe(200);
      expect(dashboard.body.data.total).toBeTypeOf("number");
    }
    const notifications = await request(app).get("/api/v1/notifications").set(auth(customerToken));
    expect(notifications.status).toBe(200);
    expect((await request(app).patch("/api/v1/notifications/read-all").set(auth(customerToken))).status).toBe(200);

    const slug = `integration-wissen-${Date.now()}`;
    const article = await request(app).post("/api/v1/knowledge-base/articles").set(auth(agentToken)).send({ title: "Wissen aus dem Integrationstest", slug, summary: "Ein veröffentlichter Testartikel.", content: "Dieser Inhalt prüft den vollständigen Wissensdatenbank-Workflow.", categoryId, status: "PUBLISHED" });
    expect(article.status).toBe(201);
    expect((await request(app).get(`/api/v1/knowledge-base/articles/${slug}`).set(auth(customerToken))).status).toBe(200);
    expect((await request(app).delete(`/api/v1/knowledge-base/articles/${article.body.data.id}`).set(auth(adminToken))).status).toBe(200);

    const report = await request(app).get("/api/v1/reports/tickets").set(auth(adminToken));
    const exportResponse = await request(app).get("/api/v1/reports/export").set(auth(adminToken));
    const audit = await request(app).get("/api/v1/audit-logs").set(auth(adminToken));
    expect(report.status).toBe(200);
    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers["content-type"]).toContain("text/csv");
    expect(audit.status).toBe(200);
    expect(audit.body.data.length).toBeGreaterThan(0);
  });
  it("schützt den letzten aktiven Administrator", async () => { const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@jam-it.local" } }); const otherAdmins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true, id: { not: admin.id } }, select: { id: true } }); if (otherAdmins.length) await prisma.user.updateMany({ where: { id: { in: otherAdmins.map((item) => item.id) } }, data: { isActive: false } }); const response = await request(app).patch(`/api/v1/users/${admin.id}/status`).set(auth(adminToken)).send({ isActive: false }); expect(response.status).toBe(409); expect(response.body.code).toBe("SELF_DEACTIVATION"); });
  it("invalidiert das JWT beim Logout", async () => { const response = await request(app).post("/api/v1/auth/logout").set(auth(customerToken)); expect(response.status).toBe(200); expect((await request(app).get("/api/v1/auth/me").set(auth(customerToken))).status).toBe(401); });

  afterAll(async () => { await prisma.$disconnect(); await rm(resolve(process.cwd(), ".test-uploads"), { recursive: true, force: true }); });
});
