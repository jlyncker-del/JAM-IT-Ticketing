import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus, Search } from "lucide-react";
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
import { useAuth } from "../contexts/AuthContext";
import type { ApiResponse, Category } from "../types";
import { formatDate } from "../utils/format";

interface Article {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  updatedAt: string;
  categoryId?: string;
  category?: { name: string };
  author: { firstName: string; lastName: string };
}
const empty = {
  title: "",
  slug: "",
  summary: "",
  content: "",
  categoryId: "",
  status: "DRAFT" as Article["status"],
};
export function KnowledgeBasePage() {
  const { user } = useAuth();
  const staff = user?.role !== "CUSTOMER";
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [open, setOpen] = useState<string>();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [form, setForm] = useState(empty);
  const [archiveId, setArchiveId] = useState<string>();
  const [message, setMessage] = useState("");
  const query = useQuery({
    queryKey: ["knowledge", search, categoryId],
    queryFn: async () =>
      (
        await api.get<ApiResponse<Article[]>>("/knowledge-base/articles", {
          params: {
            search: search || undefined,
            categoryId: categoryId || undefined,
          },
        })
      ).data.data,
  });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () =>
      (await api.get<ApiResponse<Category[]>>("/categories")).data.data,
  });
  const save = useMutation({
    mutationFn: () =>
      editingId
        ? api.patch(`/knowledge-base/articles/${editingId}`, {
            ...form,
            categoryId: form.categoryId || null,
          })
        : api.post("/knowledge-base/articles", {
            ...form,
            categoryId: form.categoryId || null,
          }),
    onSuccess: async (response) => {
      setMessage(response.data.message);
      setForm(empty);
      setEditingId(undefined);
      setFormOpen(false);
      await client.invalidateQueries({ queryKey: ["knowledge"] });
    },
    onError: (error) => setMessage(apiErrorMessage(error)),
  });
  const archive = useMutation({
    mutationFn: (id: string) => api.delete(`/knowledge-base/articles/${id}`),
    onSuccess: async () => {
      setArchiveId(undefined);
      setMessage("Der Artikel wurde archiviert.");
      await client.invalidateQueries({ queryKey: ["knowledge"] });
    },
    onError: (error) => setMessage(apiErrorMessage(error)),
  });
  const edit = (article: Article) => {
    setEditingId(article.id);
    setForm({
      title: article.title,
      slug: article.slug,
      summary: article.summary,
      content: article.content,
      categoryId: article.categoryId ?? "",
      status: article.status,
    });
    setFormOpen(true);
  };
  return (
    <>
      <PageTitle
        title="Wissensdatenbank"
        description="Anleitungen und Lösungen für häufige IT-Fragen."
        action={
          staff ? (
            <Button
              onClick={() => {
                setEditingId(undefined);
                setForm(empty);
                setFormOpen(true);
              }}
            >
              <Plus size={18} />
              Artikel anlegen
            </Button>
          ) : undefined
        }
      />
      {message && (
        <div className="warning-box" style={{ marginBottom: "1rem" }}>
          {message}
        </div>
      )}
      {formOpen && (
        <Card style={{ marginBottom: "1rem" }}>
          <h2>{editingId ? "Artikel bearbeiten" : "Artikel anlegen"}</h2>
          <div className="form-grid">
            <Input
              label="Titel *"
              value={form.title}
              onChange={(event) =>
                setForm({
                  ...form,
                  title: event.target.value,
                  ...(!editingId
                    ? {
                        slug: event.target.value
                          .toLowerCase()
                          .replace(/ä/g, "ae")
                          .replace(/ö/g, "oe")
                          .replace(/ü/g, "ue")
                          .replace(/ß/g, "ss")
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-|-$/g, ""),
                      }
                    : {}),
                })
              }
            />
            <Input
              label="Webadresse (Slug) *"
              value={form.slug}
              onChange={(event) =>
                setForm({ ...form, slug: event.target.value })
              }
            />
            <div className="form-span">
              <Textarea
                label="Zusammenfassung *"
                value={form.summary}
                onChange={(event) =>
                  setForm({ ...form, summary: event.target.value })
                }
              />
            </div>
            <div className="form-span">
              <Textarea
                label="Inhalt *"
                rows={10}
                value={form.content}
                onChange={(event) =>
                  setForm({ ...form, content: event.target.value })
                }
              />
            </div>
            <Select
              label="Kategorie"
              value={form.categoryId}
              onChange={(event) =>
                setForm({ ...form, categoryId: event.target.value })
              }
            >
              <option value="">Allgemein</option>
              {categories.data?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Select
              label="Status"
              value={form.status}
              onChange={(event) =>
                setForm({
                  ...form,
                  status: event.target.value as Article["status"],
                })
              }
            >
              <option value="DRAFT">Entwurf</option>
              <option value="PUBLISHED">Veröffentlicht</option>
              <option value="ARCHIVED">Archiviert</option>
            </Select>
          </div>
          <div className="form-actions">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Abbrechen
            </Button>
            <Button
              loading={save.isPending}
              disabled={
                form.title.length < 3 ||
                form.summary.length < 10 ||
                form.content.length < 20 ||
                !form.slug
              }
              onClick={() => save.mutate()}
            >
              Artikel speichern
            </Button>
          </div>
        </Card>
      )}
      <div className="toolbar">
        <div className="search-wrap">
          <Search size={19} />
          <label className="sr-only" htmlFor="knowledge-search">
            Artikel durchsuchen
          </label>
          <input
            id="knowledge-search"
            className="search-input"
            placeholder="Artikel durchsuchen …"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
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
      </div>
      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message={apiErrorMessage(query.error)} />
      ) : !query.data?.length ? (
        <EmptyState title="Keine Artikel gefunden" />
      ) : (
        <div className="management-grid">
          {query.data.map((article) => (
            <Card className="management-item" key={article.id}>
              <BookOpen size={24} />
              <div className="section-heading">
                <h3>{article.title}</h3>
                {staff && (
                  <span className="badge badge-neutral">
                    {article.status === "PUBLISHED"
                      ? "Veröffentlicht"
                      : article.status === "DRAFT"
                        ? "Entwurf"
                        : "Archiviert"}
                  </span>
                )}
              </div>
              <p className="prose">
                {open === article.id ? article.content : article.summary}
              </p>
              <div className="form-actions">
                <Button
                  variant="ghost"
                  onClick={() =>
                    setOpen(open === article.id ? undefined : article.id)
                  }
                >
                  {open === article.id
                    ? "Zusammenfassung anzeigen"
                    : "Artikel lesen"}
                </Button>
                {staff && (
                  <Button variant="secondary" onClick={() => edit(article)}>
                    Bearbeiten
                  </Button>
                )}
                {user?.role === "ADMIN" && article.status !== "ARCHIVED" && (
                  <Button
                    variant="danger"
                    onClick={() => setArchiveId(article.id)}
                  >
                    Archivieren
                  </Button>
                )}
              </div>
              <div className="management-meta">
                <span>{article.category?.name ?? "Allgemein"}</span>
                <span>{formatDate(article.updatedAt)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(archiveId)}
        title="Artikel archivieren"
        description="Der Artikel wird für Kunden ausgeblendet und bleibt im System erhalten."
        confirmLabel="Archivieren"
        danger
        loading={archive.isPending}
        onCancel={() => setArchiveId(undefined)}
        onConfirm={() => archiveId && archive.mutate(archiveId)}
      />
    </>
  );
}
