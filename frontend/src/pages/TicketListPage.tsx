import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, FilePlus2, Search } from "lucide-react";
import { api, apiErrorMessage } from "../api/client";
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageTitle,
  PriorityBadge,
  Select,
  StatusBadge,
} from "../components/ui";
import { priorityLabels, statusLabels } from "../constants/labels";
import { useAuth } from "../contexts/AuthContext";
import type {
  ApiResponse,
  Category,
  PaginatedResponse,
  Ticket,
} from "../types";
import { formatDateTime } from "../utils/format";

export function TicketListPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [assignedAgentId, setAssignedAgentId] = useState("");
  const [assignedTeamId, setAssignedTeamId] = useState("");
  const [source, setSource] = useState("");
  const [sla, setSla] = useState("");
  const [withAttachments, setWithAttachments] = useState("");
  const [sortBy, setSortBy] = useState("updatedAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const unassigned = searchParams.get("unassigned") === "true";
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () =>
      (await api.get<ApiResponse<Category[]>>("/categories")).data.data,
  });
  const agents = useQuery({
    queryKey: ["support-directory"],
    enabled: user?.role !== "CUSTOMER",
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
    enabled: user?.role !== "CUSTOMER",
    queryFn: async () =>
      (
        await api.get<ApiResponse<Array<{ id: string; name: string }>>>(
          "/teams",
        )
      ).data.data,
  });
  const query = useQuery({
    queryKey: [
      "tickets",
      page,
      search,
      status,
      priority,
      categoryId,
      assignedAgentId,
      assignedTeamId,
      source,
      sla,
      withAttachments,
      sortBy,
      sortOrder,
      unassigned,
    ],
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await api.get<PaginatedResponse<Ticket>>("/tickets", {
          params: {
            page,
            limit: 20,
            search: search || undefined,
            status: status || undefined,
            priority: priority || undefined,
            categoryId: categoryId || undefined,
            assignedAgentId: assignedAgentId || undefined,
            assignedTeamId: assignedTeamId || undefined,
            source: source || undefined,
            sla: sla || undefined,
            withAttachments: withAttachments || undefined,
            sortBy,
            sortOrder,
            unassigned: unassigned || undefined,
          },
        })
      ).data,
  });
  const reset = () => {
    setSearch("");
    setStatus("");
    setPriority("");
    setCategoryId("");
    setAssignedAgentId("");
    setAssignedTeamId("");
    setSource("");
    setSla("");
    setWithAttachments("");
    setSortBy("updatedAt");
    setSortOrder("desc");
    setPage(1);
  };
  return (
    <>
      <PageTitle
        title={unassigned ? "Nicht zugewiesene Tickets" : "Tickets"}
        description="Suchen, filtern und öffnen Sie Supportanfragen."
        action={
          <Link to="/tickets/neu">
            <Button>
              <FilePlus2 size={18} />
              Ticket erstellen
            </Button>
          </Link>
        }
      />
      <div className="toolbar">
        <div className="search-wrap">
          <label className="sr-only" htmlFor="ticket-search">
            Tickets durchsuchen
          </label>
          <Search size={19} />
          <input
            id="ticket-search"
            className="search-input"
            type="search"
            placeholder="Ticketnummer, Betreff, Kunde, Anhang …"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          label="Status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Alle Status</option>
          {Object.entries(statusLabels)
            .filter(([key]) => key !== "MERGED")
            .map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
        </Select>
        <Select
          label="Priorität"
          value={priority}
          onChange={(event) => {
            setPriority(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Alle Prioritäten</option>
          {Object.entries(priorityLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          label="Kategorie"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <option value="">Alle Kategorien</option>
          {categories.data?.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
        {user?.role !== "CUSTOMER" && (
          <>
            <Select
              label="Bearbeiter"
              value={assignedAgentId}
              onChange={(event) => setAssignedAgentId(event.target.value)}
            >
              <option value="">Alle Bearbeiter</option>
              {agents.data?.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.firstName} {agent.lastName}
                </option>
              ))}
            </Select>
            <Select
              label="Team"
              value={assignedTeamId}
              onChange={(event) => setAssignedTeamId(event.target.value)}
            >
              <option value="">Alle Teams</option>
              {teams.data?.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </>
        )}
        <Select
          label="Quelle"
          value={source}
          onChange={(event) => setSource(event.target.value)}
        >
          <option value="">Alle Quellen</option>
          <option value="WEB">Web</option>
          <option value="EMAIL">E-Mail</option>
          <option value="PHONE">Telefon</option>
          <option value="INTERNAL">Intern</option>
          <option value="API">API</option>
        </Select>
        <Select
          label="SLA"
          value={sla}
          onChange={(event) => setSla(event.target.value)}
        >
          <option value="">Alle SLA-Zustände</option>
          <option value="within">Im Ziel</option>
          <option value="warning">Warnung</option>
          <option value="breached">Überschritten</option>
        </Select>
        <Select
          label="Anhänge"
          value={withAttachments}
          onChange={(event) => setWithAttachments(event.target.value)}
        >
          <option value="">Alle Tickets</option>
          <option value="true">Mit Anhängen</option>
          <option value="false">Ohne Anhänge</option>
        </Select>
        <Select
          label="Sortieren nach"
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
        >
          <option value="updatedAt">Aktualisierung</option>
          <option value="createdAt">Erstellung</option>
          <option value="priority">Priorität</option>
          <option value="ticketNumber">Ticketnummer</option>
          <option value="resolutionDueAt">SLA-Frist</option>
        </Select>
        <Select
          label="Reihenfolge"
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value)}
        >
          <option value="desc">Absteigend</option>
          <option value="asc">Aufsteigend</option>
        </Select>
        <Button variant="ghost" onClick={reset}>
          Filter zurücksetzen
        </Button>
      </div>
      {query.isLoading ? (
        <LoadingState label="Tickets werden geladen …" />
      ) : query.isError ? (
        <ErrorState
          message={apiErrorMessage(query.error)}
          retry={() => void query.refetch()}
        />
      ) : !query.data?.data.length ? (
        <EmptyState
          title="Keine Tickets gefunden"
          description="Passen Sie die Filter an oder erstellen Sie eine neue Supportanfrage."
        />
      ) : (
        <>
          <div className="table-wrap ticket-table-wrap">
            <table className="data-table ticket-table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Kunde</th>
                  <th>Kategorie</th>
                  <th>Status</th>
                  <th>Priorität</th>
                  <th>Bearbeiter</th>
                  <th>Aktualisiert am</th>
                </tr>
              </thead>
              <tbody>
                {query.data.data.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <Link
                        className="ticket-subject"
                        to={`/tickets/${ticket.id}`}
                      >
                        {ticket.subject}
                      </Link>
                      <span className="ticket-number">
                        {ticket.ticketNumber}
                      </span>
                    </td>
                    <td>
                      {ticket.customer
                        ? `${ticket.customer.firstName} ${ticket.customer.lastName}`
                        : "–"}
                    </td>
                    <td>{ticket.category.name}</td>
                    <td>
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td>
                      <PriorityBadge priority={ticket.priority} />
                    </td>
                    <td>
                      {ticket.assignedAgent
                        ? `${ticket.assignedAgent.firstName} ${ticket.assignedAgent.lastName}`
                        : "Nicht zugewiesen"}
                    </td>
                    <td>{formatDateTime(ticket.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mobile-ticket-list">
              {query.data.data.map((ticket) => (
                <Link
                  className="ticket-card-link"
                  to={`/tickets/${ticket.id}`}
                  key={ticket.id}
                >
                  <article className="card">
                    <div className="ticket-card-head">
                      <div>
                        <strong>{ticket.subject}</strong>
                        <span className="ticket-number">
                          {ticket.ticketNumber}
                        </span>
                      </div>
                      <PriorityBadge priority={ticket.priority} />
                    </div>
                    <div className="ticket-card-meta">
                      <StatusBadge status={ticket.status} />
                      <span className="badge badge-neutral">
                        {ticket.category.name}
                      </span>
                    </div>
                    <div className="ticket-card-footer">
                      <span>
                        {ticket.assignedAgent
                          ? `${ticket.assignedAgent.firstName} ${ticket.assignedAgent.lastName}`
                          : "Nicht zugewiesen"}
                      </span>
                      <time>{formatDateTime(ticket.updatedAt)}</time>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </div>
          <div className="pagination">
            <span>
              Seite {query.data.pagination.page} von{" "}
              {query.data.pagination.totalPages} ·{" "}
              {query.data.pagination.totalItems} Tickets
            </span>
            <div className="pagination-actions">
              <Button
                variant="ghost"
                disabled={!query.data.pagination.hasPreviousPage}
                onClick={() => setPage((value) => value - 1)}
              >
                <ChevronLeft size={17} />
                Zurück
              </Button>
              <Button
                variant="ghost"
                disabled={!query.data.pagination.hasNextPage}
                onClick={() => setPage((value) => value + 1)}
              >
                Weiter
                <ChevronRight size={17} />
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
