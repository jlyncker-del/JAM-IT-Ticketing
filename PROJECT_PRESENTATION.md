# Projektpräsentation: JAM IT HelpDesk

## 1. Problemstellung

Supportanfragen über Telefon und einzelne E-Mails sind schwer nachvollziehbar: Informationen fehlen, Zuständigkeiten bleiben unklar, Fristen sind unsichtbar und Entscheidungen lassen sich später nicht zuverlässig belegen.

## 2. Projektziel

JAM IT HelpDesk bildet den vollständigen Prozess von der Kundenmeldung bis zur bestätigten Lösung ab. Die Anwendung ist deutsch, responsiv, sicher, präsentationsfähig und für eine Bereitstellung mit React, Express und PostgreSQL vorbereitet.

## 3. Zielgruppen

- Kunden erfassen und verfolgen eigene Supportanfragen.
- Supportmitarbeitende bearbeiten, priorisieren und dokumentieren Tickets.
- Administratoren verwalten Benutzer, Teams, Stammdaten, SLA, Wissen und Berichte.

## 4. Architektur

```text
React/Vite → HTTPS, JSON/Multipart, JWT → Express API → Prisma → PostgreSQL
                                              ├→ geschützter Dateispeicher
                                              └→ SMTP-Maildienst
```

Das Frontend verwendet TanStack Query für Serverzustand, React Hook Form/Zod für Formulare und Axios für die API. Das Backend trennt Middleware, Schemas, Routen, Services und zentrale Fehlerbehandlung.

## 5. Technologien

- React, TypeScript, Vite, React Router, TanStack Query, React Hook Form, Zod
- Node.js, Express, Prisma, PostgreSQL, JWT, bcrypt, Multer, Nodemailer
- Vitest, React Testing Library, Supertest
- Swagger UI/OpenAPI, Helmet, CORS und Rate Limiting

## 6. Datenbank

Zentrale Modelle sind `User`, `Ticket`, `TicketSequence`, `Category`, `SupportTeam`, `Comment`, `Attachment`, `TicketHistory`, `AuditLog`, `SlaPolicy`, `Notification` und `KnowledgeBaseArticle`. N:M-Beziehungen für Teams, Tags und Beobachter besitzen explizite Verknüpfungstabellen. Migrationen werden unverändert versioniert und mit `prisma migrate deploy` ausgerollt.

## 7. Benutzerrollen

`CUSTOMER` sieht ausschließlich eigene Tickets und öffentliche Inhalte. `AGENT` bearbeitet die Warteschlange, öffentliche Antworten und interne Notizen. `ADMIN` verwaltet zusätzlich Benutzer, Teams, Kategorien, Tags, SLA, Wissen, Berichte und Audit-Protokolle. Jede Berechtigung wird serverseitig geprüft.

## 8. Ticketworkflow

```text
Entwurf → Neu → Offen/Zugewiesen → In Bearbeitung
                                   ├→ Wartet auf Kunden
                                   ├→ Wartet auf Drittanbieter
                                   └→ Gelöst → Geschlossen
                                          └→ Wieder geöffnet
```

Entwürfe lassen sich speichern, öffnen, bearbeiten, löschen und einreichen. Agenten können Tickets für ausgewählte Kunden erfassen. Zuweisungen unterstützen Person und Team. Status, Priorität, Kommentare, Links, Tags und relevante Änderungen erzeugen Verlauf und Audit-Ereignisse.

## 9. Authentifizierung

Passwörter werden mit bcrypt gehasht. JWTs enthalten Benutzer-ID, Rolle und `tokenVersion`. Logout, Passwortänderung und Deaktivierung invalidieren bestehende Sitzungen. Nach fünf Fehlversuchen wird das Konto für 15 Minuten gesperrt. Reset-Tokens werden zufällig erzeugt, nur gehasht gespeichert, laufen nach 60 Minuten ab und sind einmalig.

## 10. Autorisierung

Geschützte React-Routen verbessern die Bedienung, sind aber keine Sicherheitsgrenze. Express prüft Authentifizierung, Rolle, Ticketeigentum sowie die Sichtbarkeit interner Kommentare und Anhänge erneut. Fremde Kundentickets werden absichtlich wie „nicht gefunden“ behandelt.

## 11. Uploadsystem

Zugriff wird vor Multer geprüft. Dateien landen zunächst in einem temporären Verzeichnis und werden erst nach Signatur-, Größen- und Typprüfung übernommen. Mehrfachuploads kombinieren eine Prisma-Transaktion mit Dateisystem-Rollback. DOCX/XLSX benötigen echte OOXML-Strukturen; EXE, gefährliche Doppelendungen und SVG sind gesperrt. Downloads und Vorschauen laufen ausschließlich über autorisierte Endpunkte.

## 12. SLA

