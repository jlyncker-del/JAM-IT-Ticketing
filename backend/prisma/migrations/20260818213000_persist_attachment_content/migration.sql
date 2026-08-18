-- Render's service filesystem is ephemeral. Persist attachment bytes with the
-- metadata so downloads remain available after restarts and deployments.
ALTER TABLE "Attachment" ADD COLUMN "content" BYTEA;

-- Restore the deterministic demo attachment whose original file was created by
-- the initial seed on an earlier, now-discarded Render filesystem.
UPDATE "Attachment"
SET "content" = convert_to(
  E'2026-08-10 09:15:22 INFO VPN-Client gestartet\n2026-08-10 09:15:24 WARN Gateway nicht erreichbar\n',
  'UTF8'
)
WHERE "storageKey" = 'seed-diagnose.log' AND "content" IS NULL;
