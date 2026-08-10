import { format, formatDistanceToNowStrict } from "date-fns";
import { de } from "date-fns/locale";

export function formatDate(value?: string | Date): string { return value ? format(new Date(value), "dd.MM.yyyy", { locale: de }) : "–"; }
export function formatDateTime(value?: string | Date): string { return value ? `${format(new Date(value), "dd.MM.yyyy, HH:mm", { locale: de })} Uhr` : "–"; }
export function formatRelative(value: string | Date): string { return formatDistanceToNowStrict(new Date(value), { addSuffix: true, locale: de }); }
export function formatFileSize(bytes: number): string { return new Intl.NumberFormat("de-DE", { style: "unit", unit: bytes >= 1_000_000 ? "megabyte" : "kilobyte", unitDisplay: "short", maximumFractionDigits: 1 }).format(bytes / (bytes >= 1_000_000 ? 1_000_000 : 1_000)); }
