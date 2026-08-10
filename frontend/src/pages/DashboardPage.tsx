import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock3, FilePlus2, Inbox, ListChecks, ShieldAlert, Ticket } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, apiErrorMessage } from "../api/client";
import { Button, Card, ErrorState, LoadingState, PageTitle, PriorityBadge, StatusBadge } from "../components/ui";
import { priorityLabels } from "../constants/labels";
import { brandColors } from "../config/brand";
import { useAuth } from "../contexts/AuthContext";
import type { ApiResponse, DashboardSummary } from "../types";
import { formatRelative } from "../utils/format";

const icons = [Ticket, Inbox, ListChecks, Clock3, CheckCircle2, AlertTriangle, ShieldAlert, Ticket];
export function DashboardPage() {
  const { user } = useAuth();
  const summary = useQuery({ queryKey: ["dashboard-summary"], queryFn: async () => (await api.get<ApiResponse<DashboardSummary>>("/dashboard/summary")).data.data });
  const priorities = useQuery({ queryKey: ["dashboard-priorities"], queryFn: async () => (await api.get<ApiResponse<Array<{ key: string; count: number }>>>("/dashboard/tickets-by-priority")).data.data });
  if (summary.isLoading) return <LoadingState label="Dashboard wird vorbereitet …" />;
  if (summary.isError || !summary.data) return <ErrorState message={apiErrorMessage(summary.error)} retry={() => void summary.refetch()} />;
  const data = summary.data;
  const stats = user?.role === "CUSTOMER" ? [["Meine Tickets", data.total], ["Offen", data.open], ["In Bearbeitung", data.inProgress], ["Wartet auf mich", data.waiting], ["Gelöst", data.resolved], ["Ungelesen", data.unread]] : user?.role === "ADMIN" ? [["Tickets gesamt", data.total], ["Offen", data.open], ["In Bearbeitung", data.inProgress], ["Gelöst", data.resolved], ["Geschlossen", data.closed], ["Kritisch", data.critical], ["SLA-Erfüllung", `${data.total ? Math.round((data.total - data.slaBreached) / data.total * 100) : 100} %`], ["Kundenzufriedenheit", `${data.averageRating.toLocaleString("de-DE", { maximumFractionDigits: 1 })} / 5`]] : [["Meine / freie Tickets", data.total], ["Nicht zugewiesen", data.unassigned], ["Kritisch", data.critical], ["SLA-Warnung", data.slaWarning], ["SLA überschritten", data.slaBreached], ["Wartet auf Kunden", data.waiting], ["Ø erste Reaktion", `${data.averageFirstResponseMinutes} Min.`], ["Ø Lösung", `${data.averageResolutionMinutes} Min.`]];
  return <><PageTitle title={`Guten Tag, ${user?.firstName}`} description={user?.role === "CUSTOMER" ? "Hier sehen Sie den aktuellen Stand Ihrer Supportanfragen." : "Hier sehen Sie die aktuelle Lage im Service Desk."} action={<Link to="/tickets/neu"><Button><FilePlus2 size={18} />Ticket erstellen</Button></Link>} />
    <div className="stats-grid">{stats.map(([label, value], index) => { const Icon = icons[index]!; return <Card className="stat-card" key={String(label)}><div className="stat-icon"><Icon size={22} /></div><div className="stat-content"><span>{label}</span><strong>{value}</strong><small>Aktueller Bestand</small></div></Card>; })}</div>
    <div className="dashboard-grid"><Card><div className="section-heading"><h2>Zuletzt aktualisierte Tickets</h2><Link className="text-link" to="/tickets">Alle anzeigen</Link></div><div className="activity-list">{data.recent.length ? data.recent.map((ticket) => <Link className="activity-item" to={`/tickets/${ticket.id}`} key={ticket.id}><div className="activity-main"><strong>{ticket.subject}</strong><span>{ticket.ticketNumber} · {ticket.category.name}</span></div><div><StatusBadge status={ticket.status} /><time>{formatRelative(ticket.updatedAt)}</time></div></Link>) : <p>Es sind noch keine Tickets vorhanden.</p>}</div></Card>
      <Card><div className="section-heading"><h2>Tickets nach Priorität</h2></div><div className="chart-wrap">{priorities.data?.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={priorities.data.map((item) => ({ name: priorityLabels[item.key] ?? item.key, Anzahl: item.count }))} margin={{ top: 10, right: 5, left: -20, bottom: 5 }}><CartesianGrid stroke={brandColors.border} vertical={false} /><XAxis dataKey="name" tick={{ fill: brandColors.secondary, fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fill: brandColors.secondary, fontSize: 11 }} /><Tooltip contentStyle={{ border: `1px solid ${brandColors.border}`, borderRadius: 6 }} /><Bar dataKey="Anzahl" fill={brandColors.green} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="state"><PriorityBadge priority="MEDIUM" /><p>Noch keine Statistik verfügbar.</p></div>}</div></Card></div>
  </>;
}
