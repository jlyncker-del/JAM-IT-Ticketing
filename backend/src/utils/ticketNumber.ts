export function formatTicketNumber(sequence: number, yearOrDate: number | Date = new Date().getFullYear()): string {
  const year = yearOrDate instanceof Date ? yearOrDate.getFullYear() : yearOrDate;
  return `JAM-${year}-${String(sequence).padStart(6, "0")}`;
}
