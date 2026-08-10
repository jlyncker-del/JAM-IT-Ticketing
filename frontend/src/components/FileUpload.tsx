import { useEffect, useState } from "react";
import { FileText, Trash2, UploadCloud } from "lucide-react";
import { Button } from "./ui";
import { formatFileSize } from "../utils/format";

const allowed = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "log",
  "txt",
  "csv",
  "json",
  "xml",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "zip",
]);

function FilePreview({ file }: { file: File }) {
  const [preview, setPreview] = useState("");
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  useEffect(() => {
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    if (["log", "txt", "csv", "json", "xml"].includes(extension))
      void file.slice(0, 20_000).text().then(setPreview);
  }, [file, extension]);
  if (!preview) return null;
  return file.type.startsWith("image/") ? (
    <img
      className="file-image-preview"
      src={preview}
      alt={`Vorschau von ${file.name}`}
    />
  ) : (
    <details className="file-text-preview">
      <summary>Textvorschau</summary>
      <pre>{preview}</pre>
    </details>
  );
}

export function FileUpload({
  files,
  onChange,
  progress = 0,
  label = "Dateien hinzufügen",
}: {
  files: File[];
  onChange: (files: File[]) => void;
  progress?: number;
  label?: string;
}) {
  const [active, setActive] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const select = (incoming: File[]) => {
    const messages: string[] = [];
    const valid = incoming.filter((file) => {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!allowed.has(extension)) {
        messages.push(`„${file.name}“ hat einen nicht erlaubten Dateityp.`);
        return false;
      }
      if (file.size > 15 * 1024 * 1024) {
        messages.push(`„${file.name}“ ist größer als 15 MB.`);
        return false;
      }
      return true;
    });
    const combined = [...files, ...valid];
    if (combined.length > 10)
      messages.push("Pro Upload sind höchstens 10 Dateien erlaubt.");
    if (combined.reduce((sum, file) => sum + file.size, 0) > 50 * 1024 * 1024)
      messages.push("Die Gesamtgröße darf 50 MB nicht überschreiten.");
    setErrors(messages);
    if (!messages.length) onChange(combined);
  };
  return (
    <div>
      <div
        className={`file-drop ${active ? "drag-active" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setActive(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) setActive(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setActive(false);
          select(Array.from(event.dataTransfer.files));
        }}
      >
        <UploadCloud size={30} />
        <p>
          {active
            ? "Dateien jetzt ablegen"
            : "Dateien hierher ziehen oder auswählen"}
        </p>
        <small>
          Bilder, Logs, PDF-, Office-Dokumente und ZIP · max. 15 MB je Datei
        </small>
        <label className="button button-ghost file-picker">
          {label}
          <input
            className="sr-only"
            aria-label={label}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.gif,.log,.txt,.csv,.json,.xml,.pdf,.doc,.docx,.xls,.xlsx,.zip"
            onChange={(event) => {
              select(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
        </label>
      </div>
      {errors.map((error) => (
        <p className="field-error" role="alert" key={error}>
          {error}
        </p>
      ))}
      <div className="attachment-list">
        {files.map((file, index) => (
          <div key={`${file.name}-${file.lastModified}`}>
            <div className="attachment-item">
              <FileText size={19} />
              <div className="attachment-info">
                <strong>{file.name}</strong>
                <small>
                  {formatFileSize(file.size)} ·{" "}
                  {file.type || "Dateityp unbekannt"}
                </small>
              </div>
              <Button
                type="button"
                variant="ghost"
                aria-label={`${file.name} entfernen`}
                onClick={() =>
                  onChange(files.filter((_, itemIndex) => itemIndex !== index))
                }
              >
                <Trash2 size={16} />
              </Button>
            </div>
            <FilePreview file={file} />
          </div>
        ))}
      </div>
      {progress > 0 && progress < 100 && (
        <div className="upload-progress" role="status">
          <span style={{ width: `${progress}%` }} />
          Upload: {progress} %
        </div>
      )}
    </div>
  );
}
