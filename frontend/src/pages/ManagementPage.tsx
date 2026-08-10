import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Power } from "lucide-react";
import { api, apiErrorMessage } from "../api/client";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageTitle,
  Select,
  Textarea,
} from "../components/ui";
import { brandColors } from "../config/brand";
import type { ApiResponse } from "../types";

type Resource = "teams" | "categories" | "tags" | "sla-policies";
interface Item {
  id: string;
  name: string;
  description?: string;
  isActive?: boolean;
  color?: string;
  defaultPriority?: string;
  priority?: string;
  firstResponseMinutes?: number;
  resolutionMinutes?: number;
  memberships?: Array<{
    user: { id: string; firstName: string; lastName: string };
  }>;
  _count?: { tickets?: number };
}
const titles: Record<Resource, [string, string]> = {
  teams: [
    "Teamverwaltung",
    "Supportteams, Mitglieder und Zuständigkeiten verwalten.",
  ],
  categories: [
    "Kategorien",
    "Ticketkategorien und Standardprioritäten verwalten.",
  ],
  tags: ["Tags", "Kennzeichnungen für die Ticketorganisation verwalten."],
  "sla-policies": [
    "SLA-Richtlinien",
    "Reaktions- und Lösungsziele nach Priorität verwalten.",
  ],
};
const emptyForm = {
  name: "",
  description: "",
  color: String(brandColors.green),
  priority: "MEDIUM",
  defaultPriority: "MEDIUM",
  firstResponseMinutes: "240",
  resolutionMinutes: "4320",
  memberIds: [] as string[],
};

