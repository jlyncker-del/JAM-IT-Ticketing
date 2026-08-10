import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AuthProvider } from "../contexts/AuthContext";
import { LoginPage } from "./AuthPages";

describe("Anmeldeformular", () => {
  it("zeigt deutsche Validierungsmeldungen", async () => { const user = userEvent.setup(); render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><AuthProvider><LoginPage /></AuthProvider></MemoryRouter></QueryClientProvider>); await user.click(screen.getByRole("button", { name: "Anmelden" })); expect(await screen.findByText("Bitte geben Sie eine gültige E-Mail-Adresse ein.")).toBeInTheDocument(); expect(screen.getByText("Bitte geben Sie Ihr Passwort ein.")).toBeInTheDocument(); });
});
