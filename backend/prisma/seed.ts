import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient, TicketPriority, TicketStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const seedTicketNumbers = Array.from({ length: 25 }, (_, index) => `JAM-2026-${String(index + 1).padStart(6, "0")}`);

const categoryData = [
  ["Hardware", "DesktopComputer"],
  ["Software", "AppWindow"],
  ["Netzwerk und Internet", "Network"],
  ["E-Mail und Kommunikation", "Mail"],
  ["Drucker und Scanner", "Printer"],
  ["Benutzerkonten und Zugänge", "KeyRound"],
  ["IT-Sicherheit", "ShieldCheck"],
  ["Telefonie", "Phone"],
  ["Cloud-Dienste", "Cloud"],
  ["Sonstige Anfrage", "CircleHelp"],
] as const;

const slaData: Array<[string, TicketPriority, number, number]> = [
  ["SLA Niedrig", "LOW", 480, 7200],
  ["SLA Mittel", "MEDIUM", 240, 4320],
  ["SLA Hoch", "HIGH", 120, 1440],
  ["SLA Kritisch", "CRITICAL", 30, 240],
];

async function main(): Promise<void> {
  await prisma.notification.deleteMany({ where: { id: { startsWith: "seed-notification-" } } });
  await prisma.ticket.deleteMany({ where: { ticketNumber: { in: seedTicketNumbers } } });

  const [adminPassword, agentPassword, customerPassword] = await Promise.all([
    bcrypt.hash("Admin123!", 12),
    bcrypt.hash("Agent123!", 12),
    bcrypt.hash("Kunde123!", 12),
  ]);
  const [admin, agent, customer, secondCustomer] = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@jam-it.local" },
      update: { firstName: "Jamal", lastName: "Lyncker", passwordHash: adminPassword, role: "ADMIN", company: "JAM IT Dienstleistungen", department: "Administration", position: "Systemadministrator", isActive: true },
      create: { firstName: "Jamal", lastName: "Lyncker", email: "admin@jam-it.local", passwordHash: adminPassword, role: "ADMIN", company: "JAM IT Dienstleistungen", department: "Administration", position: "Systemadministrator", emailVerifiedAt: new Date() },
    }),
    prisma.user.upsert({
      where: { email: "agent@jam-it.local" },
      update: { firstName: "Laura", lastName: "Becker", passwordHash: agentPassword, role: "AGENT", company: "JAM IT Dienstleistungen", department: "Service Desk", position: "IT-Support-Spezialistin", isActive: true },
      create: { firstName: "Laura", lastName: "Becker", email: "agent@jam-it.local", passwordHash: agentPassword, role: "AGENT", company: "JAM IT Dienstleistungen", department: "Service Desk", position: "IT-Support-Spezialistin", emailVerifiedAt: new Date() },
    }),
    prisma.user.upsert({
      where: { email: "kunde@jam-it.local" },
      update: { firstName: "Max", lastName: "Mustermann", passwordHash: customerPassword, role: "CUSTOMER", company: "Mustermann Consulting GmbH", department: "Vertrieb", position: "Teamleiter", isActive: true },
      create: { firstName: "Max", lastName: "Mustermann", email: "kunde@jam-it.local", passwordHash: customerPassword, role: "CUSTOMER", company: "Mustermann Consulting GmbH", department: "Vertrieb", position: "Teamleiter", emailVerifiedAt: new Date() },
    }),
    prisma.user.upsert({
      where: { email: "anna.schmidt@beispiel.local" },
      update: { firstName: "Anna", lastName: "Schmidt", passwordHash: customerPassword, role: "CUSTOMER", company: "Schmidt Logistik KG", department: "Buchhaltung", position: "Sachbearbeiterin", isActive: true },
      create: { firstName: "Anna", lastName: "Schmidt", email: "anna.schmidt@beispiel.local", passwordHash: customerPassword, role: "CUSTOMER", company: "Schmidt Logistik KG", department: "Buchhaltung", position: "Sachbearbeiterin", emailVerifiedAt: new Date() },
    }),
  ]);

  const teams = await Promise.all([
    prisma.supportTeam.upsert({ where: { name: "Service Desk" }, update: { description: "Erste Anlaufstelle für alle Supportanfragen", isActive: true }, create: { name: "Service Desk", description: "Erste Anlaufstelle für alle Supportanfragen" } }),
    prisma.supportTeam.upsert({ where: { name: "Infrastruktur" }, update: { description: "Netzwerk, Server und Cloud-Dienste", isActive: true }, create: { name: "Infrastruktur", description: "Netzwerk, Server und Cloud-Dienste" } }),
    prisma.supportTeam.upsert({ where: { name: "Arbeitsplatz & Anwendungen" }, update: { description: "Clients, Drucker und Geschäftsanwendungen", isActive: true }, create: { name: "Arbeitsplatz & Anwendungen", description: "Clients, Drucker und Geschäftsanwendungen" } }),
  ]);
  await Promise.all([
    prisma.teamMembership.upsert({ where: { teamId_userId: { teamId: teams[0]!.id, userId: agent.id } }, update: {}, create: { teamId: teams[0]!.id, userId: agent.id } }),
    prisma.teamMembership.upsert({ where: { teamId_userId: { teamId: teams[0]!.id, userId: admin.id } }, update: {}, create: { teamId: teams[0]!.id, userId: admin.id } }),
  ]);

  const categories = [];
  for (const [index, [name, icon]] of categoryData.entries()) {
    categories.push(await prisma.category.upsert({
      where: { name },
      update: { icon, description: `Supportanfragen im Bereich ${name}`, defaultTeamId: teams[index % teams.length]!.id, isActive: true },
      create: { name, icon, description: `Supportanfragen im Bereich ${name}`, defaultPriority: name === "IT-Sicherheit" ? "HIGH" : "MEDIUM", defaultTeamId: teams[index % teams.length]!.id },
    }));
  }

  const slas = [];
  for (const [name, priority, firstResponseMinutes, resolutionMinutes] of slaData) {
    slas.push(await prisma.slaPolicy.upsert({
      where: { name },
      update: { priority, firstResponseMinutes, resolutionMinutes, businessHoursOnly: false, isActive: true },
      create: { name, description: `Standardrichtlinie für Priorität ${priority}`, priority, firstResponseMinutes, resolutionMinutes, businessHoursOnly: false },
    }));
  }

  const tags = [];
  for (const [name, color] of [["Remote-Support", "#2F6B78"], ["Vor Ort", "#D4A74E"], ["Wiederkehrend", "#B7791F"], ["Sicherheitsrelevant", "#B42318"], ["VIP", "#123D34"]] as const) {
    tags.push(await prisma.tag.upsert({ where: { name }, update: { color }, create: { name, color } }));
  }

  const categoryByName = new Map(categories.map((category) => [category.name, category]));
  const slaByPriority = new Map(slas.map((sla) => [sla.priority, sla]));
  const now = Date.now();
  const definitions: Array<{
    subject: string;
    description: string;
    status: TicketStatus;
    priority: TicketPriority;
    category: string;
    customerId: string;
    assigned: boolean;
    publicComment: string;
    internalComment?: string;
    tagIndex: number;
  }> = [
    { subject: "VPN-Verbindung funktioniert nicht", description: "Die VPN-Verbindung zum Firmennetzwerk bricht seit heute direkt nach der Anmeldung ab. Internetzugang und Zugangsdaten wurden bereits geprüft; ein Neustart des Notebooks hat das Problem nicht behoben.", status: "OPEN", priority: "HIGH", category: "Netzwerk und Internet", customerId: customer.id, assigned: false, publicComment: "Vielen Dank für die genaue Beschreibung. Wir prüfen aktuell den VPN-Gateway-Status und melden uns kurzfristig.", tagIndex: 0 },
    { subject: "Outlook synchronisiert keine E-Mails", description: "Outlook zeigt seit dem Morgen keine neuen Nachrichten an. Der Webzugriff auf das Postfach funktioniert, Senden und Empfangen in der Desktop-Anwendung bleibt jedoch ohne Ergebnis.", status: "IN_PROGRESS", priority: "MEDIUM", category: "E-Mail und Kommunikation", customerId: customer.id, assigned: true, publicComment: "Wir haben die Synchronisierung des Outlook-Profils geprüft und arbeiten an einer Reparatur des lokalen Caches.", internalComment: "Interne Analyse: OST-Datei sichern und Profil bei unverändertem Fehler kontrolliert neu erstellen.", tagIndex: 2 },
    { subject: "Drucker im Büro nicht erreichbar", description: "Der Netzwerkdrucker im zweiten Obergeschoss wird als offline angezeigt. Andere Kolleginnen und Kollegen können derzeit ebenfalls keine Dokumente an dieses Gerät senden.", status: "WAITING_FOR_CUSTOMER", priority: "LOW", category: "Drucker und Scanner", customerId: secondCustomer.id, assigned: true, publicComment: "Bitte prüfen Sie kurz, ob am Display des Druckers eine IP-Adresse und eine Fehlermeldung angezeigt werden, und senden Sie uns ein Foto.", tagIndex: 1 },
    { subject: "Verdächtige E-Mail erhalten", description: "Eine unerwartete E-Mail fordert zur Anmeldung über einen externen Link auf und enthält zusätzlich einen unbekannten Anhang. Der Link und der Anhang wurden nicht geöffnet.", status: "RESOLVED", priority: "CRITICAL", category: "IT-Sicherheit", customerId: customer.id, assigned: true, publicComment: "Die Nachricht wurde als Phishing-Versuch bestätigt und zentral blockiert. Es sind keine weiteren Schritte auf Ihrem Gerät erforderlich.", internalComment: "Absenderdomain und Prüfsumme wurden in die zentrale Sperrliste aufgenommen; keine weiteren Empfänger betroffen.", tagIndex: 3 },
    { subject: "Passwort für Mitarbeiterkonto zurücksetzen", description: "Nach mehreren fehlgeschlagenen Anmeldeversuchen ist das Benutzerkonto gesperrt. Ein neues temporäres Passwort wird für den Arbeitsbeginn benötigt.", status: "CLOSED", priority: "MEDIUM", category: "Benutzerkonten und Zugänge", customerId: secondCustomer.id, assigned: true, publicComment: "Das Konto wurde entsperrt und das temporäre Passwort über den vereinbarten sicheren Kontaktweg bereitgestellt.", tagIndex: 4 },
  ];

  for (const [index, definition] of definitions.entries()) {
    const createdAt = new Date(now - (definitions.length - index) * 24 * 60 * 60_000);
    const policy = slaByPriority.get(definition.priority)!;
    const number = `JAM-2026-${String(index + 1).padStart(6, "0")}`;
    const respondedAt = definition.status === "OPEN" ? null : new Date(createdAt.getTime() + Math.min(60, policy.firstResponseMinutes) * 60_000);
    const resolvedAt = ["RESOLVED", "CLOSED"].includes(definition.status) ? new Date(createdAt.getTime() + Math.min(180, policy.resolutionMinutes) * 60_000) : null;
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: number,
        subject: definition.subject,
        description: definition.description,
        status: definition.status,
        priority: definition.priority,
        source: index === 4 ? "PHONE" : "WEB",
        categoryId: categoryByName.get(definition.category)!.id,
        customerId: definition.customerId,
        createdById: definition.customerId,
        assignedAgentId: definition.assigned ? agent.id : null,
        assignedTeamId: teams[index % teams.length]!.id,
        slaPolicyId: policy.id,
        firstResponseDueAt: new Date(createdAt.getTime() + policy.firstResponseMinutes * 60_000),
        resolutionDueAt: new Date(createdAt.getTime() + policy.resolutionMinutes * 60_000),
        firstRespondedAt: respondedAt,
        resolvedAt,
        closedAt: definition.status === "CLOSED" && resolvedAt ? new Date(resolvedAt.getTime() + 60 * 60_000) : null,
        customerRating: definition.status === "CLOSED" ? 5 : null,
        customerFeedback: definition.status === "CLOSED" ? "Schnelle und verständliche Unterstützung – vielen Dank." : null,
        createdAt,
        comments: { create: [
          { content: definition.publicComment, type: "PUBLIC", isInternal: false, authorId: agent.id, createdAt: new Date(createdAt.getTime() + 60 * 60_000), updatedAt: new Date(createdAt.getTime() + 60 * 60_000) },
          ...(definition.internalComment ? [{ content: definition.internalComment, type: "INTERNAL" as const, isInternal: true, authorId: agent.id, createdAt: new Date(createdAt.getTime() + 90 * 60_000), updatedAt: new Date(createdAt.getTime() + 90 * 60_000) }] : []),
        ] },
        history: { create: [
          { changedById: definition.customerId, action: "TICKET_CREATED", newValue: "NEW", createdAt },
          ...(definition.status !== "NEW" ? [{ changedById: agent.id, action: "STATUS_CHANGED", field: "status", oldValue: "NEW", newValue: definition.status, createdAt: new Date(createdAt.getTime() + 45 * 60_000) }] : []),
        ] },
        tags: { create: { tagId: tags[definition.tagIndex]!.id } },
        links: index === 0 ? { create: { url: "https://status.microsoft.com", title: "Microsoft-Statusseite", description: "Prüfung möglicher externer Störungen", createdById: customer.id } } : undefined,
      },
    });
    await prisma.notification.create({ data: { id: `seed-notification-${index}`, userId: definition.customerId, type: "STATUS_CHANGED", title: "Ticket aktualisiert", message: `${ticket.ticketNumber} wurde bearbeitet.`, entityType: "Ticket", entityId: ticket.id, readAt: index > 1 ? new Date() : null } });
  }

  await prisma.ticketSequence.upsert({ where: { year: 2026 }, update: { lastValue: 5 }, create: { year: 2026, lastValue: 5 } });

  const sampleTicket = await prisma.ticket.findUniqueOrThrow({ where: { ticketNumber: "JAM-2026-000001" } });
  const samplePath = resolve(process.cwd(), "uploads", "seed-diagnose.log");
  const sampleContent = "2026-08-10 09:15:22 INFO VPN-Client gestartet\n2026-08-10 09:15:24 WARN Gateway nicht erreichbar\n";
  await mkdir(resolve(process.cwd(), "uploads"), { recursive: true });
  await writeFile(samplePath, sampleContent, "utf8");
  await prisma.attachment.upsert({
    where: { storageKey: "seed-diagnose.log" },
    update: { ticketId: sampleTicket.id, uploadedById: customer.id, filePath: samplePath, fileSize: Buffer.byteLength(sampleContent), content: Buffer.from(sampleContent), checksum: createHash("sha256").update(sampleContent).digest("hex") },
    create: { originalName: "vpn-diagnose.log", storedName: "seed-diagnose.log", storageKey: "seed-diagnose.log", filePath: samplePath, mimeType: "text/plain", detectedMimeType: "text/plain", fileExtension: ".log", fileSize: Buffer.byteLength(sampleContent), content: Buffer.from(sampleContent), checksum: createHash("sha256").update(sampleContent).digest("hex"), attachmentType: "LOG", visibility: "PUBLIC", scanStatus: "CLEAN", ticketId: sampleTicket.id, uploadedById: customer.id },
  });

  const articles: Array<[string, string, string, string]> = [
    ["VPN-Verbindung prüfen", "vpn-verbindung-pruefen", "Schritte zur Behebung typischer VPN-Verbindungsprobleme.", "Prüfen Sie zuerst Ihre Internetverbindung. Starten Sie anschließend den VPN-Client neu und kontrollieren Sie, ob Datum und Uhrzeit des Geräts korrekt eingestellt sind."],
    ["Sicher mit verdächtigen E-Mails umgehen", "verdaechtige-emails", "So erkennen und melden Sie mögliche Phishing-Nachrichten.", "Öffnen Sie keine unerwarteten Anhänge oder Links. Leiten Sie verdächtige Nachrichten als Anlage an den Service Desk weiter und löschen Sie die Nachricht erst nach Rückmeldung."],
    ["Drucker wieder verbinden", "drucker-wieder-verbinden", "Anleitung zur erneuten Verbindung eines Netzwerkdruckers.", "Prüfen Sie die Stromversorgung und Netzwerkverbindung. Entfernen Sie pausierte Druckaufträge und wählen Sie den korrekten Standarddrucker aus."],
  ];
  for (const [index, [title, slug, summary, content]] of articles.entries()) {
    await prisma.knowledgeBaseArticle.upsert({ where: { slug }, update: { title, summary, content, categoryId: categories[index]!.id, authorId: agent.id, status: "PUBLISHED" }, create: { title, slug, summary, content, categoryId: categories[index]!.id, authorId: agent.id, status: "PUBLISHED", publishedAt: new Date() } });
  }

  console.log("Seed abgeschlossen: 4 Demo-Benutzer, 3 Teams, 10 Kategorien, 5 Tickets und 3 Wissensartikel wurden angelegt.");
}

main()
  .catch((error: unknown) => { console.error("Seed fehlgeschlagen:", error); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());
