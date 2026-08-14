import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog, EmptyState, Input, PriorityBadge, StatusBadge } from "./ui";
import { FileUpload } from "./FileUpload";

describe("UI-Komponenten", () => {
  it("zeigt deutsche Status- und Prioritätslabels", () => { render(<><StatusBadge status="IN_PROGRESS" /><PriorityBadge priority="CRITICAL" /></>); expect(screen.getByText("In Bearbeitung")).toBeInTheDocument(); expect(screen.getByText("Kritisch")).toBeInTheDocument(); });
  it("verknüpft Formularfehler barrierefrei", () => { render(<Input label="E-Mail-Adresse" name="email" error="Bitte geben Sie eine gültige E-Mail-Adresse ein." />); expect(screen.getByLabelText("E-Mail-Adresse")).toHaveAttribute("aria-invalid", "true"); expect(screen.getByRole("textbox")).toHaveAccessibleDescription("Bitte geben Sie eine gültige E-Mail-Adresse ein."); });
  it("zeigt einen verständlichen Leerzustand", () => { render(<EmptyState title="Keine Tickets gefunden" />); expect(screen.getByText("Keine Tickets gefunden")).toBeInTheDocument(); });
  it("fordert vor einer destruktiven Aktion eine Bestätigung an", async () => { const user = userEvent.setup(); let cancelled = false; render(<ConfirmDialog open title="Kommentar löschen" description="Der Kommentar wird ausgeblendet." danger onCancel={() => { cancelled = true; }} onConfirm={() => undefined} />); expect(screen.getByRole("alertdialog")).toBeInTheDocument(); await user.click(screen.getByRole("button", { name: "Abbrechen" })); expect(cancelled).toBe(true); });
  it("weist ausführbare Dateien im Dateiuploader verständlich ab", async () => { const user = userEvent.setup({ applyAccept: false }); render(<FileUpload files={[]} onChange={() => undefined} />); await user.upload(screen.getByLabelText("Dateien hinzufügen"), new File(["test"], "schadsoftware.exe", { type: "application/octet-stream" })); expect(await screen.findByText(/nicht erlaubten Dateityp/)).toBeInTheDocument(); });
  it("stellt Dateien mit identischen Namen ohne Schlüsselkonflikt dar", () => { const first = new File(["eins"], "diagnose.log", { type: "text/plain", lastModified: 1 }); const second = new File(["zwei"], "diagnose.log", { type: "text/plain", lastModified: 1 }); render(<FileUpload files={[first, second]} onChange={() => undefined} />); expect(screen.getAllByText("diagnose.log")).toHaveLength(2); });
});
