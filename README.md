# JAM IT HelpDesk

**JAM IT HelpDesk – Support- und Ticketmanagement** ist eine vollständige Full-Stack-Anwendung für **JAM IT Dienstleistungen**. Kunden erfassen Supportfälle inklusive Links und Anhängen, Supportmitarbeitende bearbeiten und dokumentieren sie, Administratoren verwalten Stammdaten, Benutzer, SLA-Richtlinien, Berichte und Audit-Protokolle.

Die Oberfläche ist vollständig deutsch (`de-DE`), LTR, responsiv und barrierearm. Das Corporate Design verwendet zentral die Farben Grün `#123D34`, Creme `#F8F4E9` und Gold `#D4A74E`. Bewusst wurden keine visuellen Hover-Effekte verwendet.

## Hauptfunktionen

- Registrierung, Anmeldung, Abmeldung und zeitlich begrenzter Passwort-Reset
- Rollen `CUSTOMER`, `AGENT` und `ADMIN` mit serverseitiger Rechteprüfung
- strikte Ticketisolation: Kunden können ausschließlich eigene Tickets abrufen
- Ticketnummern im Format `JAM-2026-000123`, Entwürfe, Kategorien, Teams, Tags und Prioritäten
- validierter Statusworkflow mit vollständiger Ticket-Historie
- Zuweisung, Selbstzuweisung, Beobachter, Wiederöffnung, Lösung, Abschluss und Verknüpfung von Duplikaten
- öffentliche Kommentare und strikt ausgeblendete interne Notizen
- sichere Anhänge mit Erweiterungs-, Doppelendungs-, MIME-/Signatur-, Größen- und Anzahlprüfung
- autorisierte Downloads, Bildvorschau und begrenzte, escaped Logvorschau
- mehrere validierte HTTP-/HTTPS-Links pro Ticket
- SLA-Ziele, Warnstatus, rollenbasierte Live-Dashboarddaten und Recharts-Diagramme
- In-App-Benachrichtigungen, Wissensdatenbank, Benutzer- und Stammdatenverwaltung
- Audit-Protokoll und CSV-Berichte ohne Sicherheitsmetadaten
- OpenAPI-Dokumentation mit JWT-Schema unter `/api-docs`
- realistische deutsche Seed-Daten mit 25 Tickets

## Rollen

| Rolle | Wesentliche Berechtigungen |
|---|---|
| Kunde | eigenes Konto, eigene Tickets, öffentliche Kommunikation, Anhänge, Lösung bestätigen oder Ticket wieder öffnen |
| Supportmitarbeiter | Ticketwarteschlange, Zuweisung, Priorität und Status, öffentliche Antworten, interne Notizen, SLA-Ansicht |
| Administrator | alle Supportfunktionen sowie Benutzer, Teams, Kategorien, Tags, SLA, Berichte und Audit-Protokoll |

Jede Berechtigung wird im Backend erneut geprüft. Das Ausblenden einer Frontend-Route ist keine Sicherheitsgrenze.

## Technologie

- Frontend: React, TypeScript, Vite, React Router, Axios, TanStack Query, React Hook Form, Zod, Tailwind CSS, Recharts, Lucide React und date-fns/de
- Backend: Node.js, Express, TypeScript, PostgreSQL, Prisma ORM, JWT, bcrypt, Zod, Multer, Nodemailer, Helmet, CORS und Rate Limiting
- Tests: Vitest, React Testing Library und Supertest

## Architektur

```text
Browser (React)
    │ HTTPS / JSON / Multipart + JWT
    ▼
Express API (/api/v1)
    ├── Authentifizierung und rollenbasierte Middleware
    ├── Zod-Validierung und zentrale Fehlerbehandlung
    ├── Ticket- und Workflow-Services
    ├── Storage-/E-Mail-Abstraktionen
    └── Audit-Protokoll
             │
             ▼
        Prisma ORM
             │
             ▼
        PostgreSQL
```

Dateien werden in der Entwicklung lokal abgelegt, aber ausschließlich über autorisierte API-Endpunkte ausgeliefert. `StorageService` entkoppelt die Ticketlogik von lokalem Speicher und kann durch S3, R2, MinIO oder Azure Blob Storage ersetzt werden.

## Ordnerstruktur

```text
jam-it-helpdesk/
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/
│   │   ├── config/ constants/ errors/ middleware/
│   │   ├── routes/ schemas/ services/ types/ utils/
│   │   ├── app.ts
│   │   └── server.ts
│   ├── tests/
│   └── uploads/
├── frontend/
│   ├── src/
│   │   ├── api/ components/ config/ constants/ contexts/
│   │   ├── layouts/ pages/ routes/ test/ types/ utils/
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── public/
├── PROJECT_PRESENTATION.md
└── README.md
```

## Voraussetzungen

