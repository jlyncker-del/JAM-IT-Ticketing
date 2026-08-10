import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  auth: { user: { id: "customer-1", firstName: "Max", lastName: "Muster", email: "max@example.test", role: "CUSTOMER", isActive: true, createdAt: new Date().toISOString() }, loading: false, login: vi.fn(), logout: vi.fn(), refresh: vi.fn() },
}));
vi.mock("../api/client", () => ({ api: mocks.api, apiErrorMessage: () => "Testfehler" }));
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => mocks.auth }));

import { AppLayout } from "../layouts/AppLayout";
import { CreateTicketPage } from "./CreateTicketPage";
import { TicketDetailPage } from "./TicketDetailPage";
import { TicketListPage } from "./TicketListPage";
import { UserManagementPage } from "./UserManagementPage";

function renderPage(element: ReactNode, path = "/") {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><MemoryRouter initialEntries={[path]}>{element}</MemoryRouter></QueryClientProvider>);
}
const category = { id: "category-1", name: "Arbeitsplatz", defaultPriority: "MEDIUM", isActive: true };

describe("Kritische Frontend-Workflows", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.auth.user = { id: "customer-1", firstName: "Max", lastName: "Muster", email: "max@example.test", role: "CUSTOMER", isActive: true, createdAt: new Date().toISOString() };
    mocks.api.get.mockImplementation(async (url: string) => ({ data: { data: url === "/notifications" ? [] : [] } }));
  });

  it("zeigt die Navigation passend zur Kundenrolle", async () => { renderPage(<Routes><Route element={<AppLayout />}><Route index element={<p>Inhalt</p>} /></Route></Routes>); expect(await screen.findByText("Meine Tickets")).toBeInTheDocument(); expect(screen.queryByText("Benutzer")).not.toBeInTheDocument(); });

  it("erstellt ein Ticket über die echte Formularstruktur", async () => {
    const user = userEvent.setup(); mocks.api.get.mockImplementation(async (url: string) => ({ data: { data: url === "/categories" ? [category] : [] } })); mocks.api.post.mockResolvedValue({ data: { data: { id: "ticket-new" }, message: "Ticket erstellt" } });
    renderPage(<CreateTicketPage />); await user.type(await screen.findByLabelText("Betreff *"), "VPN-Verbindung unterbrochen"); await user.type(screen.getByLabelText("Detaillierte Problembeschreibung *"), "Die VPN-Verbindung bricht seit heute bei jedem Verbindungsversuch reproduzierbar ab."); await user.selectOptions(screen.getByLabelText("Kategorie *"), category.id); await user.click(screen.getByRole("checkbox")); await user.click(screen.getByRole("button", { name: "Ticket absenden" })); await waitFor(() => expect(mocks.api.post).toHaveBeenCalledWith("/tickets", expect.objectContaining({ subject: "VPN-Verbindung unterbrochen", categoryId: category.id, isDraft: false })));
  });

  it("blendet internen Notizmodus für Kunden aus", async () => {
    mocks.api.get.mockImplementation(async (url: string) => ({ data: { data: url.startsWith("/tickets/") ? { id: "ticket-1", ticketNumber: "JAM-2026-000001", subject: "Testticket", description: "Öffentliche Beschreibung", status: "OPEN", priority: "MEDIUM", source: "WEB", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), category, comments: [], attachments: [], links: [], history: [] } : [] } }));
    renderPage(<Routes><Route path="/tickets/:id" element={<TicketDetailPage />} /></Routes>, "/tickets/ticket-1"); expect(await screen.findByText("Öffentliche Beschreibung")).toBeInTheDocument(); expect(screen.queryByText(/Als interne Notiz/)).not.toBeInTheDocument();
  });

  it("übergibt Suche und kombinierte Filter an das Backend", async () => {
    const user = userEvent.setup(); mocks.api.get.mockImplementation(async (url: string) => url === "/tickets" ? { data: { success: true, data: [], pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 1, hasPreviousPage: false, hasNextPage: false } } } : { data: { data: url === "/categories" ? [category] : [] } });
    renderPage(<TicketListPage />); await user.type(screen.getByLabelText("Tickets durchsuchen"), "VPN"); await user.selectOptions(screen.getByLabelText("Priorität"), "HIGH"); await waitFor(() => expect(mocks.api.get).toHaveBeenCalledWith("/tickets", expect.objectContaining({ params: expect.objectContaining({ search: "VPN", priority: "HIGH" }) })));
  });

  it("legt als Administrator ein Benutzerkonto an", async () => {
    mocks.auth.user = { ...mocks.auth.user, role: "ADMIN" }; const user = userEvent.setup(); mocks.api.get.mockImplementation(async (url: string) => ({ data: { data: url === "/users" ? [] : [] } })); mocks.api.post.mockResolvedValue({ data: { message: "Benutzer erstellt" } });
    renderPage(<UserManagementPage />); await user.click(screen.getByRole("button", { name: "Benutzer anlegen" })); await user.type(screen.getByLabelText("Vorname *"), "Neue"); await user.type(screen.getByLabelText("Nachname *"), "Person"); await user.type(screen.getByLabelText("E-Mail-Adresse *"), "neu@example.test"); await user.type(screen.getByLabelText("Startpasswort *"), "Sicheres123!"); await user.click(screen.getByRole("button", { name: "Benutzer speichern" })); await waitFor(() => expect(mocks.api.post).toHaveBeenCalledWith("/users", expect.objectContaining({ email: "neu@example.test", role: "CUSTOMER" })));
  });
});
