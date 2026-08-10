import type { Express } from "express";
import swaggerUi from "swagger-ui-express";

const jsonBody = (schema: object) => ({ required: true, content: { "application/json": { schema } } });
const idParameter = (name: string) => ({ in: "path", name, required: true, schema: { type: "string" } });
const errors = {
  "400": { description: "Validierungsfehler", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
  "401": { description: "Nicht authentifiziert", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
  "403": { description: "Rolle oder Berechtigung fehlt", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
  "404": { description: "Ressource nicht gefunden", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
};
const secured = (tags: string[], summary: string, success = "Aktion erfolgreich", role?: string) => ({ tags, summary, ...(role ? { description: `Erforderliche Rolle: ${role}` } : {}), security: [{ bearerAuth: [] }], responses: { "200": { description: success }, ...errors } });

const openapi = {
  openapi: "3.0.3",
  info: { title: "JAM IT HelpDesk API", version: "1.0.0", description: "REST-API für das Support- und Ticketmanagement von JAM IT Dienstleistungen. Sämtliche geschützten Routen verwenden JWT Bearer Authentication." },
  servers: [{ url: "/api/v1", description: "API Version 1" }],
  tags: ["Authentifizierung", "Benutzer", "Tickets", "Ticketaktionen", "Kommentare", "Anhänge", "Links", "Kategorien", "Teams", "Tags", "SLA", "Dashboard", "Benachrichtigungen", "Wissensdatenbank", "Audit-Protokoll", "Berichte"].map((name) => ({ name })),
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    schemas: {
      ApiError: { type: "object", required: ["success", "message", "code"], properties: { success: { type: "boolean", example: false }, message: { type: "string", example: "Die eingegebenen Daten sind ungültig." }, code: { type: "string", example: "VALIDATION_ERROR" } } },
      Login: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string", format: "password" } } },
      Registration: { type: "object", required: ["firstName", "lastName", "email", "password"], properties: { firstName: { type: "string" }, lastName: { type: "string" }, email: { type: "string", format: "email" }, password: { type: "string", format: "password", minLength: 10 }, company: { type: "string" } } },
      TicketCreate: { type: "object", required: ["subject", "description", "categoryId", "sensitiveDataConfirmed"], properties: { subject: { type: "string", maxLength: 150 }, description: { type: "string", maxLength: 20000 }, categoryId: { type: "string" }, customerId: { type: "string", description: "Für AGENT/ADMIN erforderlich; CUSTOMER wird serverseitig erzwungen." }, priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] }, isDraft: { type: "boolean" }, sensitiveDataConfirmed: { type: "boolean" } } },
      Comment: { type: "object", required: ["content"], properties: { content: { type: "string", maxLength: 10000 }, isInternal: { type: "boolean", description: "Nur AGENT/ADMIN" } } },
      Assignment: { type: "object", properties: { assignedAgentId: { type: "string", nullable: true }, assignedTeamId: { type: "string", nullable: true } } },
      Link: { type: "object", required: ["url"], properties: { url: { type: "string", format: "uri", description: "Nur HTTP/HTTPS" }, title: { type: "string" }, description: { type: "string" } } },
    },
  },
  paths: {
    "/auth/register": { post: { tags: ["Authentifizierung"], summary: "Kundenkonto registrieren", requestBody: jsonBody({ $ref: "#/components/schemas/Registration" }), responses: { "201": { description: "Konto erstellt" }, ...errors } } },
    "/auth/login": { post: { tags: ["Authentifizierung"], summary: "Anmelden", requestBody: jsonBody({ $ref: "#/components/schemas/Login" }), responses: { "200": { description: "JWT und Benutzerprofil" }, ...errors } } },
    "/auth/logout": { post: secured(["Authentifizierung"], "Abmelden und Tokenversion invalidieren") },
    "/auth/me": { get: secured(["Authentifizierung"], "Aktuellen Benutzer abrufen") },
    "/auth/profile": { patch: { ...secured(["Authentifizierung"], "Eigenes Profil aktualisieren"), requestBody: jsonBody({ type: "object" }) } },
    "/auth/change-password": { post: { ...secured(["Authentifizierung"], "Eigenes Passwort ändern"), requestBody: jsonBody({ type: "object", required: ["currentPassword", "newPassword"] }) } },
    "/auth/forgot-password": { post: { tags: ["Authentifizierung"], summary: "Passwort-Reset anfordern", requestBody: jsonBody({ type: "object", required: ["email"] }), responses: { "200": { description: "Generische Bestätigung" }, ...errors } } },
    "/auth/reset-password": { post: { tags: ["Authentifizierung"], summary: "Passwort mit Token zurücksetzen", requestBody: jsonBody({ type: "object", required: ["token", "password"] }), responses: { "200": { description: "Passwort geändert" }, ...errors } } },
    "/users": { get: secured(["Benutzer"], "Benutzer suchen", "Benutzerliste", "ADMIN"), post: { ...secured(["Benutzer"], "Benutzer anlegen", "Benutzer erstellt", "ADMIN"), requestBody: jsonBody({ allOf: [{ $ref: "#/components/schemas/Registration" }] }) } },
    "/users/{id}": { patch: { ...secured(["Benutzer"], "Benutzerdaten ändern", "Benutzer aktualisiert", "ADMIN"), parameters: [idParameter("id")], requestBody: jsonBody({ type: "object" }) } },
    "/users/{id}/status": { patch: { ...secured(["Benutzer"], "Benutzer aktivieren/deaktivieren", "Status geändert", "ADMIN"), parameters: [idParameter("id")], requestBody: jsonBody({ type: "object", required: ["isActive"] }) } },
    "/users/{id}/role": { patch: { ...secured(["Benutzer"], "Rolle ändern", "Rolle geändert", "ADMIN"), parameters: [idParameter("id")], requestBody: jsonBody({ type: "object", required: ["role"] }) } },
    "/tickets": { get: { ...secured(["Tickets"], "Tickets kombinierbar suchen, filtern, sortieren und paginieren"), parameters: ["page", "limit", "search", "status", "priority", "categoryId", "assignedAgentId", "assignedTeamId", "source", "sla", "unassigned", "withAttachments", "sortBy", "sortOrder"].map((name) => ({ in: "query", name, schema: { type: "string" } })) }, post: { ...secured(["Tickets"], "Ticket oder Entwurf erstellen", "Ticket erstellt"), requestBody: jsonBody({ $ref: "#/components/schemas/TicketCreate" }) } },
    "/tickets/{id}": { get: { ...secured(["Tickets"], "Ticketdetails mit rollenbasierter Sichtbarkeit abrufen"), parameters: [idParameter("id")] }, patch: { ...secured(["Tickets"], "Ticket beziehungsweise Entwurf bearbeiten"), parameters: [idParameter("id")], requestBody: jsonBody({ type: "object" }) }, delete: { ...secured(["Tickets"], "Entwurf löschen"), parameters: [idParameter("id")] } },
    "/tickets/{id}/submit": { post: { ...secured(["Ticketaktionen"], "Entwurf einreichen"), parameters: [idParameter("id")] } },
    "/tickets/{id}/status": { patch: { ...secured(["Ticketaktionen"], "Status mit Übergangsprüfung ändern"), parameters: [idParameter("id")], requestBody: jsonBody({ type: "object", required: ["status"] }) } },
    "/tickets/{id}/priority": { patch: { ...secured(["Ticketaktionen"], "Priorität und SLA ändern", "Priorität geändert", "AGENT/ADMIN"), parameters: [idParameter("id")], requestBody: jsonBody({ type: "object", required: ["priority"] }) } },
    "/tickets/{id}/assign": { patch: { ...secured(["Ticketaktionen"], "Bearbeiter und Team zuweisen", "Zuweisung geändert", "AGENT/ADMIN"), parameters: [idParameter("id")], requestBody: jsonBody({ $ref: "#/components/schemas/Assignment" }) } },
    "/tickets/{ticketId}/comments": { get: { ...secured(["Kommentare"], "Sichtbare Kommentare abrufen"), parameters: [idParameter("ticketId")] }, post: { ...secured(["Kommentare"], "Öffentlichen Kommentar oder interne Notiz erstellen", "Kommentar erstellt"), parameters: [idParameter("ticketId")], requestBody: jsonBody({ $ref: "#/components/schemas/Comment" }) } },
    "/tickets/{ticketId}/comments/{commentId}": { patch: { ...secured(["Kommentare"], "Eigenen Kommentar bearbeiten"), parameters: [idParameter("ticketId"), idParameter("commentId")], requestBody: jsonBody({ $ref: "#/components/schemas/Comment" }) }, delete: { ...secured(["Kommentare"], "Kommentar revisionssicher löschen"), parameters: [idParameter("ticketId"), idParameter("commentId")] } },
    "/tickets/{ticketId}/attachments": { post: { ...secured(["Anhänge"], "Dateien sicher hochladen", "Anhänge erstellt"), parameters: [idParameter("ticketId")], requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object", required: ["files"], properties: { files: { type: "array", items: { type: "string", format: "binary" }, maxItems: 10 }, visibility: { type: "string", enum: ["PUBLIC", "INTERNAL"] } } } } } } } },
    "/tickets/{ticketId}/comments/{commentId}/attachments": { post: { ...secured(["Anhänge", "Kommentare"], "Dateien an Kommentar anhängen", "Anhänge erstellt"), parameters: [idParameter("ticketId"), idParameter("commentId")], requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object", properties: { files: { type: "array", items: { type: "string", format: "binary" } }, visibility: { type: "string", enum: ["PUBLIC", "INTERNAL"] } } } } } } } },
    "/attachments/{id}/download": { get: { ...secured(["Anhänge"], "Anhang autorisiert herunterladen"), parameters: [idParameter("id")] } },
    "/tickets/{ticketId}/links": { post: { ...secured(["Links"], "HTTP/HTTPS-Link hinzufügen", "Link erstellt"), parameters: [idParameter("ticketId")], requestBody: jsonBody({ $ref: "#/components/schemas/Link" }) } },
    "/categories": { get: secured(["Kategorien"], "Kategorien abrufen"), post: { ...secured(["Kategorien"], "Kategorie anlegen", "Kategorie erstellt", "ADMIN"), requestBody: jsonBody({ type: "object" }) } },
    "/teams": { get: secured(["Teams"], "Teams und Mitglieder abrufen"), post: { ...secured(["Teams"], "Team anlegen", "Team erstellt", "ADMIN"), requestBody: jsonBody({ type: "object" }) } },
    "/tags": { get: secured(["Tags"], "Tags abrufen"), post: { ...secured(["Tags"], "Tag anlegen", "Tag erstellt", "ADMIN"), requestBody: jsonBody({ type: "object" }) } },
    "/sla-policies": { get: secured(["SLA"], "SLA-Richtlinien abrufen"), post: { ...secured(["SLA"], "SLA-Richtlinie anlegen", "SLA erstellt", "ADMIN"), requestBody: jsonBody({ type: "object" }) } },
    "/dashboard/summary": { get: secured(["Dashboard"], "Rollenspezifische Dashboard-Kennzahlen") },
    "/notifications": { get: secured(["Benachrichtigungen"], "Eigene Benachrichtigungen abrufen") },
    "/notifications/{id}/read": { patch: { ...secured(["Benachrichtigungen"], "Benachrichtigung als gelesen markieren"), parameters: [idParameter("id")] } },
    "/knowledge-base/articles": { get: secured(["Wissensdatenbank"], "Artikel suchen und nach Kategorie filtern"), post: { ...secured(["Wissensdatenbank"], "Artikel oder Entwurf anlegen", "Artikel erstellt", "AGENT/ADMIN"), requestBody: jsonBody({ type: "object" }) } },
    "/audit-logs": { get: secured(["Audit-Protokoll"], "Audit-Protokoll paginiert abrufen", "Protokoll", "ADMIN") },
    "/reports/tickets": { get: secured(["Berichte"], "Gefilterte Servicekennzahlen abrufen", "Bericht", "ADMIN") },
    "/reports/export": { get: secured(["Berichte"], "Gefilterten deutschen CSV-Bericht exportieren", "CSV-Datei", "ADMIN") },
  },
};

export function mountSwagger(app: Express): void {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: "JAM IT HelpDesk – API-Dokumentation" }));
  app.get("/api-docs.json", (_request, response) => response.json(openapi));
}