- Node.js 22 oder neuer
- npm 11 oder neuer
- PostgreSQL 16 oder neuer

## Installation

```bash
cd jam-it-helpdesk
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

In Produktion müssen mindestens `DATABASE_URL`, `JWT_SECRET` und `REFRESH_TOKEN_SECRET` gesetzt sein. Beide Secrets müssen unterschiedlich, zufällig und mindestens 32 Zeichen lang sein. Für den produktiven Passwort-Reset ist außerdem `MAIL_PROVIDER=smtp` mit vollständiger SMTP-Konfiguration erforderlich. Reale Geheimnisse dürfen nicht eingecheckt werden.

## PostgreSQL einrichten

Beispiel mit vorhandenem PostgreSQL-Benutzer:

```sql
CREATE DATABASE jam_it_helpdesk;
```

Anschließend in `backend/.env`:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/jam_it_helpdesk
JWT_SECRET=hier-einen-langen-zufaelligen-produktionsschluessel-eintragen
REFRESH_TOKEN_SECRET=hier-einen-anderen-langen-zufaelligen-schluessel-eintragen
FRONTEND_URL=http://localhost:5173
```

Migration und Seed:

```bash
npx prisma migrate deploy --config backend/prisma.config.ts
npm run db:seed -w backend
```

## Entwicklung starten

Beide Anwendungen gemeinsam:

```bash
npm run dev
```

Oder getrennt:

```bash
npm run dev -w backend
npm run dev -w frontend
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`
- Swagger: `http://localhost:5000/api-docs`
- Healthcheck: `http://localhost:5000/health`

## Demo-Zugänge

Die folgenden Zugangsdaten sind ausschließlich für Entwicklung und Präsentation bestimmt:

| Rolle | E-Mail | Passwort |
|---|---|---|
| Administrator | `admin@jam-it.local` | `Admin123!` |
| Supportmitarbeiter | `agent@jam-it.local` | `Agent123!` |
| Kunde | `kunde@jam-it.local` | `Kunde123!` |

Vor einem produktiven Einsatz müssen alle Demo-Konten entfernt oder mit neuen Passwörtern versehen werden.

## Tests und Builds

Die verifizierte Suite umfasst aktuell 47 Tests: 36 Backend-Unit-/Integrationstests und 11 Frontendtests.

```bash
npm test
```

Die Backend-Integrationstests werden nur mit einer isolierten, migrierten und geseedeten Testdatenbank ausgeführt:

```bash
TEST_DATABASE_URL=postgresql://postgres:password@localhost:5432/jam_it_helpdesk_test npm run test -w backend
```

Typprüfung und Produktionsbuild:

```bash
npm run typecheck
npm run build
```

## API-Überblick

Alle fachlichen Endpunkte liegen unter `/api/v1`:

- `/auth`: Registrierung, Login, Logout, aktueller Benutzer und Passwort-Reset
- `/tickets`: Liste, Suche, Filter, Pagination, Details, Erstellung und Workflowaktionen
- `/tickets/:id/comments`, `/tickets/:id/links`, `/tickets/:id/attachments`
- `/attachments/:id/download` und `/attachments/:id/preview`
- `/users`, `/teams`, `/categories`, `/tags`, `/sla-policies`
- `/dashboard`, `/notifications`, `/knowledge-base/articles`
- `/reports` und `/audit-logs`

Erfolgreiche Antworten verwenden `{ success, message?, data }`; Fehler verwenden `{ success: false, message, code, errors? }`.

## Anhänge und Sicherheit

- Einzeldatei: maximal 15 MB
- Dateien pro Anfrage: maximal 10
- Gesamtgröße pro Anfrage: maximal 50 MB
- erlaubt: JPG, JPEG, PNG, WEBP, GIF, LOG, TXT, CSV, JSON, XML, PDF, DOC, DOCX, XLS, XLSX und ZIP
- ausdrücklich gesperrt: EXE, BAT, CMD, COM, SCR, PS1, SH, PHP, JS, JAR, MSI, DLL und VBS
- DOCX und XLSX müssen neben der ZIP-Signatur die erwarteten internen OOXML-Einträge enthalten
- allgemeine ZIP-Archive werden anhand Signatur, Dateigröße und Request-Limits geprüft; eine rekursive Archiv- und Malwareprüfung ist eine spätere Ausbaustufe
- Dateinamen erhalten UUID-Speicherschlüssel; Originalnamen werden nur als Metadaten geführt
- Pfadnavigation und gefährliche Doppelendungen werden abgewiesen
- der Server prüft Dateisignaturen und verlässt sich nicht nur auf Browser-MIME-Typen
- Dateien liegen nicht in einem öffentlich erreichbaren statischen Verzeichnis
- Vorschauen sind auf Bilder und maximal 500 Zeilen beziehungsweise 100 KB Text begrenzt
- interne Dateien und Notizen werden vor der API-Ausgabe für Kunden herausgefiltert

