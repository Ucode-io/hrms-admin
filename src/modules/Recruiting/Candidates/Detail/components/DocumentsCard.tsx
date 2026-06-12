import { useRef, useState } from "react";
import { ExternalLink, FileText, Link as LinkIcon, Paperclip, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import Button from "../../../../../components/ui/button/Button";
import { Modal } from "../../../../../components/ui/modal";
import FormSelect from "../../../components/FormSelect";
import {
  useAddCandidateDocument,
  useDeleteCandidateDocument,
  type NewCandidateDocument,
} from "../../../../../api/services/candidate.service";
import {
  DOCUMENT_TYPE_CONFIG,
  DOCUMENT_TYPE_ORDER,
  formatDate,
  formatFileSize,
  type Candidate,
  type CandidateDocumentType,
} from "../../../types";

// Демо-режим хранит файлы в localStorage — поэтому жёсткий лимит на размер.
const MAX_FILE_SIZE = 1.5 * 1024 * 1024;

const TYPE_OPTIONS = DOCUMENT_TYPE_ORDER.map((t) => ({
  value: t,
  label: DOCUMENT_TYPE_CONFIG[t].label,
}));

const inputCls =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-800 transition placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";

interface DocumentsCardProps {
  candidate: Candidate;
}

/** CV, сертификаты и прочие файлы кандидата. */
export default function DocumentsCard({ candidate }: DocumentsCardProps) {
  const addMutation = useAddCandidateDocument();
  const deleteMutation = useDeleteCandidateDocument();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [mode, setMode] = useState<"file" | "link">("file");
  const [docType, setDocType] = useState<CandidateDocumentType>("cv");
  const [docName, setDocName] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [file, setFile] = useState<{ name: string; size: number; dataUrl: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setMode("file");
    setDocType("cv");
    setDocName("");
    setDocUrl("");
    setFile(null);
  };

  const handleFilePick = (picked: File | undefined) => {
    if (!picked) return;
    if (picked.size > MAX_FILE_SIZE) {
      toast.error("В демо-режиме файлы до 1.5 МБ. Для больших файлов добавьте ссылку.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFile({ name: picked.name, size: picked.size, dataUrl: String(reader.result) });
      if (!docName.trim()) setDocName(picked.name);
    };
    reader.readAsDataURL(picked);
  };

  const handleAdd = async () => {
    const name = docName.trim() || (mode === "file" ? file?.name : "") || "";
    if (!name) {
      toast.error("Укажите название документа");
      return;
    }
    let doc: NewCandidateDocument;
    if (mode === "file") {
      if (!file) {
        toast.error("Выберите файл");
        return;
      }
      doc = { name, type: docType, url: file.dataUrl, size: file.size };
    } else {
      const url = docUrl.trim();
      if (!/^https?:\/\//.test(url)) {
        toast.error("Укажите корректную ссылку (https://…)");
        return;
      }
      doc = { name, type: docType, url, size: null };
    }
    try {
      await addMutation.mutateAsync({ guid: candidate.id, doc });
      toast.success("Документ добавлен");
      setIsAddOpen(false);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось добавить документ");
    }
  };

  const handleDelete = async (documentId: string, name: string) => {
    try {
      await deleteMutation.mutateAsync({ guid: candidate.id, documentId });
      toast.success(`«${name}» удалён`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить");
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
        <span className="text-[15px] font-semibold text-gray-900">
          Документы
          {candidate.documents.length > 0 && (
            <span className="ml-1.5 font-normal text-gray-400">· {candidate.documents.length}</span>
          )}
        </span>
        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 transition hover:text-brand-700"
        >
          <Plus size={14} />
          Добавить
        </button>
      </div>

      <div className="px-5 py-4">
        {candidate.documents.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-6 text-center">
            <Paperclip size={24} className="text-gray-300" />
            <p className="text-sm text-gray-400">Документов нет</p>
            <p className="text-xs text-gray-300">CV, сертификаты, тестовые задания…</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {candidate.documents.map((doc) => {
              const config = DOCUMENT_TYPE_CONFIG[doc.type];
              const isDataUrl = doc.url.startsWith("data:");
              return (
                <li
                  key={doc.id}
                  className="group flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5 transition hover:border-gray-200 hover:bg-gray-50/50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                    <FileText size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      {...(isDataUrl ? { download: doc.name } : {})}
                      className="block truncate text-sm font-medium text-gray-800 hover:text-brand-600"
                      title={doc.name}
                    >
                      {doc.name}
                    </a>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span
                        className={`inline-flex rounded px-1.5 py-px text-[10px] font-medium ${config.badgeClassName}`}
                      >
                        {config.label}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {[formatFileSize(doc.size), formatDate(doc.uploadedAt), doc.uploadedByName]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      {...(isDataUrl ? { download: doc.name } : {})}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                      title={isDataUrl ? "Скачать" : "Открыть"}
                    >
                      <ExternalLink size={14} />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDelete(doc.id, doc.name)}
                      disabled={deleteMutation.isLoading}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-rose-50 hover:text-rose-500"
                      title="Удалить"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Add document dialog */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        showCloseButton={false}
        className="m-4 max-w-[460px]"
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900">Добавить документ</h3>

          {/* Mode switch */}
          <div className="mt-4 inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
            {(
              [
                { key: "file", label: "Файл", icon: <Upload size={14} /> },
                { key: "link", label: "Ссылка", icon: <LinkIcon size={14} /> },
              ] as const
            ).map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition ${
                  mode === m.key ? "bg-white text-brand-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Тип документа</label>
              <FormSelect
                options={TYPE_OPTIONS}
                value={docType}
                onChange={(v) => setDocType(v as CandidateDocumentType)}
                isSearchable={false}
                menuPortal
              />
            </div>

            {mode === "file" ? (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Файл</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => handleFilePick(e.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 px-4 py-5 text-sm text-gray-500 transition hover:border-brand-300 hover:text-brand-600"
                >
                  <Upload size={16} />
                  {file ? (
                    <span className="truncate">
                      {file.name} · {formatFileSize(file.size)}
                    </span>
                  ) : (
                    "Выбрать файл (до 1.5 МБ)"
                  )}
                </button>
              </div>
            ) : (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Ссылка</label>
                <input
                  className={inputCls}
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Название</label>
              <input
                className={inputCls}
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="Напр. CV_Иванов.pdf"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="px-5">
              Отменить
            </Button>
            <Button onClick={handleAdd} disabled={addMutation.isLoading} className="px-6">
              {addMutation.isLoading ? "Сохранение..." : "Добавить"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
