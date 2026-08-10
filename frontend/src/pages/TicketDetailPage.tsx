import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link2,
  MessageSquare,
  Paperclip,
  Send,
  ShieldCheck,
  Star,
  UserCheck,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { api, apiErrorMessage } from "../api/client";
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  Input,
  LoadingState,
  PriorityBadge,
  Select,
  StatusBadge,
  Textarea,
} from "../components/ui";
import { FileUpload } from "../components/FileUpload";
import {
  priorityLabels,
  actionLabels,
  roleLabels,
  sourceLabels,
  statusLabels,
} from "../constants/labels";
import { useAuth } from "../contexts/AuthContext";
import type {
  ApiResponse,
  Attachment,
  Comment,
  Ticket,
  TicketPriority,
  TicketStatus,
} from "../types";
import { formatDateTime, formatFileSize } from "../utils/format";

const transitions: Partial<Record<TicketStatus, TicketStatus[]>> = {
  NEW: ["OPEN", "ASSIGNED"],
  OPEN: ["ASSIGNED", "IN_PROGRESS"],
  ASSIGNED: ["IN_PROGRESS", "OPEN"],
  IN_PROGRESS: ["WAITING_FOR_CUSTOMER", "WAITING_FOR_THIRD_PARTY", "RESOLVED"],
  WAITING_FOR_CUSTOMER: ["IN_PROGRESS", "RESOLVED"],
  WAITING_FOR_THIRD_PARTY: ["IN_PROGRESS", "RESOLVED"],
  RESOLVED: ["CLOSED", "OPEN"],
  CLOSED: ["OPEN"],
  CANCELLED: ["OPEN"],
};

