# JAM IT HelpDesk

JAM IT HelpDesk ist ein webbasiertes Ticketsystem für IT-Support-Anfragen von JAM IT Dienstleistungen. Kunden erstellen Tickets mit Links und Anhängen. Supportmitarbeitende bearbeiten, priorisieren und dokumentieren die Vorgänge. Administratoren verwalten Benutzer, Teams und Stammdaten.

Die Oberfläche ist deutsch, responsiv und verwendet die JAM-IT-Farben Grün `#123D34`, Creme `#F8F4E9` und Gold `#D4A74E`. Visuelle Hover-Effekte werden bewusst nicht eingesetzt.

## Funktionen

- Registrierung, Login, Logout, Profil und Passwort-Reset
- Rollen `CUSTOMER`, `AGENT` und `ADMIN` mit serverseitiger Rechteprüfung
- Tickets, Entwürfe, Zuweisungen, Status, Prioritäten, SLA und Verlauf
- öffentliche Kommentare, interne Notizen, Links und Tags
- validierte Uploads und autorisierte Downloads
- Suche, Filter, Sortierung und Pagination
- Dashboard, Benachrichtigungen und Wissensdatenbank
- Benutzer-, Team-, Kategorie-, Tag- und SLA-Verwaltung
- Berichte, CSV-Export und Audit-Protokoll
- OpenAPI-Dokumentation mit Swagger UI

## Technologien

- Frontend: React, TypeScript, Vite, React Router, TanStack Query und Tailwind CSS
- Backend: Node.js, Express, TypeScript, Prisma, PostgreSQL und JWT
- Tests: Vitest, React Testing Library und Supertest

## Projektstruktur

```text
jam-it-helpdesk/
├── backend/
│   ├── prisma/        # Schema, Migrationen und Seed
│   ├── src/           # Express-API
│   └── tests/
├── frontend/
│   └── src/           # React-Anwendung
├── render.yaml
├── package.json
└── README.md
```

## Installation

Voraussetzungen: Node.js 22.13+, npm 11+ und PostgreSQL 16+.

```bash
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

## Umgebungsvariablen

Die vollständigen Vorlagen stehen in `backend/.env.example` und `frontend/.env.example`.

Wesentliche Backend-Variablen:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/jam_it_helpdesk
JWT_SECRET=replace_with_a_long_random_secret
REFRESH_TOKEN_SECRET=replace_with_another_long_random_secret
FRONTEND_URL=http://localhost:5173
UPLOAD_STORAGE=local
```

Das Frontend verwendet `VITE_API_URL`, lokal beispielsweise `http://localhost:5000/api/v1`. Echte Zugangsdaten gehören ausschließlich in lokale oder bei Render hinterlegte Umgebungsvariablen.

## Datenbank

```bash
npx prisma validate --config backend/prisma.config.ts
npx prisma generate --config backend/prisma.config.ts
npx prisma migrate deploy --config backend/prisma.config.ts
npm run db:seed -w backend
```

Der Seed legt vier Demo-Benutzer, drei Teams, zehn Kategorien, fünf Tickets und drei Wissensartikel an.

## Projekt starten

Frontend und Backend gemeinsam:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:5000/api/v1`
- Healthcheck: `http://localhost:5000/health`

Produktionsbuild und Backendstart:

```bash
npm run build
npm start -w backend
```

## Tests

```bash
npm run typecheck
npm run build
npm test
```

Die API-Integrationstests benötigen eine separate, migrierte und geseedete Testdatenbank:

```bash
TEST_DATABASE_URL=postgresql://postgres:password@localhost:5432/jam_it_helpdesk_test npm run test -w backend
```

## Demo-Benutzer

| Rolle | Name | E-Mail | Passwort |
|---|---|---|---|
| Administrator | Jamal Lyncker | `admin@jam-it.local` | `Admin123!` |
| Support | Laura Becker | `agent@jam-it.local` | `Agent123!` |
| Kunde | Max Mustermann | `kunde@jam-it.local` | `Kunde123!` |
| Kunde | Anna Schmidt | `anna.schmidt@beispiel.local` | `Kunde123!` |

Die Demo-Passwörter müssen vor einem produktiven Einsatz ersetzt werden.

## API / Swagger

Swagger UI ist unter `http://localhost:5000/api-docs` verfügbar. Alle fachlichen Endpunkte liegen unter `/api/v1`; geschützte Aufrufe verwenden ein Bearer-Token.

## Deployment auf Render

`render.yaml` definiert PostgreSQL, das Backend als Web Service und das Frontend als Static Site. Die Build- und Startbefehle laufen jeweils in `backend/` beziehungsweise `frontend/`. Vor jedem Backend-Deploy werden die Prisma-Migrationen mit `prisma migrate deploy` ausgeführt.

In Render müssen insbesondere `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `FRONTEND_URL`, `VITE_API_URL` und die SMTP-Werte gesetzt werden. `VITE_API_URL` muss die öffentliche API-Adresse inklusive `/api/v1` enthalten.

Für Uploads ist im Blueprint ein persistenter Datenträger unter `/var/data` vorgesehen. Ohne Persistent Disk ist das lokale Dateisystem eines Render Web Service nicht dauerhaft. Der aktuelle lokale Speicher eignet sich für eine einzelne Backend-Instanz; horizontale Skalierung benötigt später einen S3-kompatiblen Speicher.

## Hinweise

- Erlaubte Uploadtypen und Größen werden im Frontend und erneut im Backend geprüft.
- Interne Kommentare und Anhänge sind für Kunden nicht sichtbar.
- Die SLA-Berechnung verwendet derzeit Kalenderzeit ohne Feiertags- oder Geschäftszeitenkalender.
- Der Seed ist für Entwicklung und Präsentation gedacht, nicht für produktive Daten.
