import { useQuery } from "@tanstack/react-query";
import { api, apiErrorMessage } from "../api/client";
import { Card, EmptyState, ErrorState, LoadingState, PageTitle } from "../components/ui";
import type { PaginatedResponse } from "../types";
import { formatDateTime } from "../utils/format";
import { actionLabels, entityLabels } from "../constants/labels";

interface Audit { id: string; action: string; entityType: string; entityId?: string; ipAddress?: string; createdAt: string; user?: { firstName: string; lastName: string; email: string } }
export function AuditPage() { const query = useQuery({ queryKey: ["audit"], queryFn: async () => (await api.get<PaginatedResponse<Audit>>("/audit-logs", { params: { limit: 100 } })).data }); return <><PageTitle title="Audit-Protokoll" description="Unveränderliche Nachweise sicherheitsrelevanter und administrativer Aktionen." />{query.isLoading ? <LoadingState /> : query.isError ? <ErrorState message={apiErrorMessage(query.error)} /> : !query.data?.data.length ? <EmptyState /> : <Card><div className="table-wrap"><table className="data-table"><thead><tr><th>Zeitpunkt</th><th>Aktion</th><th>Benutzer</th><th>Entität</th><th>IP-Adresse</th></tr></thead><tbody>{query.data.data.map((item) => <tr key={item.id}><td>{formatDateTime(item.createdAt)}</td><td><strong>{actionLabels[item.action] ?? "Systemaktion"}</strong></td><td>{item.user ? `${item.user.firstName} ${item.user.lastName}` : "System"}<span className="ticket-number">{item.user?.email}</span></td><td>{entityLabels[item.entityType] ?? "Datensatz"}<span className="ticket-number">{item.entityId ?? "–"}</span></td><td>{item.ipAddress ?? "–"}</td></tr>)}</tbody></table></div></Card>}</>; }
