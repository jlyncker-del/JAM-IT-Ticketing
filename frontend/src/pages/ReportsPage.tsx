import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Gauge, Star, TicketCheck } from "lucide-react";
import { api, apiErrorMessage } from "../api/client";
import {
  Button,
  Card,
  ErrorState,
  Input,
  LoadingState,
  PageTitle,
  Select,
} from "../components/ui";
import { priorityLabels, statusLabels } from "../constants/labels";
import type { ApiResponse, Category } from "../types";

interface Report {
  total: number;
  resolved: number;
  closed: number;
  resolutionRate: number;
  averageRating: number;
  ratingCount: number;
  slaCompliance: number;
  averageFirstResponseMinutes: number;
  averageResolutionMinutes: number;
  agentWorkload: Array<{ id: string; name: string; count: number }>;
}
const initial = {
  from: "",
  to: "",
  status: "",
  priority: "",
  categoryId: "",
  assignedAgentId: "",
  assignedTeamId: "",
  sla: "",
};
export function ReportsPage() {
  const [filters, setFilters] = useState(initial);
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value),
  );
  const query = useQuery({
    queryKey: ["reports", filters],
    queryFn: async () =>
      (await api.get<ApiResponse<Report>>("/reports/tickets", { params })).data
        .data,
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () =>
      (await api.get<ApiResponse<Category[]>>("/categories")).data.data,
  });
  const agents = useQuery({
    queryKey: ["support-directory"],
    queryFn: async () =>
      (
        await api.get<
          ApiResponse<
            Array<{ id: string; firstName: string; lastName: string }>
          >
        >("/users/support-directory")
      ).data.data,
  });
  const teams = useQuery({
    queryKey: ["teams"],
    queryFn: async () =>
      (
        await api.get<ApiResponse<Array<{ id: string; name: string }>>>(
          "/teams",
        )
      ).data.data,
  });
  const download = async () => {
    const response = await api.get("/reports/export", {
      params,
      responseType: "blob",
    });
    const url = URL.createObjectURL(response.data as Blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "jam-it-ticketbericht.csv";
    link.click();
    URL.revokeObjectURL(url);
  };
  const set = (key: keyof typeof filters, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));
  return (
    <>
      <PageTitle
        title="Berichte"
        description="Kennzahlen für Steuerung, Qualität und Serviceleistung."
        action={
          <Button onClick={() => void download()}>
            <Download size={18} />
            Gefilterte CSV exportieren
          </Button>
        }
      />
      <Card style={{ marginBottom: "1rem" }}>
        <h2>Berichtsfilter</h2>
        <div className="toolbar">
          <Input
            label="Von"
            type="date"
            value={filters.from}
            onChange={(event) => set("from", event.target.value)}
          />
          <Input
            label="Bis"
            type="date"
            value={filters.to}
            onChange={(event) => set("to", event.target.value)}
          />
          <Select
            label="Status"
            value={filters.status}
            onChange={(event) => set("status", event.target.value)}
          >
            <option value="">Alle Status</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            label="Priorität"
            value={filters.priority}
            onChange={(event) => set("priority", event.target.value)}
          >
            <option value="">Alle Prioritäten</option>
            {Object.entries(priorityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            label="Kategorie"
            value={filters.categoryId}
            onChange={(event) => set("categoryId", event.target.value)}
          >
            <option value="">Alle Kategorien</option>
            {categories.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select
            label="Bearbeiter"
            value={filters.assignedAgentId}
            onChange={(event) => set("assignedAgentId", event.target.value)}
          >
            <option value="">Alle Bearbeiter</option>
            {agents.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.firstName} {item.lastName}
              </option>
            ))}
          </Select>
          <Select
            label="Team"
            value={filters.assignedTeamId}
            onChange={(event) => set("assignedTeamId", event.target.value)}
          >
            <option value="">Alle Teams</option>
            {teams.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
          <Select
            label="SLA"
            value={filters.sla}
            onChange={(event) => set("sla", event.target.value)}
          >
            <option value="">Alle SLA-Zustände</option>
            <option value="within">Im Ziel</option>
            <option value="breached">Überschritten</option>
          </Select>
          <Button variant="ghost" onClick={() => setFilters(initial)}>
            Filter zurücksetzen
          </Button>
        </div>
      </Card>
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError || !query.data ? (
        <ErrorState message={apiErrorMessage(query.error)} />
      ) : (
        <>
          <div className="stats-grid">
            <Card className="stat-card">
              <div className="stat-icon">
                <Gauge />
              </div>
              <div className="stat-content">
                <span>Ticketvolumen</span>
                <strong>{query.data.total}</strong>
              </div>
            </Card>
            <Card className="stat-card">
              <div className="stat-icon">
                <TicketCheck />
              </div>
              <div className="stat-content">
                <span>Lösungsquote</span>
                <strong>
                  {query.data.resolutionRate.toLocaleString("de-DE")} %
                </strong>
              </div>
            </Card>
            <Card className="stat-card">
              <div className="stat-icon">
                <Gauge />
              </div>
              <div className="stat-content">
                <span>SLA-Erfüllung</span>
                <strong>
                  {query.data.slaCompliance.toLocaleString("de-DE")} %
                </strong>
              </div>
            </Card>
            <Card className="stat-card">
              <div className="stat-icon">
                <Star />
              </div>
              <div className="stat-content">
                <span>Kundenzufriedenheit</span>
                <strong>
                  {query.data.averageRating.toLocaleString("de-DE", {
                    maximumFractionDigits: 1,
                  })}{" "}
                  / 5
                </strong>
                <small>{query.data.ratingCount} Bewertungen</small>
              </div>
            </Card>
            <Card className="stat-card">
              <div className="stat-icon">
                <Gauge />
              </div>
              <div className="stat-content">
                <span>Ø erste Reaktion</span>
                <strong>{query.data.averageFirstResponseMinutes} Min.</strong>
              </div>
            </Card>
            <Card className="stat-card">
              <div className="stat-icon">
                <Gauge />
              </div>
              <div className="stat-content">
                <span>Ø Lösung</span>
                <strong>{query.data.averageResolutionMinutes} Min.</strong>
              </div>
            </Card>
          </div>
          <div className="dashboard-grid">
            <Card><h2>Arbeitslast nach Bearbeiter</h2><div className="activity-list">{query.data.agentWorkload.length ? query.data.agentWorkload.map((item) => <div className="activity-item" key={item.id}><strong>{item.name}</strong><span>{item.count} Tickets</span></div>) : <p>Für die aktuelle Auswahl liegen keine Zuweisungen vor.</p>}</div></Card>
            <Card><h2>Datenschutz im Export</h2><p className="prose">Der CSV-Export verwendet dieselben Filter und enthält ausschließlich fachliche Ticketdaten. Passworthashes, Reset-Tokens und interne Sicherheitsmetadaten werden niemals exportiert.</p></Card>
          </div>
        </>
      )}
    </>
  );
}
