import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, UserPlus } from "lucide-react";
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
  RoleBadge,
  Select,
} from "../components/ui";
import type { ApiResponse, User, UserRole } from "../types";
import { formatDateTime } from "../utils/format";

type UserRow = User & {
  memberships: Array<{ teamId: string; team: { name: string } }>;
  _count: { customerTickets: number; assignedTickets: number };
};
type Team = { id: string; name: string; isActive: boolean };
const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  phone: "",
  company: "",
  department: "",
  position: "",
  role: "CUSTOMER" as UserRole,
  teamIds: [] as string[],
};

export function UserManagementPage() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<UserRow>();
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", phone: "", company: "", department: "", position: "", teamIds: [] as string[] });
  const [passwordUser, setPasswordUser] = useState<UserRow>();
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState<{
    id: string;
    active: boolean;
    name: string;
  } | null>(null);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["users", search, role],
    queryFn: async () =>
      (
        await api.get<ApiResponse<UserRow[]>>("/users", {
          params: { search: search || undefined, role: role || undefined },
        })
      ).data.data,
  });
  const teams = useQuery({
    queryKey: ["teams"],
    queryFn: async () =>
      (await api.get<ApiResponse<Team[]>>("/teams")).data.data.filter(
        (team) => team.isActive,
      ),
  });
  const create = useMutation({
    mutationFn: () =>
      api.post("/users", {
        ...form,
        teamIds: form.role === "CUSTOMER" ? [] : form.teamIds,
      }),
    onSuccess: async (response) => {
      setMessage(response.data.message);
      setForm(emptyForm);
      setShowForm(false);
      await client.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => setMessage(apiErrorMessage(error)),
  });
  const update = useMutation({
    mutationFn: ({
      id,
      path,
      body,
    }: {
      id: string;
      path: string;
      body: object;
    }) => api.patch(`/users/${id}/${path}`, body),
    onSuccess: async (response) => {
      setMessage(response.data.message);
      setConfirmation(null);
      await client.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      setMessage(apiErrorMessage(error));
      setConfirmation(null);
    },
  });
  const saveEdit = useMutation({ mutationFn: async () => { if (!editing) return; const { teamIds, ...profile } = editForm; await api.patch(`/users/${editing.id}`, profile); await api.put(`/users/${editing.id}/teams`, { teamIds: editing.role === "CUSTOMER" ? [] : teamIds }); }, onSuccess: async () => { setEditing(undefined); setMessage("Der Benutzer wurde aktualisiert."); await client.invalidateQueries({ queryKey: ["users"] }); }, onError: (error) => setMessage(apiErrorMessage(error)) });
  const resetPassword = useMutation({ mutationFn: () => api.post(`/users/${passwordUser!.id}/reset-password`, { password: newPassword }), onSuccess: () => { setPasswordUser(undefined); setNewPassword(""); setMessage("Das Passwort wurde zurückgesetzt."); }, onError: (error) => setMessage(apiErrorMessage(error)) });
  return (
    <>
      <PageTitle
        title="Benutzerverwaltung"
        description="Konten, Rollen und Zugriffsstatus zentral verwalten."
        action={
          <Button onClick={() => setShowForm((value) => !value)}>
            <UserPlus size={18} />
            Benutzer anlegen
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
          <h2>Benutzerkonto anlegen</h2>
          <div className="form-grid">
            <Input
              label="Vorname *"
              value={form.firstName}
              onChange={(event) =>
                setForm({ ...form, firstName: event.target.value })
              }
            />
            <Input
              label="Nachname *"
              value={form.lastName}
              onChange={(event) =>
                setForm({ ...form, lastName: event.target.value })
              }
            />
            <Input
              label="E-Mail-Adresse *"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
            />
            <Input
              label="Startpasswort *"
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm({ ...form, password: event.target.value })
              }
            />
            <Input
              label="Telefon"
              value={form.phone}
              onChange={(event) =>
                setForm({ ...form, phone: event.target.value })
              }
            />
            <Input
              label="Firma"
              value={form.company}
              onChange={(event) =>
                setForm({ ...form, company: event.target.value })
              }
            />
            <Input
              label="Abteilung"
              value={form.department}
              onChange={(event) =>
                setForm({ ...form, department: event.target.value })
              }
            />
            <Input
              label="Position"
              value={form.position}
              onChange={(event) =>
                setForm({ ...form, position: event.target.value })
              }
            />
            <Select
              label="Rolle"
              value={form.role}
              onChange={(event) =>
                setForm({
                  ...form,
                  role: event.target.value as UserRole,
                  teamIds:
                    event.target.value === "CUSTOMER" ? [] : form.teamIds,
                })
              }
            >
              <option value="CUSTOMER">Kunde</option>
              <option value="AGENT">Supportmitarbeiter</option>
              <option value="ADMIN">Administrator</option>
            </Select>
            {form.role !== "CUSTOMER" && (
              <Select
                label="Teams"
                multiple
                value={form.teamIds}
                onChange={(event) =>
                  setForm({
                    ...form,
                    teamIds: Array.from(
                      event.target.selectedOptions,
                      (option) => option.value,
                    ),
                  })
                }
              >
                {teams.data?.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                )) ?? []}
              </Select>
            )}
          </div>
          <div className="form-actions">
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Abbrechen
            </Button>
            <Button
              loading={create.isPending}
              disabled={
                form.firstName.length < 2 ||
                form.lastName.length < 2 ||
                !form.email ||
                form.password.length < 10
              }
              onClick={() => create.mutate()}
            >
              Benutzer speichern
            </Button>
          </div>
        </Card>
      )}
      {editing && <Card style={{ marginBottom: "1rem" }}><h2>Benutzer bearbeiten: {editing.firstName} {editing.lastName}</h2><div className="form-grid"><Input label="Vorname" value={editForm.firstName} onChange={(event) => setEditForm({ ...editForm, firstName: event.target.value })} /><Input label="Nachname" value={editForm.lastName} onChange={(event) => setEditForm({ ...editForm, lastName: event.target.value })} /><Input label="Telefon" value={editForm.phone} onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })} /><Input label="Firma" value={editForm.company} onChange={(event) => setEditForm({ ...editForm, company: event.target.value })} /><Input label="Abteilung" value={editForm.department} onChange={(event) => setEditForm({ ...editForm, department: event.target.value })} /><Input label="Position" value={editForm.position} onChange={(event) => setEditForm({ ...editForm, position: event.target.value })} />{editing.role !== "CUSTOMER" && <div className="form-span"><Select label="Teams" multiple value={editForm.teamIds} onChange={(event) => setEditForm({ ...editForm, teamIds: Array.from(event.target.selectedOptions, (option) => option.value) })}>{teams.data?.map((team) => <option key={team.id} value={team.id}>{team.name}</option>) ?? []}</Select></div>}</div><div className="form-actions"><Button variant="ghost" onClick={() => setEditing(undefined)}>Abbrechen</Button><Button loading={saveEdit.isPending} onClick={() => saveEdit.mutate()}>Änderungen speichern</Button></div></Card>}
      {passwordUser && <Card style={{ marginBottom: "1rem" }}><h2>Passwort zurücksetzen: {passwordUser.firstName} {passwordUser.lastName}</h2><div className="auth-form"><Input label="Neues Startpasswort" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><div className="form-actions"><Button variant="ghost" onClick={() => setPasswordUser(undefined)}>Abbrechen</Button><Button loading={resetPassword.isPending} disabled={newPassword.length < 10} onClick={() => resetPassword.mutate()}>Passwort zurücksetzen</Button></div></div></Card>}
      <div className="toolbar">
        <div className="search-wrap">
          <Search size={19} />
          <input
            className="search-input"
            aria-label="Benutzer suchen"
            placeholder="Name oder E-Mail-Adresse …"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select
          label="Rolle"
          value={role}
          onChange={(event) => setRole(event.target.value)}
        >
          <option value="">Alle Rollen</option>
          <option value="CUSTOMER">Kunden</option>
          <option value="AGENT">Supportmitarbeitende</option>
          <option value="ADMIN">Administratoren</option>
        </Select>
      </div>
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message={apiErrorMessage(query.error)} />
      ) : !query.data?.length ? (
        <EmptyState />
      ) : (
        <Card>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Benutzer</th>
                  <th>Rolle</th>
                  <th>Status</th>
                  <th>Tickets</th>
                  <th>Letzte Anmeldung</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {query.data.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>
                        {item.firstName} {item.lastName}
                      </strong>
                      <span className="ticket-number">{item.email}</span>
                    </td>
                    <td>
                      <RoleBadge role={item.role} />
                    </td>
                    <td>
                      <span
                        className={`badge ${item.isActive ? "status-resolved" : "status-cancelled"}`}
                      >
                        {item.isActive ? "Aktiv" : "Deaktiviert"}
                      </span>
                    </td>
                    <td>
                      {item._count.customerTickets +
                        item._count.assignedTickets}
                    </td>
                    <td>{formatDateTime(item.lastLoginAt)}</td>
                    <td>
                      <div style={{ display: "flex", gap: ".5rem" }}>
                        <Button variant="ghost" onClick={() => { setEditing(item); setEditForm({ firstName: item.firstName, lastName: item.lastName, phone: item.phone ?? "", company: item.company ?? "", department: item.department ?? "", position: item.position ?? "", teamIds: item.memberships.map((membership) => membership.teamId) }); }}>Bearbeiten</Button>
                        <Button variant="ghost" onClick={() => { setPasswordUser(item); setNewPassword(""); }}>Passwort</Button>
                        <Select
                          aria-label="Rolle ändern"
                          label=""
                          value={item.role}
                          onChange={(event) =>
                            update.mutate({
                              id: item.id,
                              path: "role",
                              body: { role: event.target.value as UserRole },
                            })
                          }
                        >
                          <option value="CUSTOMER">Kunde</option>
                          <option value="AGENT">Support</option>
                          <option value="ADMIN">Administrator</option>
                        </Select>
                        <Button
                          variant={item.isActive ? "danger" : "secondary"}
                          onClick={() =>
                            setConfirmation({
                              id: item.id,
                              active: item.isActive,
                              name: `${item.firstName} ${item.lastName}`,
                            })
                          }
                        >
                          {item.isActive ? "Deaktivieren" : "Reaktivieren"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <ConfirmDialog
        open={Boolean(confirmation)}
        title={
          confirmation?.active
            ? "Benutzer deaktivieren"
            : "Benutzer reaktivieren"
        }
        description={`${confirmation?.name ?? "Dieses Konto"} wird ${confirmation?.active ? "deaktiviert und kann sich nicht mehr anmelden" : "wieder aktiviert"}.`}
        confirmLabel={confirmation?.active ? "Deaktivieren" : "Reaktivieren"}
        danger={confirmation?.active}
        loading={update.isPending}
        onCancel={() => setConfirmation(null)}
        onConfirm={() =>
          confirmation &&
          update.mutate({
            id: confirmation.id,
            path: "status",
            body: { isActive: !confirmation.active },
          })
        }
      />
    </>
  );
}