export function ManagementPage({ resource }: { resource: Resource }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [confirmId, setConfirmId] = useState<string>();
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(emptyForm);
  const client = useQueryClient();
  const [title, description] = titles[resource];
  const query = useQuery({
    queryKey: [resource],
    queryFn: async () =>
      (await api.get<ApiResponse<Item[]>>(`/${resource}`)).data.data,
  });
  const agents = useQuery({
    queryKey: ["support-directory"],
    enabled: resource === "teams",
    queryFn: async () =>
      (
        await api.get<
          ApiResponse<
            Array<{ id: string; firstName: string; lastName: string }>
          >
        >("/users/support-directory")
      ).data.data,
  });
  const save = useMutation({
    mutationFn: async () => {
      const base = {
        name: form.name,
        description: form.description || undefined,
      };
      const body =
        resource === "tags"
          ? { name: form.name, color: form.color }
          : resource === "categories"
            ? { ...base, defaultPriority: form.defaultPriority }
            : resource === "sla-policies"
              ? {
                  ...base,
                  priority: form.priority,
                  firstResponseMinutes: Number(form.firstResponseMinutes),
                  resolutionMinutes: Number(form.resolutionMinutes),
                }
              : {
                  ...base,
                  ...(!editingId ? { memberIds: form.memberIds } : {}),
                };
      const response = editingId
        ? await api.patch(`/${resource}/${editingId}`, body)
        : await api.post(`/${resource}`, body);
      if (editingId && resource === "teams")
        await api.put(`/teams/${editingId}/members`, {
          memberIds: form.memberIds,
        });
      return response;
    },
    onSuccess: async () => {
      setShowForm(false);
      setEditingId(undefined);
      setMessage("Der Eintrag wurde erfolgreich gespeichert.");
      setForm(emptyForm);
      await client.invalidateQueries({ queryKey: [resource] });
    },
    onError: (error) => setMessage(apiErrorMessage(error)),
  });
  const deactivate = useMutation({
    mutationFn: (id: string) => api.delete(`/${resource}/${id}`),
    onSuccess: async () => {
      setConfirmId(undefined);
      setMessage(
        resource === "tags"
          ? "Der Tag wurde gelöscht."
          : "Der Eintrag wurde deaktiviert.",
      );
      await client.invalidateQueries({ queryKey: [resource] });
    },
    onError: (error) => setMessage(apiErrorMessage(error)),
  });
  const reactivate = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/${resource}/${id}`, { isActive: true }),
    onSuccess: async () => {
      setMessage("Der Eintrag wurde reaktiviert.");
      await client.invalidateQueries({ queryKey: [resource] });
    },
    onError: (error) => setMessage(apiErrorMessage(error)),
  });
  const edit = (item: Item) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description ?? "",
      color: item.color ?? brandColors.green,
      priority: item.priority ?? "MEDIUM",
      defaultPriority: item.defaultPriority ?? "MEDIUM",
      firstResponseMinutes: String(item.firstResponseMinutes ?? 240),
      resolutionMinutes: String(item.resolutionMinutes ?? 4320),
      memberIds:
        item.memberships?.map((membership) => membership.user.id) ?? [],
    });
    setShowForm(true);
  };
  return (
    <>
      <PageTitle
        title={title}
        description={description}
        action={
          <Button
            onClick={() => {
              setEditingId(undefined);
              setForm(emptyForm);
              setShowForm(true);
            }}
          >
            <Plus size={18} />
            Neuer Eintrag
          </Button>
        }
      />
      {message && (
        <div className="warning-box" style={{ marginBottom: "1rem" }}>
          {message}
        </div>
      )}
      {showForm && (
        <Card style={{ marginBottom: "1rem" }}>
          <h2>{editingId ? "Eintrag bearbeiten" : "Eintrag anlegen"}</h2>
          <div className="form-grid">
            <Input
              label="Name *"
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
            <div className="form-span">
              <Textarea
                label="Beschreibung (optional)"
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
              />
            </div>
            {resource === "tags" && (
              <Input
                label="Farbe"
                type="color"
                value={form.color}
                onChange={(event) =>
                  setForm({ ...form, color: event.target.value })
                }
              />
            )}
            {resource === "categories" && (
              <Select
                label="Standardpriorität"
                value={form.defaultPriority}
                onChange={(event) =>
                  setForm({ ...form, defaultPriority: event.target.value })
                }
              >
                <option value="LOW">Niedrig</option>
                <option value="MEDIUM">Mittel</option>
                <option value="HIGH">Hoch</option>
                <option value="CRITICAL">Kritisch</option>
              </Select>
            )}
            {resource === "teams" && (
              <div className="form-span">
                <Select
                  label="Teammitglieder"
                  multiple
                  value={form.memberIds}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      memberIds: Array.from(
                        event.target.selectedOptions,
                        (option) => option.value,
                      ),
                    })
                  }
                >
                  {agents.data?.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.firstName} {agent.lastName}
                    </option>
                  )) ?? []}
                </Select>
              </div>
            )}
            {resource === "sla-policies" && (
              <>
                <Select
                  label="Priorität"
                  value={form.priority}
                  onChange={(event) =>
                    setForm({ ...form, priority: event.target.value })
                  }
                >
                  <option value="LOW">Niedrig</option>
                  <option value="MEDIUM">Mittel</option>
                  <option value="HIGH">Hoch</option>
                  <option value="CRITICAL">Kritisch</option>
                </Select>
                <Input
                  label="Erste Reaktion (Minuten)"
                  type="number"
                  min="1"
                  value={form.firstResponseMinutes}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      firstResponseMinutes: event.target.value,
                    })
                  }
                />
                <Input
                  label="Lösung (Minuten)"
                  type="number"
                  min="1"
                  value={form.resolutionMinutes}
                  onChange={(event) =>
                    setForm({ ...form, resolutionMinutes: event.target.value })
                  }
                />
              </>
            )}
          </div>
          <div className="form-actions">
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Abbrechen
            </Button>
            <Button
              disabled={form.name.trim().length < 2}
              loading={save.isPending}
              onClick={() => save.mutate()}
            >
              Speichern
            </Button>
          </div>
        </Card>
      )}
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message={apiErrorMessage(query.error)} />
      ) : !query.data?.length ? (
        <EmptyState />
      ) : (
        <div className="management-grid">
          {query.data.map((item) => (
            <Card className="management-item" key={item.id}>
              <div className="section-heading">
                <h3>{item.name}</h3>
                <span
                  className={`badge ${item.isActive === false ? "status-cancelled" : "status-resolved"}`}
                >
                  {item.isActive === false ? "Inaktiv" : "Aktiv"}
                </span>
              </div>
              <p>{item.description || "Keine Beschreibung hinterlegt."}</p>
              {item.color && (
                <div>
                  <span
                    className="badge"
                    style={{
                      color: item.color,
                      border: `1px solid ${item.color}`,
                    }}
                  >
                    {item.color}
                  </span>
                </div>
              )}
              {item.memberships && (
                <p>
                  {item.memberships.length
                    ? item.memberships
                        .map(
                          (entry) =>
                            `${entry.user.firstName} ${entry.user.lastName}`,
                        )
                        .join(", ")
                    : "Keine Mitglieder"}
                </p>
              )}
              <div className="management-meta">
                <span>
                  {item._count?.tickets !== undefined
                    ? `${item._count.tickets} Tickets`
                    : item.firstResponseMinutes
                      ? `Reaktion: ${item.firstResponseMinutes} Min.`
                      : (item.defaultPriority ??
                        item.priority ??
                        "Stammdatensatz")}
                </span>
                <div style={{ display: "flex", gap: ".4rem" }}>
                  <Button variant="ghost" onClick={() => edit(item)}>
                    <Pencil size={16} />
                    Bearbeiten
                  </Button>
                  {item.isActive === false ? (
                    <Button
                      variant="secondary"
                      onClick={() => reactivate.mutate(item.id)}
                    >
                      Reaktivieren
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      onClick={() => setConfirmId(item.id)}
                    >
                      <Power size={16} />
                      {resource === "tags" ? "Löschen" : "Deaktivieren"}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(confirmId)}
        title={resource === "tags" ? "Tag löschen" : "Eintrag deaktivieren"}
        description={
          resource === "tags"
            ? "Der Tag wird aus der Verwaltung entfernt."
            : "Der Eintrag wird deaktiviert und steht für neue Zuordnungen nicht mehr zur Verfügung."
        }
        confirmLabel={resource === "tags" ? "Löschen" : "Deaktivieren"}
        danger
        loading={deactivate.isPending}
        onCancel={() => setConfirmId(undefined)}
        onConfirm={() => confirmId && deactivate.mutate(confirmId)}
      />
    </>
  );
}