export function TicketDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const client = useQueryClient();
  const [comment, setComment] = useState("");
  const [internal, setInternal] = useState(false);
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [editingCommentId, setEditingCommentId] = useState<string>();
  const [commentEdit, setCommentEdit] = useState("");
  const [deleteCommentId, setDeleteCommentId] = useState<string>();
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [editingLinkId, setEditingLinkId] = useState<string>();
  const [deleteLinkId, setDeleteLinkId] = useState<string>();
  const [linkForm, setLinkForm] = useState({ url: "", title: "", description: "" });
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [editDraft, setEditDraft] = useState(false);
  const [draft, setDraft] = useState({ subject: "", description: "" });
  const [deleteDraft, setDeleteDraft] = useState(false);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [tagToAdd, setTagToAdd] = useState("");
  const [pendingStatus, setPendingStatus] = useState<TicketStatus>();
  const query = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () =>
      (await api.get<ApiResponse<Ticket>>(`/tickets/${id}`)).data.data,
  });
  const directory = useQuery({
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
        await api.get<
          ApiResponse<Array<{ id: string; name: string; isActive: boolean }>>
        >("/teams")
      ).data.data.filter((team) => team.isActive),
  });
  const tags = useQuery({ queryKey: ["tags"], enabled: user?.role !== "CUSTOMER", queryFn: async () => (await api.get<ApiResponse<Array<{ id: string; name: string; color: string }>>>("/tags")).data.data });
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["ticket", id] });
    await client.invalidateQueries({ queryKey: ["tickets"] });
  };
  const action = useMutation({
    mutationFn: async ({ path, body }: { path: string; body: object }) =>
      api.patch(path, body),
    onSuccess: async (response) => {
      setMessage(response.data.message);
      await refresh();
    },
    onError: (error) => setMessage(apiErrorMessage(error)),
  });
  const addComment = useMutation({
    mutationFn: async () => {
      const response = await api.post<ApiResponse<Comment>>(
        `/tickets/${id}/comments`,
        { content: comment, isInternal: internal },
      );
      if (commentFiles.length) {
        const formData = new FormData();
        commentFiles.forEach((file) => formData.append("files", file));
        formData.append("visibility", internal ? "INTERNAL" : "PUBLIC");
        await api.post(
          `/tickets/${id}/comments/${response.data.data.id}/attachments`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: (event) =>
              setProgress(
                event.total
                  ? Math.round((event.loaded / event.total) * 100)
                  : 0,
              ),
          },
        );
      }
      return response;
    },
    onSuccess: async () => {
      setComment("");
      setCommentFiles([]);
      setProgress(0);
      setInternal(false);
      setMessage("Die Nachricht wurde gespeichert.");
      await refresh();
    },
    onError: (error) => setMessage(apiErrorMessage(error)),
  });
  const saveLink = useMutation({
    mutationFn: () => editingLinkId ? api.patch(`/tickets/${id}/links/${editingLinkId}`, linkForm) : api.post(`/tickets/${id}/links`, linkForm),
    onSuccess: async () => { setShowLinkForm(false); setEditingLinkId(undefined); setLinkForm({ url: "", title: "", description: "" }); setMessage("Der Link wurde gespeichert."); await refresh(); },
    onError: (error) => setMessage(apiErrorMessage(error)),
  });
  const download = async (attachment: Attachment, preview = false) => {
    try {
      const response = await api.get(
        `/attachments/${attachment.id}/${preview ? "preview" : "download"}`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(response.data as Blob);
      if (preview) window.open(url, "_blank", "noopener,noreferrer");
      else {
        const link = document.createElement("a");
        link.href = url;
        link.download = attachment.originalName;
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      setMessage(apiErrorMessage(error));
    }
  };
  if (query.isLoading)
    return <LoadingState label="Ticketdetails werden geladen …" />;
  if (query.isError || !query.data)
    return (
      <ErrorState
        message={apiErrorMessage(query.error)}
        retry={() => void query.refetch()}
      />
    );
  const ticket = query.data;
  const isStaff = user?.role !== "CUSTOMER";
  const possible = transitions[ticket.status] ?? [];
  const customerPossible = possible.filter(
    (status) => status === "OPEN" || status === "CLOSED",
  );
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">{ticket.ticketNumber}</span>
          <h1>{ticket.subject}</h1>
          <p>
            Erstellt am {formatDateTime(ticket.createdAt)} · zuletzt
            aktualisiert am {formatDateTime(ticket.updatedAt)}
          </p>
        </div>
        <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
        </div>
      </div>
      {message && (
        <div
          className={
            message.includes("nicht") || message.includes("Fehler")
              ? "form-alert"
              : "warning-box"
          }
          role="status"
          style={{ marginBottom: "1rem" }}
        >
          {message}
        </div>
      )}
      <div className="detail-grid">
        <div className="detail-main">
          <Card>
            <div className="section-heading">
              <h2>Problembeschreibung</h2>
              {ticket.status === "DRAFT" && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDraft({
                      subject: ticket.subject,
                      description: ticket.description,
                    });
                    setEditDraft(true);
                  }}
                >
                  Entwurf bearbeiten
                </Button>
              )}
            </div>
            {editDraft ? (
              <div className="auth-form">
                <Input
                  label="Betreff"
                  value={draft.subject}
                  onChange={(event) =>
                    setDraft({ ...draft, subject: event.target.value })
                  }
                />
                <Textarea
                  label="Beschreibung"
                  value={draft.description}
                  onChange={(event) =>
                    setDraft({ ...draft, description: event.target.value })
                  }
                />
                <div className="form-actions">
                  <Button variant="ghost" onClick={() => setEditDraft(false)}>
                    Abbrechen
                  </Button>
                  <Button
                    onClick={() =>
                      action.mutate(
                        { path: `/tickets/${id}`, body: draft },
                        { onSuccess: () => setEditDraft(false) },
                      )
                    }
                  >
                    Speichern
                  </Button>
                </div>
              </div>
            ) : (
              <p className="prose">{ticket.description}</p>
            )}
          </Card>
          <Card>
            <div className="section-heading">
              <h2><Link2 size={19} style={{ display: "inline", marginRight: 8 }} />Links</h2>
              <Button variant="ghost" onClick={() => { setEditingLinkId(undefined); setLinkForm({ url: "", title: "", description: "" }); setShowLinkForm(true); }}>Link hinzufügen</Button>
            </div>
            {showLinkForm && <div className="auth-form" style={{ marginBottom: "1rem" }}><Input label="Webadresse" type="url" value={linkForm.url} onChange={(event) => setLinkForm({ ...linkForm, url: event.target.value })} /><Input label="Titel (optional)" value={linkForm.title} onChange={(event) => setLinkForm({ ...linkForm, title: event.target.value })} /><Textarea label="Beschreibung (optional)" value={linkForm.description} onChange={(event) => setLinkForm({ ...linkForm, description: event.target.value })} /><div className="form-actions"><Button variant="ghost" onClick={() => setShowLinkForm(false)}>Abbrechen</Button><Button loading={saveLink.isPending} disabled={!/^https?:\/\//i.test(linkForm.url)} onClick={() => saveLink.mutate()}>Link speichern</Button></div></div>}
            <div className="attachment-list">
              {ticket.links?.length ? ticket.links.map((link) => (
                <div className="attachment-item" key={link.id}>
                  <div className="attachment-info"><a className="text-link" href={link.url} target="_blank" rel="noopener noreferrer">{link.title || new URL(link.url).hostname}</a><small>{new URL(link.url).hostname}{link.description ? ` · ${link.description}` : ""}</small></div>
                  {(link.createdById === user?.id || user?.role === "ADMIN") && <div className="form-actions"><Button variant="ghost" onClick={() => { setEditingLinkId(link.id); setLinkForm({ url: link.url, title: link.title ?? "", description: link.description ?? "" }); setShowLinkForm(true); }}>Bearbeiten</Button><Button variant="danger" onClick={() => setDeleteLinkId(link.id)}>Löschen</Button></div>}
                </div>
              )) : <p>Noch keine Links hinterlegt.</p>}
            </div>
          </Card>
          {ticket.attachments?.length ? (
            <Card>
              <h2>
                <Paperclip
                  size={19}
                  style={{ display: "inline", marginRight: 8 }}
                />
                Anhänge ({ticket.attachments.length})
              </h2>
              <div className="attachment-list">
                {ticket.attachments.map((attachment) => (
                  <div className="attachment-item" key={attachment.id}>
                    <div className="attachment-info">
                      <strong>{attachment.originalName}</strong>
                      <small>
                        {formatFileSize(attachment.fileSize)} ·{" "}
                        {attachment.visibility === "INTERNAL"
                          ? "Intern"
                          : "Öffentlich"}{" "}
                        · Scan:{" "}
                        {attachment.scanStatus === "CLEAN"
                          ? "Sauber"
                          : "Nicht verfügbar"}
                      </small>
                    </div>
                    <div style={{ display: "flex", gap: ".4rem" }}>
                      {["IMAGE", "LOG"].includes(attachment.attachmentType) && (
                        <Button
                          variant="ghost"
                          onClick={() => void download(attachment, true)}
                        >
                          Vorschau
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        onClick={() => void download(attachment)}
                      >
                        Herunterladen
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
          <Card>
            <h2>
              <MessageSquare
                size={19}
                style={{ display: "inline", marginRight: 8 }}
              />
              Kommunikation
            </h2>
            <div className="timeline">
              {ticket.comments?.length ? (
                ticket.comments.map((item) => (
                  <article className="timeline-item" key={item.id}>
                    <div className="timeline-avatar" aria-hidden="true">
                      {item.author.firstName[0]}
                      {item.author.lastName[0]}
                    </div>
                    <div
                      className={`comment-box ${item.isInternal ? "internal" : ""}`}
                    >
                      <div className="comment-head">
                        <div>
                          <strong>
                            {item.author.firstName} {item.author.lastName}
                          </strong>{" "}
                          <span className="badge badge-neutral">
                            {roleLabels[item.author.role]}
                          </span>
                        </div>
                        <small>
                          {formatDateTime(item.createdAt)}
                          {new Date(item.updatedAt).getTime() -
                            new Date(item.createdAt).getTime() >
                          1000
                            ? " · bearbeitet"
                            : ""}
                        </small>
                      </div>
                      {editingCommentId === item.id ? <div className="auth-form"><Textarea label="Kommentar bearbeiten" value={commentEdit} onChange={(event) => setCommentEdit(event.target.value)} /><div className="form-actions"><Button variant="ghost" onClick={() => setEditingCommentId(undefined)}>Abbrechen</Button><Button disabled={commentEdit.trim().length < 2} onClick={() => api.patch(`/tickets/${id}/comments/${item.id}`, { content: commentEdit }).then(async () => { setEditingCommentId(undefined); setMessage("Der Kommentar wurde bearbeitet."); await refresh(); }).catch((error) => setMessage(apiErrorMessage(error)))}>Speichern</Button></div></div> : <p className="comment-content">{item.content}</p>}
                      {item.attachments?.length ? (
                        <div
                          className="attachment-list"
                          style={{ marginTop: ".7rem" }}
                        >
                          {item.attachments.map((attachment) => (
                            <div
                              className="attachment-item"
                              key={attachment.id}
                            >
                              <span>{attachment.originalName}</span>
                              <Button
                                variant="ghost"
                                onClick={() => void download(attachment)}
                              >
                                Herunterladen
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {item.isInternal && (
                        <div className="comment-label">
                          <ShieldCheck
                            size={14}
                            style={{ display: "inline" }}
                          />{" "}
                          Nur intern sichtbar
                        </div>
                      )}
                      {(item.author.id === user?.id || user?.role === "ADMIN") && editingCommentId !== item.id && <div className="form-actions"><Button variant="ghost" onClick={() => { setEditingCommentId(item.id); setCommentEdit(item.content); }}>Bearbeiten</Button><Button variant="danger" onClick={() => setDeleteCommentId(item.id)}>Löschen</Button></div>}
                    </div>
                  </article>
                ))
              ) : (
                <p>Noch keine Nachrichten vorhanden.</p>
              )}
            </div>
          </Card>
          {ticket.status !== "DRAFT" && (
            <Card>
              <h2>Antwort verfassen</h2>
              <div className="composer">
                <Textarea
                  label={internal ? "Interne Notiz" : "Öffentliche Antwort"}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder={
                    internal
                      ? "Technische Notiz für das Supportteam …"
                      : "Ihre Nachricht …"
                  }
                />
                {isStaff && (
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={internal}
                      onChange={(event) => setInternal(event.target.checked)}
                    />
                    <span>
                      Als interne Notiz speichern (für Kunden nicht sichtbar)
                    </span>
                  </label>
                )}
                <FileUpload
                  files={commentFiles}
                  onChange={setCommentFiles}
                  progress={progress}
                  label="Dateien zur Antwort auswählen"
                />
                <div className="form-actions">
                  <Button
                    disabled={comment.trim().length < 2}
                    loading={addComment.isPending}
                    onClick={() => addComment.mutate()}
                  >
                    <Send size={17} />
                    {internal ? "Notiz speichern" : "Antwort senden"}
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
        <aside className="detail-side">
          <Card>
            <h2>Ticketinformationen</h2>
            <div className="meta-list">
              <div className="meta-row">
                <span>Status</span>
                <StatusBadge status={ticket.status} />
              </div>
              <div className="meta-row">
                <span>Priorität</span>
                <PriorityBadge priority={ticket.priority} />
              </div>
              <div className="meta-row">
                <span>Kategorie</span>
                <strong>{ticket.category.name}</strong>
              </div>
              <div className="meta-row"><span>Tags</span><div style={{ display: "flex", gap: ".35rem", flexWrap: "wrap", justifyContent: "flex-end" }}>{ticket.tags?.length ? ticket.tags.map(({ tag }) => <span className="badge" key={tag.id} style={{ color: tag.color, border: `1px solid ${tag.color}` }}>{tag.name}{isStaff && <button className="tag-remove" aria-label={`${tag.name} entfernen`} onClick={() => api.delete(`/tickets/${id}/tags/${tag.id}`).then(() => refresh()).catch((error) => setMessage(apiErrorMessage(error)))}>×</button>}</span>) : <strong>–</strong>}</div></div>
              <div className="meta-row">
                <span>Quelle</span>
                <strong>{sourceLabels[ticket.source] ?? ticket.source}</strong>
              </div>
              <div className="meta-row">
                <span>Bearbeiter</span>
                <strong>
                  {ticket.assignedAgent
                    ? `${ticket.assignedAgent.firstName} ${ticket.assignedAgent.lastName}`
                    : "Nicht zugewiesen"}
                </strong>
              </div>
              <div className="meta-row">
                <span>Team</span>
                <strong>{ticket.assignedTeam?.name ?? "–"}</strong>
              </div>
              {ticket.customer && (
                <>
                  <div className="meta-row">
                    <span>Kunde</span>
                    <strong>
                      {ticket.customer.firstName} {ticket.customer.lastName}
                    </strong>
                  </div>
                  <div className="meta-row">
                    <span>E-Mail</span>
                    <strong>{ticket.customer.email}</strong>
                  </div>
                </>
              )}
            </div>
          </Card>
          <Card className="sla-panel">
            <h2>SLA-Ziele</h2>
            <div className="meta-list">
              <div className="meta-row">
                <span>Erste Reaktion</span>
                <strong>{formatDateTime(ticket.firstResponseDueAt)}</strong>
              </div>
              <div className="meta-row">
                <span>Lösung</span>
                <strong>{formatDateTime(ticket.resolutionDueAt)}</strong>
              </div>
              <div className="meta-row">
                <span>SLA-Status</span>
                <strong>
                  {ticket.resolutionDueAt &&
                  new Date(ticket.resolutionDueAt) < new Date() &&
                  !ticket.resolvedAt
                    ? "Überschritten"
                    : "Im Ziel"}
                </strong>
              </div>
            </div>
          </Card>
          <Card>
            <h2>Aktionen</h2>
            <div className="composer">
              {ticket.status === "DRAFT" ? (
                <>
                  <Button
                    onClick={() =>
                      api
                        .post(`/tickets/${id}/submit`)
                        .then(() => refresh())
                        .catch((error) => setMessage(apiErrorMessage(error)))
                    }
                  >
                    Entwurf einreichen
                  </Button>
                  <Button variant="danger" onClick={() => setDeleteDraft(true)}>
                    Entwurf löschen
                  </Button>
                </>
              ) : (
                <>
                  {isStaff && !ticket.assignedAgent && (
                    <Button
                      variant="secondary"
                      loading={action.isPending}
                      onClick={() =>
                        action.mutate({
                          path: `/tickets/${id}/assign`,
                          body: {},
                        })
                      }
                    >
                      <UserCheck size={17} />
                      Mir zuweisen
                    </Button>
                  )}
                  {isStaff && (
                    <>
                      <div className="composer-options"><Select label="Tag hinzufügen" value={tagToAdd} onChange={(event) => setTagToAdd(event.target.value)}><option value="">Tag wählen</option>{tags.data?.filter((tag) => !ticket.tags?.some((entry) => entry.tag.id === tag.id)).map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</Select><Button disabled={!tagToAdd} onClick={() => api.post(`/tickets/${id}/tags/${tagToAdd}`).then(async () => { setTagToAdd(""); await refresh(); }).catch((error) => setMessage(apiErrorMessage(error)))}>Hinzufügen</Button></div>
                      <Select
                        label="Bearbeiter zuweisen"
                        value={ticket.assignedAgent?.id ?? ""}
                        onChange={(event) =>
                          action.mutate({
                            path: `/tickets/${id}/assign`,
                            body: {
                              assignedAgentId: event.target.value || null,
                            },
                          })
                        }
                      >
                        <option value="">Keine Person</option>
                        {directory.data?.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.firstName} {agent.lastName}
                          </option>
                        ))}
                      </Select>
                      <Select
                        label="Supportteam zuweisen"
                        value={ticket.assignedTeam?.id ?? ""}
                        onChange={(event) =>
                          action.mutate({
                            path: `/tickets/${id}/assign`,
                            body: {
                              assignedTeamId: event.target.value || null,
                            },
                          })
                        }
                      >
                        <option value="">Kein Team</option>
                        {teams.data?.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </Select>
                      <Select
                        label="Priorität ändern"
                        value={ticket.priority}
                        onChange={(event) =>
                          action.mutate({
                            path: `/tickets/${id}/priority`,
                            body: {
                              priority: event.target.value as TicketPriority,
                            },
                          })
                        }
                      >
                        {Object.entries(priorityLabels).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </Select>
                    </>
                  )}
                  <Select
                    label="Status ändern"
                    value=""
                    disabled={
                      action.isPending ||
                      (isStaff ? possible : customerPossible).length === 0
                    }
                    onChange={(event) =>
                      event.target.value && (["CLOSED", "OPEN"].includes(event.target.value) ? setPendingStatus(event.target.value as TicketStatus) : action.mutate({ path: `/tickets/${id}/status`, body: { status: event.target.value as TicketStatus } }))
                    }
                  >
                    <option value="">Aktion wählen</option>
                    {(isStaff ? possible : customerPossible).map((value) => (
                      <option key={value} value={value}>
                        {statusLabels[value]}
                      </option>
                    ))}
                  </Select>
                  {user?.role === "CUSTOMER" &&
                    ["RESOLVED", "CLOSED"].includes(ticket.status) &&
                    !ticket.customerRating && (
                      <div className="auth-form">
                        <Select
                          label="Zufriedenheit"
                          value={rating}
                          onChange={(event) =>
                            setRating(Number(event.target.value))
                          }
                        >
                          {[5, 4, 3, 2, 1].map((value) => (
                            <option key={value} value={value}>
                              {value} Sterne
                            </option>
                          ))}
                        </Select>
                        <Textarea
                          label="Feedback (optional)"
                          value={feedback}
                          onChange={(event) => setFeedback(event.target.value)}
                        />
                        <Button
                          onClick={() =>
                            api
                              .post(`/tickets/${id}/rating`, {
                                rating,
                                feedback: feedback || undefined,
                              })
                              .then(() => refresh())
                              .catch((error) =>
                                setMessage(apiErrorMessage(error)),
                              )
                          }
                        >
                          <Star size={17} />
                          Bewertung senden
                        </Button>
                      </div>
                    )}
                </>
              )}
            </div>
          </Card>
          {ticket.history?.length ? (
            <Card>
              <h2>Ticketverlauf</h2>
              <div className="activity-list">
                {ticket.history.slice(0, 12).map((entry) => (
                  <div className="activity-item" key={entry.id}>
                    <div className="activity-main">
                      <strong>
                        {entry.action === "STATUS_CHANGED"
                          ? `Status: ${entry.oldValue ? statusLabels[entry.oldValue] : "–"} → ${entry.newValue ? statusLabels[entry.newValue] : "–"}`
                          : entry.action === "TICKET_CREATED"
                            ? "Ticket erstellt"
                            : actionLabels[entry.action] ?? "Ticket aktualisiert"}
                      </strong>
                      <span>
                        {entry.changedBy.firstName} {entry.changedBy.lastName}
                      </span>
                    </div>
                    <time>{formatDateTime(entry.createdAt)}</time>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </aside>
      </div>
      <ConfirmDialog
        open={deleteDraft}
        title="Entwurf löschen"
        description="Der Ticketentwurf und seine Anhänge werden dauerhaft gelöscht."
        confirmLabel="Entwurf löschen"
        danger
        onCancel={() => setDeleteDraft(false)}
        onConfirm={() =>
          api
            .delete(`/tickets/${id}`)
            .then(() => navigate("/tickets"))
            .catch((error) => setMessage(apiErrorMessage(error)))
        }
      />
      <ConfirmDialog open={Boolean(deleteCommentId)} title="Kommentar löschen" description="Der Kommentar wird revisionssicher ausgeblendet; der Vorgang bleibt im Ticketverlauf erhalten." confirmLabel="Kommentar löschen" danger onCancel={() => setDeleteCommentId(undefined)} onConfirm={() => deleteCommentId && api.delete(`/tickets/${id}/comments/${deleteCommentId}`).then(async () => { setDeleteCommentId(undefined); setMessage("Der Kommentar wurde gelöscht."); await refresh(); }).catch((error) => setMessage(apiErrorMessage(error)))} />
      <ConfirmDialog open={Boolean(deleteLinkId)} title="Link löschen" description="Der Link wird aus diesem Ticket entfernt." confirmLabel="Link löschen" danger onCancel={() => setDeleteLinkId(undefined)} onConfirm={() => deleteLinkId && api.delete(`/tickets/${id}/links/${deleteLinkId}`).then(async () => { setDeleteLinkId(undefined); setMessage("Der Link wurde gelöscht."); await refresh(); }).catch((error) => setMessage(apiErrorMessage(error)))} />
      <ConfirmDialog open={Boolean(pendingStatus)} title={pendingStatus === "CLOSED" ? "Ticket schließen" : "Ticket wieder öffnen"} description={pendingStatus === "CLOSED" ? "Das Ticket wird geschlossen. Der Kunde kann es bei Bedarf erneut öffnen." : "Das Ticket wird wieder in die aktive Bearbeitung aufgenommen."} confirmLabel={pendingStatus === "CLOSED" ? "Ticket schließen" : "Wieder öffnen"} onCancel={() => setPendingStatus(undefined)} onConfirm={() => pendingStatus && action.mutate({ path: `/tickets/${id}/status`, body: { status: pendingStatus } }, { onSuccess: () => setPendingStatus(undefined) })} />
    </>
  );
}
