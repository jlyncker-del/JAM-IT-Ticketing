import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { Link2, Paperclip, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { api, apiErrorMessage } from "../api/client";
import {
  Button,
  Card,
  Input,
  PageTitle,
  Select,
  Textarea,
} from "../components/ui";
import { FileUpload } from "../components/FileUpload";
import { useAuth } from "../contexts/AuthContext";
import type { ApiResponse, Category, Ticket, TicketPriority } from "../types";

const schema = z.object({
  subject: z
    .string()
    .trim()
    .min(3, "Bitte geben Sie einen Betreff ein.")
    .max(150, "Der Betreff darf maximal 150 Zeichen enthalten."),
  description: z
    .string()
    .trim()
    .min(20, "Bitte beschreiben Sie das Problem ausführlich."),
  categoryId: z.string().min(1, "Bitte wählen Sie eine Kategorie aus."),
  customerId: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  affectedSystem: z.string().optional(),
  device: z.string().optional(),
  operatingSystem: z.string().optional(),
  browser: z.string().optional(),
  errorMessage: z.string().optional(),
  contactPhone: z.string().optional(),
  preferredContactMethod: z.string().optional(),
  preferredAvailability: z.string().optional(),
  technicalInformation: z.string().optional(),
  sensitiveDataConfirmed: z
    .boolean()
    .refine((value) => value, "Bitte bestätigen Sie den Sicherheitshinweis."),
});
type TicketInput = z.infer<typeof schema>;
type LinkInput = { url: string; title: string; description: string };
type Customer = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  company?: string;
};

