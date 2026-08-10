import bcrypt from "bcryptjs";
import { PrismaClient, TicketPriority, TicketStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const prisma = new PrismaClient();

const categoryNames = [
  ["Hardware", "DesktopComputer"], ["Software", "AppWindow"], ["Netzwerk und Internet", "Network"], ["E-Mail und Kommunikation", "Mail"],
  ["Drucker und Scanner", "Printer"], ["Benutzerkonten und Zugänge", "KeyRound"], ["IT-Sicherheit", "ShieldCheck"], ["Telefonie", "Phone"],
  ["Cloud-Dienste", "Cloud"], ["Sonstige Anfrage", "CircleHelp"],
] as const;

const subjects = [
  "Notebook startet nach Update nicht", "VPN-Verbindung bricht regelmäßig ab", "Passwort für Microsoft 365 zurücksetzen", "Drucker im zweiten Stock nicht erreichbar", "Outlook synchronisiert neue E-Mails nicht",
  "Verdächtige E-Mail mit Anhang erhalten", "Neue Mitarbeiterin benötigt Zugänge", "WLAN im Besprechungsraum instabil", "Excel-Datei lässt sich nicht öffnen", "Telefonanlage zeigt keine Rufnummern",
  "Bildschirm flackert über Dockingstation", "Berechtigung für Projektordner fehlt", "Teams-Kamera wird nicht erkannt", "Backup-Status für Server prüfen", "Webanwendung meldet Zertifikatsfehler",
  "Scanner legt Dateien nicht im Netzlaufwerk ab", "OneDrive-Synchronisierung pausiert", "Arbeitsplatz für neuen Kollegen vorbereiten", "Antivirensoftware meldet Fund", "Langsame Anmeldung am Terminalserver",
  "E-Mail-Verteiler aktualisieren", "Softwareinstallation für CAD-Anwendung", "Netzlaufwerk nach Passwortänderung getrennt", "Mobiltelefon mit Firmen-E-Mail einrichten", "Monatsbericht aus Ticketsystem exportieren",
];

async function main(): Promise<void> {
  const passwordHashes = await Promise.all(["Admin123!", "Agent123!", "Kunde123!", "Support123!", "Kunde123!"].map((password) => bcrypt.hash(password, 12)));
  const users = await Promise.all([
    prisma.user.upsert({ where: { email: "admin@jam-it.local" }, update: {}, create: { firstName: "Anna", lastName: "Administrator", email: "admin@jam-it.local", passwordHash: passwordHashes[0]!, role: "ADMIN", company: "JAM IT Dienstleistungen", emailVerifiedAt: new Date() } }),
    prisma.user.upsert({ where: { email: "agent@jam-it.local" }, update: {}, create: { firstName: "Markus", lastName: "Weber", email: "agent@jam-it.local", passwordHash: passwordHashes[1]!, role: "AGENT", company: "JAM IT Dienstleistungen", department: "Support", emailVerifiedAt: new Date() } }),
    prisma.user.upsert({ where: { email: "kunde@jam-it.local" }, update: {}, create: { firstName: "Claudia", lastName: "Becker", email: "kunde@jam-it.local", passwordHash: passwordHashes[2]!, role: "CUSTOMER", company: "Becker & Partner GmbH", emailVerifiedAt: new Date() } }),
    prisma.user.upsert({ where: { email: "support2@jam-it.local" }, update: {}, create: { firstName: "Tobias", lastName: "Klein", email: "support2@jam-it.local", passwordHash: passwordHashes[3]!, role: "AGENT", company: "JAM IT Dienstleistungen", department: "Infrastruktur", emailVerifiedAt: new Date() } }),
    prisma.user.upsert({ where: { email: "maria@beispiel.local" }, update: {}, create: { firstName: "Maria", lastName: "Schulz", email: "maria@beispiel.local", passwordHash: passwordHashes[4]!, role: "CUSTOMER", company: "Schulz Logistik KG", emailVerifiedAt: new Date() } }),
  ]);
  const [admin, agent, customer, agentTwo, customerTwo] = users;

  const teams = await Promise.all([
    prisma.supportTeam.upsert({ where: { name: "Service Desk" }, update: {}, create: { name: "Service Desk", description: "Erste Anlaufstelle für alle Supportanfragen" } }),
    prisma.supportTeam.upsert({ where: { name: "Infrastruktur" }, update: {}, create: { name: "Infrastruktur", description: "Netzwerk, Server und Cloud-Dienste" } }),
    prisma.supportTeam.upsert({ where: { name: "Arbeitsplatz & Anwendungen" }, update: {}, create: { name: "Arbeitsplatz & Anwendungen", description: "Clients, Drucker und Geschäftsanwendungen" } }),
  ]);
  await Promise.all([
    prisma.teamMembership.upsert({ where: { teamId_userId: { teamId: teams[0]!.id, userId: agent!.id } }, update: {}, create: { teamId: teams[0]!.id, userId: agent!.id } }),
    prisma.teamMembership.upsert({ where: { teamId_userId: { teamId: teams[1]!.id, userId: agentTwo!.id } }, update: {}, create: { teamId: teams[1]!.id, userId: agentTwo!.id } }),
    prisma.teamMembership.upsert({ where: { teamId_userId: { teamId: teams[0]!.id, userId: admin!.id } }, update: {}, create: { teamId: teams[0]!.id, userId: admin!.id } }),
  ]);

  const categories = [];
  for (const [index, [name, icon]] of categoryNames.entries()) categories.push(await prisma.category.upsert({ where: { name }, update: {}, create: { name, icon, description: `Supportanfragen im Bereich ${name}`, defaultPriority: index === 6 ? "HIGH" : "MEDIUM", defaultTeamId: teams[index % teams.length]!.id } }));
  const slaData: Array<[string, TicketPriority, number, number]> = [["SLA Niedrig", "LOW", 480, 7200], ["SLA Mittel", "MEDIUM", 240, 4320], ["SLA Hoch", "HIGH", 120, 1440], ["SLA Kritisch", "CRITICAL", 30, 240]];
  const slas = [];
  for (const [name, priority, firstResponseMinutes, resolutionMinutes] of slaData) slas.push(await prisma.slaPolicy.upsert({ where: { name }, update: {}, create: { name, description: `Standardrichtlinie für Priorität ${priority}`, priority, firstResponseMinutes, resolutionMinutes, businessHoursOnly: priority !== "CRITICAL" } }));
  const tags = [];
  const tagData: Array<[string, string]> = [["Remote-Support", "#2F6B78"], ["Vor Ort", "#D4A74E"], ["Wiederkehrend", "#B7791F"], ["Sicherheitsrelevant", "#B42318"], ["VIP", "#123D34"]];
  for (const [name, color] of tagData) tags.push(await prisma.tag.upsert({ where: { name }, update: {}, create: { name, color } }));

  const statuses: TicketStatus[] = ["NEW", "OPEN", "ASSIGNED", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "WAITING_FOR_THIRD_PARTY", "RESOLVED", "CLOSED"];
  const priorities: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  for (let index = 0; index < subjects.length; index += 1) {
    const number = `JAM-2026-${String(index + 1).padStart(6, "0")}`;
    const priority = priorities[index % priorities.length]!;
    const status = statuses[index % statuses.length]!;
    const createdAt = new Date(Date.now() - (subjects.length - index) * 36 * 60 * 60_000);
    const ticket = await prisma.ticket.upsert({
      where: { ticketNumber: number }, update: {},
      create: {
        ticketNumber: number, subject: subjects[index]!, description: `Seit heute tritt folgendes Problem auf: ${subjects[index]!.toLowerCase()}. Die üblichen Neustart- und Verbindungsprüfungen wurden bereits durchgeführt. Bitte prüfen Sie die Ursache und geben Sie eine Rückmeldung.`, status, priority, source: index % 5 === 0 ? "PHONE" : "WEB", categoryId: categories[index % categories.length]!.id, customerId: index % 3 === 0 ? customerTwo!.id : customer!.id, createdById: index % 3 === 0 ? customerTwo!.id : customer!.id, assignedAgentId: status === "NEW" || status === "OPEN" ? null : (index % 2 ? agent!.id : agentTwo!.id), assignedTeamId: teams[index % teams.length]!.id, slaPolicyId: slas.find((sla) => sla.priority === priority)!.id, firstResponseDueAt: new Date(createdAt.getTime() + (priority === "CRITICAL" ? 30 : 240) * 60_000), resolutionDueAt: new Date(createdAt.getTime() + (priority === "CRITICAL" ? 240 : 4320) * 60_000), firstRespondedAt: ["NEW", "OPEN"].includes(status) ? null : new Date(createdAt.getTime() + 70 * 60_000), resolvedAt: ["RESOLVED", "CLOSED"].includes(status) ? new Date(createdAt.getTime() + 22 * 60 * 60_000) : null, closedAt: status === "CLOSED" ? new Date(createdAt.getTime() + 28 * 60 * 60_000) : null, customerRating: status === "CLOSED" ? 4 + (index % 2) : null, customerFeedback: status === "CLOSED" ? "Schnelle und verständliche Unterstützung, vielen Dank." : null, createdAt,
        comments: { create: [{ content: "Vielen Dank für Ihre Anfrage. Wir prüfen das Anliegen und melden uns zeitnah.", type: "PUBLIC", isInternal: false, authorId: agent!.id, createdAt: new Date(createdAt.getTime() + 70 * 60_000) }, ...(index % 4 === 0 ? [{ content: "Interne Prüfung: Gerätekonfiguration und letzte Änderungen vergleichen.", type: "INTERNAL" as const, isInternal: true, authorId: agent!.id, createdAt: new Date(createdAt.getTime() + 90 * 60_000) }] : [])] },
        history: { create: [{ changedById: index % 3 === 0 ? customerTwo!.id : customer!.id, action: "TICKET_CREATED", newValue: "NEW", createdAt }, ...(status !== "NEW" ? [{ changedById: agent!.id, action: "STATUS_CHANGED", field: "status", oldValue: "NEW", newValue: status, createdAt: new Date(createdAt.getTime() + 60 * 60_000) }] : [])] },
        links: index % 5 === 0 ? { create: { url: "https://status.microsoft.com", title: "Statusseite des Anbieters", description: "Zur Prüfung möglicher Störungen", createdById: index % 3 === 0 ? customerTwo!.id : customer!.id } } : undefined,
        tags: { create: { tagId: tags[index % tags.length]!.id } },
      },
    });
    if (index < 5) await prisma.notification.upsert({ where: { id: `seed-notification-${index}` }, update: {}, create: { id: `seed-notification-${index}`, userId: customer!.id, type: "STATUS_CHANGED", title: "Ticket aktualisiert", message: `${ticket.ticketNumber} wurde bearbeitet.`, entityType: "Ticket", entityId: ticket.id, readAt: index > 1 ? new Date() : null } });
  }

  const sampleTicket = await prisma.ticket.findUniqueOrThrow({ where: { ticketNumber: "JAM-2026-000001" } });
  const samplePath = resolve(process.cwd(), "uploads", "seed-diagnose.log");
  const sampleContent = "2026-08-06 09:15:22 INFO JAM IT HelpDesk Beispieldiagnose\n2026-08-06 09:15:23 WARN Netzwerkantwort verzögert\n";
  await mkdir(resolve(process.cwd(), "uploads"), { recursive: true });
  await writeFile(samplePath, sampleContent, "utf8");
  await prisma.attachment.upsert({ where: { storageKey: "seed-diagnose.log" }, update: {}, create: { originalName: "diagnose.log", storedName: "seed-diagnose.log", storageKey: "seed-diagnose.log", filePath: samplePath, mimeType: "text/plain", detectedMimeType: "text/plain", fileExtension: ".log", fileSize: Buffer.byteLength(sampleContent), checksum: createHash("sha256").update(sampleContent).digest("hex"), attachmentType: "LOG", visibility: "PUBLIC", scanStatus: "CLEAN", ticketId: sampleTicket.id, uploadedById: customer!.id } });

  const articles: Array<[string, string, string, string]> = [
    ["VPN-Verbindung prüfen", "vpn-verbindung-pruefen", "Schritte zur Behebung typischer VPN-Verbindungsprobleme.", "Prüfen Sie zuerst Ihre Internetverbindung. Starten Sie anschließend den VPN-Client neu und kontrollieren Sie, ob Datum und Uhrzeit des Geräts korrekt eingestellt sind."],
    ["Sicher mit verdächtigen E-Mails umgehen", "verdaechtige-emails", "So erkennen und melden Sie mögliche Phishing-Nachrichten.", "Öffnen Sie keine unerwarteten Anhänge oder Links. Leiten Sie verdächtige Nachrichten als Anlage an den Service Desk weiter und löschen Sie die Nachricht erst nach Rückmeldung."],
    ["Drucker wieder verbinden", "drucker-wieder-verbinden", "Anleitung zur erneuten Verbindung eines Netzwerkdruckers.", "Prüfen Sie die Stromversorgung und Netzwerkverbindung. Entfernen Sie pausierte Druckaufträge und wählen Sie den korrekten Standarddrucker aus."],
  ];
  for (const [index, [title, slug, summary, content]] of articles.entries()) await prisma.knowledgeBaseArticle.upsert({ where: { slug }, update: {}, create: { title, slug, summary, content, categoryId: categories[index]!.id, authorId: agent!.id, status: "PUBLISHED", publishedAt: new Date() } });
  console.log("Seed abgeschlossen: Demo-Benutzer, Teams, Kategorien, 25 Tickets und Wissensartikel wurden angelegt.");
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
