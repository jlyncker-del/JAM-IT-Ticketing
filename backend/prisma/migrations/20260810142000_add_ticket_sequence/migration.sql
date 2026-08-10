CREATE TABLE "TicketSequence" (
    "year" INTEGER NOT NULL,
    "lastValue" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketSequence_pkey" PRIMARY KEY ("year")
);

INSERT INTO "TicketSequence" ("year", "lastValue", "updatedAt")
SELECT
  CAST(SPLIT_PART("ticketNumber", '-', 2) AS INTEGER),
  MAX(CAST(SPLIT_PART("ticketNumber", '-', 3) AS INTEGER)),
  CURRENT_TIMESTAMP
FROM "Ticket"
WHERE "ticketNumber" ~ '^JAM-[0-9]{4}-[0-9]{6}$'
GROUP BY CAST(SPLIT_PART("ticketNumber", '-', 2) AS INTEGER)
ON CONFLICT ("year") DO UPDATE SET
  "lastValue" = GREATEST("TicketSequence"."lastValue", EXCLUDED."lastValue"),
  "updatedAt" = CURRENT_TIMESTAMP;