## Sicherheitskonzept

- bcrypt mit Kostenfaktor 12 und Passwortregeln ab 10 Zeichen
- kurzlebige, signierte JWT-Zugriffstokens mit `tokenVersion` zur Sitzungsinvalidierung
- generische Loginfehler, Sperre nach fünf Fehlversuchen und separates Login-Rate-Limit
- Helmet, strikte CORS-Origin, begrenzte JSON- und Multipart-Größen
- serverseitige Eigentümer- und Rollenprüfung für jede geschützte Ressource
- Prisma-Parametrisierung gegen SQL-Injection und sichere Textdarstellung gegen XSS
- Reset-Tokens werden nur gehasht gespeichert, laufen nach einer Stunde ab und sind einmalig
- unveränderliches Audit-Protokoll ohne Passwörter, JWTs, Reset-Tokens oder Dateiinhalte
- Session-Token wird im Frontend nur im `sessionStorage` gehalten und beim Schließen des Tabs verworfen

## Screenshots

Für die Abschlusspräsentation empfiehlt sich je ein Screenshot von Anmeldung, Kundendashboard, Ticketerstellung, Ticketverlauf, Agent-Dashboard, Benutzerverwaltung und Audit-Protokoll.

## Render-Deployment

Das Repository enthält eine geprüfte Blueprint-Datei `render.yaml` für:

- `frontend`: Render Static Site, Build `npm ci && npm run build`, Publish `dist`
- `backend`: Render Web Service, Build `npm ci && npx prisma generate && npm run build`, Pre-Deploy `npx prisma migrate deploy`, Start `npm start`
- PostgreSQL: Render Postgres über `DATABASE_URL`

Das Backend verwendet auf Render standardmäßig einen persistenten Datenträger unter `/var/data/uploads`. Render Persistent Disks sind tarifabhängig und binden den Web Service an eine Instanz. Für horizontale Skalierung sollte später ein S3-kompatibler Adapter ergänzt werden. Die gewöhnliche ephemere Service-Dateistruktur darf nicht für dauerhafte Uploads verwendet werden.

Erforderliche Backend-Variablen: `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `JWT_EXPIRES_IN`, `FRONTEND_URL`, `UPLOAD_STORAGE`, `UPLOAD_DIR`, `MAX_FILE_SIZE`, `MAX_FILES_PER_REQUEST`, `MAX_TOTAL_UPLOAD_SIZE`, `MAIL_PROVIDER`, `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `APP_NAME`, `COMPANY_NAME`.

Erforderliche Frontend-Variablen: `VITE_API_URL`, `VITE_APP_NAME`, `VITE_COMPANY_NAME`. `VITE_API_URL` muss auf die öffentliche Backend-Adresse mit `/api/v1` zeigen; `FRONTEND_URL` muss exakt die öffentliche Static-Site-Origin enthalten.

## Bekannte Grenzen

- Die erste Version verwendet vereinfachte kalendarische SLA-Minuten; Feiertage und vollständige Geschäftszeitkalender sind noch nicht enthalten.
- Lokaler Dateispeicher ist für Entwicklung und einen einzelnen Render-Service mit Persistent Disk geeignet. Ein S3-kompatibler Adapter und ein Malware-Scanner sind noch nicht implementiert.
- Ticketnummern werden über die transaktionssichere PostgreSQL-Tabelle `TicketSequence` reserviert; Lücken nach abgebrochenen Transaktionen sind möglich und fachlich zulässig.
- Ticket-Zusammenführung markiert und verknüpft das Quellticket unveränderlich. Ein konsolidierter Timeline-Viewer über beide Tickets ist eine sinnvolle Erweiterung.
- Für größere Installationen sollten Refresh-Tokens in sicheren HttpOnly-Cookies, MFA, Virenscanner und zentralisiertes Logging ergänzt werden.
- Benachrichtigungen werden beim Seitenaufruf beziehungsweise im 30-Sekunden-Intervall aktualisiert; echte Push-Aktualisierung per SSE oder WebSocket ist nicht enthalten.

## Sinnvolle Weiterentwicklungen

- S3-kompatibler Speicher und ClamAV-Scan-Worker
- Geschäftszeiten- und Feiertagskalender je Kunde
- sichere Refresh-Token-Rotation und optionale Mehrfaktor-Authentifizierung
- WebSocket- oder Server-Sent-Event-Benachrichtigungen
- XLSX- und PDF-Berichte, Mandantenfähigkeit und konfigurierbare Ticketvorlagen
- End-to-End-Tests mit Playwright und automatisierte CI/CD-Pipeline

Weitere Hinweise für die Projektvorstellung stehen in [PROJECT_PRESENTATION.md](./PROJECT_PRESENTATION.md).
