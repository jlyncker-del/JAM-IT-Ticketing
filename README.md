# JAM IT HelpDesk

JAM IT HelpDesk ist ein webbasiertes Ticketsystem für IT-Support-Anfragen von JAM IT Dienstleistungen. Kunden erstellen Tickets mit Links und Anhängen. Supportmitarbeitende bearbeiten, priorisieren und dokumentieren die Vorgänge. Administratoren verwalten Benutzer, Teams und Stammdaten.


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

## Projektstruktur


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


## Installation

Voraussetzungen: Node.js 22 LTS, npm 10.9+ und PostgreSQL 16+.

```bash
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

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
DATABASE_URL=postgresql://postgres:password@localhost:5432/jam_it_helpdesk_test npm run test -w backend
```

## Demo-Benutzer

| Rolle | Name | E-Mail | Passwort |
|---|---|---|---|
| Administrator | Jamal Lyncker | `admin@jam-it.local` | `Admin123!` |
| Kunde | Max Mustermann | `kunde@jam-it.local` | `Kunde123!` |

## Deployment auf Render

`render.yaml` definiert PostgreSQL, das Backend als Web Service und das Frontend als Static Site. Die Build- und Startbefehle laufen jeweils in `backend/` beziehungsweise `frontend/`. Beim Start des Backends werden die Prisma-Migrationen ausgeführt; der Initial-Deploy-Hook legt die Demo-Daten genau einmal an.

Beim ersten Blueprint-Deploy fragt Render nach zwei Werten:

- `FRONTEND_URL` am Backend: die öffentliche Adresse der Static Site, aktuell `https://jam-it-ticketing-1.onrender.com` (ein abschließender Slash wird automatisch normalisiert)
- `VITE_API_URL` am Frontend: die öffentliche Adresse des Backend-Service, aktuell `https://jam-it-ticketing.onrender.com` (`/api/v1` wird automatisch ergänzt)

`JWT_SECRET` und `REFRESH_TOKEN_SECRET` erzeugt der Blueprint automatisch. Ein Produktionsbuild ohne `VITE_API_URL` schlägt absichtlich fehl, statt eine nicht funktionierende App mit `localhost` als API auszuliefern. SMTP ist optional; für den E-Mail-Versand müssen `MAIL_PROVIDER=smtp`, `SMTP_HOST`, `SMTP_USER` und `SMTP_PASSWORD` konfiguriert werden.