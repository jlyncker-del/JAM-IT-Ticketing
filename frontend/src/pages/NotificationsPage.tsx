import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { api, apiErrorMessage } from "../api/client";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageTitle } from "../components/ui";
import type { ApiResponse } from "../types";
import { formatDateTime } from "../utils/format";

interface Notification { id: string; title: string; message: string; entityType?: string; entityId?: string; readAt?: string; createdAt: string }
export function NotificationsPage() {
  const client = useQueryClient(); const query = useQuery({ queryKey: ["notifications"], queryFn: async () => (await api.get<ApiResponse<Notification[]>>("/notifications")).data.data }); const readAll = useMutation({ mutationFn: () => api.patch("/notifications/read-all"), onSuccess: () => client.invalidateQueries({ queryKey: ["notifications"] }) }); const readOne = useMutation({ mutationFn: (id: string) => api.patch(`/notifications/${id}/read`), onSuccess: () => client.invalidateQueries({ queryKey: ["notifications"] }) });
  return <><PageTitle title="Benachrichtigungen" description="Änderungen und Nachrichten zu Ihren Tickets." action={<Button variant="secondary" disabled={!query.data?.some((item) => !item.readAt)} loading={readAll.isPending} onClick={() => readAll.mutate()}><CheckCheck size={18} />Alle als gelesen markieren</Button>} />{query.isLoading ? <LoadingState /> : query.isError ? <ErrorState message={apiErrorMessage(query.error)} /> : !query.data?.length ? <EmptyState title="Keine Benachrichtigungen" description="Neue Ticketaktivitäten erscheinen hier." /> : <Card><div className="activity-list">{query.data.map((item) => { const content = <><div className="stat-icon"><Bell size={18} /></div><div className="activity-main"><strong>{item.title}{!item.readAt && <span className="badge priority-critical" style={{ marginLeft: 8 }}>Neu</span>}</strong><span>{item.message}</span></div><time>{formatDateTime(item.createdAt)}</time></>; return item.entityType === "Ticket" && item.entityId ? <Link to={`/tickets/${item.entityId}`} onClick={() => { if (!item.readAt) readOne.mutate(item.id); }} className="activity-item" key={item.id} style={{ gridTemplateColumns: "45px 1fr auto" }}>{content}</Link> : <div className="activity-item" key={item.id} style={{ gridTemplateColumns: "45px 1fr auto" }}>{content}</div>; })}</div></Card>}</>;
}