export function CreateTicketPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<LinkInput[]>([]);
  const [submitError, setSubmitError] = useState("");
  const [progress, setProgress] = useState(0);
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () =>
      (await api.get<ApiResponse<Category[]>>("/categories")).data.data,
  });
  const customers = useQuery({
    queryKey: ["customer-directory"],
    enabled: user?.role !== "CUSTOMER",
    queryFn: async () =>
      (await api.get<ApiResponse<Customer[]>>("/users/customer-directory")).data
        .data,
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TicketInput>({
    resolver: zodResolver(schema),
    defaultValues: { sensitiveDataConfirmed: false },
  });
  const submit = async (input: TicketInput, isDraft = false) => {
    setSubmitError("");
    try {
      const cleanLinks = links
        .filter((link) => link.url.trim())
        .map((link) => ({
          ...link,
          title: link.title || undefined,
          description: link.description || undefined,
        }));
      const { data } = await api.post<ApiResponse<Ticket>>("/tickets", {
        ...input,
        isDraft,
        links: cleanLinks,
      });
      if (files.length) {
        const formData = new FormData();
        files.forEach((file) => formData.append("files", file));
        await api.post(`/tickets/${data.data.id}/attachments`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (event) =>
            setProgress(
              event.total ? Math.round((event.loaded / event.total) * 100) : 0,
            ),
        });
      }
      navigate(`/tickets/${data.data.id}`);
    } catch (error) {
      setSubmitError(apiErrorMessage(error));
    }
  };
  return (
    <>
      <PageTitle
        title="Ticket erstellen"
        description="Beschreiben Sie Ihr Anliegen möglichst genau. Pflichtfelder sind mit * gekennzeichnet."
      />
      <form onSubmit={handleSubmit((input) => submit(input))} noValidate>
        <div className="detail-grid">
          <div className="detail-main">
            <Card>
              <h2>Anliegen</h2>
              <div className="form-grid">
                {user?.role !== "CUSTOMER" && (
                  <>
                    <div className="form-span">
                      <Select label="Kunde *" {...register("customerId")}>
                        <option value="">Bitte Kunden auswählen</option>
                        {customers.data?.map((customer) => (
                          <option key={customer.id} value={customer.id}>
                            {customer.firstName} {customer.lastName} ·{" "}
                            {customer.email}
                            {customer.company ? ` · ${customer.company}` : ""}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <Select label="Priorität" {...register("priority")}>
                      <option value="">Standard der Kategorie</option>
                      {(
                        [
                          ["LOW", "Niedrig"],
                          ["MEDIUM", "Mittel"],
                          ["HIGH", "Hoch"],
                          ["CRITICAL", "Kritisch"],
                        ] as Array<[TicketPriority, string]>
                      ).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </>
                )}
                <div className="form-span">
                  <Input
                    label="Betreff *"
                    maxLength={150}
                    {...register("subject")}
                    error={errors.subject?.message}
                  />
                </div>
                <div className="form-span">
                  <Textarea
                    label="Detaillierte Problembeschreibung *"
                    rows={7}
                    {...register("description")}
                    error={errors.description?.message}
                  />
                </div>
                <Select label="Kategorie *" {...register("categoryId")}>
                  <option value="">Bitte wählen</option>
                  {categories.data?.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Betroffenes System (optional)"
                  {...register("affectedSystem")}
                />
                <Input label="Gerät (optional)" {...register("device")} />
                <Input
                  label="Betriebssystem (optional)"
                  {...register("operatingSystem")}
                />
                <Input label="Browser (optional)" {...register("browser")} />
                <Input
                  label="Fehlermeldung (optional)"
                  {...register("errorMessage")}
                />
              </div>
            </Card>
            <Card>
              <h2>Kontakt und technische Angaben</h2>
              <div className="form-grid">
                <Input
                  label="Rückrufnummer (optional)"
                  type="tel"
                  {...register("contactPhone")}
                />
                <Select
                  label="Bevorzugter Kontaktweg"
                  {...register("preferredContactMethod")}
                >
                  <option value="">Keine Angabe</option>
                  <option value="E-Mail">E-Mail</option>
                  <option value="Telefon">Telefon</option>
                </Select>
                <Input
                  label="Erreichbarkeit (optional)"
                  {...register("preferredAvailability")}
                />
                <div className="form-span">
                  <Textarea
                    label="Weitere technische Informationen (optional)"
                    {...register("technicalInformation")}
                  />
                </div>
              </div>
            </Card>
            <Card>
              <div className="section-heading">
                <h2>
                  <Link2
                    size={19}
                    style={{ display: "inline", marginRight: 8 }}
                  />
                  Weiterführende Links
                </h2>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setLinks((current) => [
                      ...current,
                      { url: "", title: "", description: "" },
                    ])
                  }
                >
                  <Plus size={17} />
                  Link hinzufügen
                </Button>
              </div>
              {links.length === 0 ? (
                <p style={{ color: "var(--secondary)" }}>
                  Optional können Sie bis zu 10 HTTP- oder HTTPS-Links ergänzen.
                </p>
              ) : (
                links.map((link, index) => (
                  <div
                    className="form-grid"
                    key={index}
                    style={{ marginBottom: "1rem" }}
                  >
                    <Input
                      label={`Webadresse ${index + 1}`}
                      type="url"
                      value={link.url}
                      onChange={(event) =>
                        setLinks((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, url: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <Input
                      label="Titel (optional)"
                      value={link.title}
                      onChange={(event) =>
                        setLinks((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, title: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <div className="form-span form-actions">
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() =>
                          setLinks((current) =>
                            current.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          )
                        }
                      >
                        <Trash2 size={16} />
                        Link entfernen
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </Card>
          </div>
          <aside className="detail-side">
            <Card>
              <h2>
                <Paperclip
                  size={19}
                  style={{ display: "inline", marginRight: 8 }}
                />
                Anhänge
              </h2>
              <FileUpload
                files={files}
                onChange={setFiles}
                progress={progress}
              />
            </Card>
            <div className="warning-box">
              <ShieldAlert size={20} />
              <span>
                Bitte laden Sie keine Passwörter, Zugangsdaten, privaten
                Schlüssel oder andere vertrauliche Anmeldeinformationen hoch.
              </span>
            </div>
            <label className="checkbox">
              <input type="checkbox" {...register("sensitiveDataConfirmed")} />
              <span>
                Ich bestätige, dass meine Angaben und Dateien keine
                vertraulichen Zugangsdaten enthalten. *
              </span>
            </label>
            {errors.sensitiveDataConfirmed && (
              <small className="field-error">
                {errors.sensitiveDataConfirmed.message}
              </small>
            )}
            {submitError && (
              <div className="form-alert" role="alert">
                {submitError}
              </div>
            )}
            <div className="form-actions">
              <Button
                type="button"
                variant="ghost"
                loading={isSubmitting}
                onClick={handleSubmit((input) => submit(input, true))}
              >
                Entwurf speichern
              </Button>
              <Button type="submit" loading={isSubmitting}>
                Ticket absenden
              </Button>
            </div>
          </aside>
        </div>
      </form>
    </>
  );
}