Beim Erstellen wählt das Backend die aktive Richtlinie zur Priorität, speichert `slaPolicyId` und berechnet Reaktions- und Lösungsfrist. Bei Prioritätsänderung werden beide Fristen bewusst ab dem ursprünglichen Erstellungszeitpunkt neu berechnet. Dashboard und Ticketdetail verwenden dieselben gespeicherten Werte. Geschäftszeitenkalender sind als bekannte Erweiterung dokumentiert und können derzeit nicht versehentlich aktiviert werden.

## 13. Dashboard

Kunden sehen eigene Tickets, offene Vorgänge, wartende Rückfragen und Aktivitäten. Agenten sehen freie/kritische Tickets, SLA-Warnungen, Überschreitungen sowie Durchschnittszeiten. Administratoren sehen Statusbestand, SLA-Erfüllung und Kundenzufriedenheit. Alle Zahlen stammen aus PostgreSQL, nicht aus Mock-Daten.

## 14. Sicherheit

- Produktionsstart ohne Datenbank- und Token-Secrets bricht mit klarer Meldung ab.
- Helmet, feste CORS-Origin, Request-Limits und Login-Rate-Limit schützen die API.
- Passwörter, JWTs, Reset-Tokens und Dateiinhalte gelangen nicht ins Audit-Protokoll.
- HTTP/HTTPS-Links werden validiert und extern mit `noopener noreferrer` geöffnet.
- Der letzte aktive Administrator kann sich nicht selbst deaktivieren oder herabstufen.

## 15. Tests

Die 47 Tests bestehen aus 36 Backend-Unit-/Integrationstests und 11 Frontendtests. Sie prüfen unter anderem Registrierung, Login, Sperre, Rollenrechte, Isolation, Entwürfe, parallele Ticketnummern, SLA, Zuweisung, Kommentare, Upload-Rollback, Größenlimits, interne und fremde Downloads, Reset und Benutzerverwaltung. Frontendtests decken deutsche Validierung, Rollennavigation, Ticketerstellung und -details, Filter, interne Sichtbarkeit, Benutzeranlage, barrierefreie Komponenten, Bestätigungsdialog und Dateiuploader ab.

## 16. Deployment

`render.yaml` beschreibt eine Static Site, einen Node Web Service, PostgreSQL, Pre-Deploy-Migrationen und einen persistenten Upload-Datenträger. Der Produktionsbuild erzeugt `backend/dist/server.js`; `npm start` startet genau diese Datei. Secrets bleiben als Render-Variablen mit `sync: false` außerhalb des Repositories.

## 17. Herausforderungen

Die größten Herausforderungen waren konsistente Rollenrechte, die Trennung öffentlicher und interner Inhalte, Rollback zwischen Dateisystem und Datenbank, echte Office-Dateiprüfung sowie eine parallele, migrationssichere Ticketnummernvergabe.

## 18. Technische Entscheidungen

- Bestehende Monorepo-Architektur beibehalten statt Frameworkwechsel.
- Datenbankgestützte Jahreszähler statt `MAX + 1`.
- Temporärer lokaler Speicher und Storage-Interface statt öffentlichem Uploadordner.
- Einfacher Klartext/Markdown-ähnlicher Wissensinhalt statt riskantem Rich Text.
- Route-Level-Code-Splitting; größter initialer Chunk unter 500 KB.
- Keine Hover-Effekte; Fokus-, Aktiv-, Lade- und Disabled-Zustände bleiben zugänglich.

## 19. Live-Demo (10–15 Minuten)

1. Als Kunde `kunde@jam-it.local` anmelden und Kundendashboard zeigen.
2. Ticketentwurf speichern, erneut öffnen, bearbeiten und einreichen.
3. Screenshot, Log oder PDF per Drag-and-drop hinzufügen; EXE-Ablehnung kurz zeigen.
4. Als Agent `agent@jam-it.local` anmelden, Ticket suchen und sich/Team zuweisen.
5. Priorität und SLA-Frist erklären; öffentliche Antwort mit Anhang und interne Notiz anlegen.
6. Als Kunde neu anmelden: interne Notiz/Datei bleibt unsichtbar; öffentlich antworten.
7. Als Agent Ticket lösen; als Kunde 1–5 Sterne und Feedback abgeben.
8. Als Admin `admin@jam-it.local` Benutzeranlage, Teams, Kategorien und Wissensartikel zeigen.
9. Dashboard, gefilterten CSV-Bericht, Audit-Protokoll und `/api-docs` öffnen.
10. Abschließend `/health`, Render-Architektur und bestandene Tests nennen.

## 20. Zukünftige Verbesserungen

- S3-/R2-Storage und Malware-Scanner mit Quarantäne
- Geschäftszeiten- und Feiertagskalender
- Refresh-Token-Rotation in HttpOnly-Cookies und MFA
- Server-Sent Events oder WebSockets für Push-Benachrichtigungen
- Playwright-E2E-Tests, CI/CD sowie XLSX-/PDF-Berichte
