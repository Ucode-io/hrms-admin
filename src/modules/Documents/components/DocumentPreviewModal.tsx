import { useCallback, useEffect, useRef, useState } from "react";
import { Download, ExternalLink, FileQuestion, X } from "lucide-react";
import { renderAsync } from "docx-preview";
import { Modal } from "../../../components/ui/modal";

export type PreviewKind = "image" | "pdf" | "docx" | "unsupported";

type DocumentPreviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName: string;
};

const getExtension = (value: string): string => {
  const clean = value.split("?")[0].split("#")[0];
  const dot = clean.lastIndexOf(".");
  return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : "";
};

export const resolvePreviewKind = (fileUrl: string, fileName: string): PreviewKind => {
  const ext = getExtension(fileName) || getExtension(fileUrl);
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  return "unsupported";
};

export default function DocumentPreviewModal({
  isOpen,
  onClose,
  fileUrl,
  fileName,
}: DocumentPreviewModalProps) {
  const docxContainerRef = useRef<HTMLDivElement | null>(null);
  const [isDocxLoading, setIsDocxLoading] = useState(false);
  const [docxError, setDocxError] = useState("");
  const [actualKind, setActualKind] = useState<PreviewKind>("unsupported");
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");

  const kind = resolvePreviewKind(fileUrl, fileName);

  const waitForDocxContainer = useCallback(async () => {
    if (docxContainerRef.current) return docxContainerRef.current;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    return docxContainerRef.current;
  }, []);

  const renderDocx = useCallback(async () => {
    if (!fileUrl) return;
    setIsDocxLoading(true);
    setDocxError("");
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`Preview fetch failed: ${response.status}`);
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const header = new TextDecoder("latin1").decode(new Uint8Array(arrayBuffer.slice(0, 8)));

      if (header.startsWith("%PDF")) {
        const url = URL.createObjectURL(new Blob([arrayBuffer], { type: "application/pdf" }));
        setPdfPreviewUrl(url);
        setActualKind("pdf");
        return;
      }

      setActualKind("docx");
      const container = await waitForDocxContainer();
      if (!container) return;
      container.innerHTML = "";
      await renderAsync(arrayBuffer, container, undefined, {
        inWrapper: true,
        breakPages: true,
      });
    } catch (error) {
      console.error("Failed to render DOCX preview:", error);
      setDocxError("Не удалось отобразить предпросмотр документа.");
    } finally {
      setIsDocxLoading(false);
    }
  }, [fileUrl, waitForDocxContainer]);

  const preparePdf = useCallback(async () => {
    if (!fileUrl) return;
    setDocxError("");
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`Preview fetch failed: ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const url = URL.createObjectURL(new Blob([arrayBuffer], { type: "application/pdf" }));
      setPdfPreviewUrl(url);
      setActualKind("pdf");
    } catch (error) {
      console.error("Failed to prepare PDF preview:", error);
      setPdfPreviewUrl(fileUrl);
      setActualKind("pdf");
    }
  }, [fileUrl]);

  useEffect(() => {
    if (!isOpen) return;

    setDocxError("");
    setPdfPreviewUrl("");
    setActualKind(kind);
    if (docxContainerRef.current) {
      docxContainerRef.current.innerHTML = "";
    }

    if (kind === "docx") {
      void renderDocx();
      return;
    }

    if (kind === "pdf") {
      void preparePdf();
    }
  }, [isOpen, kind, preparePdf, renderDocx]);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl && pdfPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(pdfPreviewUrl);
      }
    };
  }, [pdfPreviewUrl]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="mx-4 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden p-0"
      showCloseButton={false}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
        <h3 className="min-w-0 truncate text-[15px] font-semibold text-slate-900">{fileName}</h3>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={fileUrl}
            download={fileName}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <Download size={15} />
            Скачать
          </a>
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <ExternalLink size={15} />
            Открыть
          </a>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
            aria-label="Закрыть"
            title="Закрыть"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4">
        {actualKind === "image" ? (
          <div className="flex min-h-full items-center justify-center">
            <img
              src={fileUrl}
              alt={fileName}
              className="max-h-[78vh] max-w-full rounded-lg object-contain shadow-sm"
            />
          </div>
        ) : actualKind === "pdf" ? (
          <iframe
            src={pdfPreviewUrl || fileUrl}
            title={fileName}
            className="h-[78vh] w-full rounded-lg border-0 bg-white shadow-sm"
          />
        ) : actualKind === "docx" ? (
          <div className="mx-auto max-w-3xl rounded-lg bg-white p-4 shadow-sm">
            {isDocxLoading && (
              <div className="py-10 text-center text-sm text-slate-500">Загрузка предпросмотра...</div>
            )}
            {docxError && <div className="py-10 text-center text-sm text-rose-600">{docxError}</div>}
            <div ref={docxContainerRef} className="min-h-[320px]" />
          </div>
        ) : (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
            <FileQuestion className="h-12 w-12 text-slate-300" />
            <p className="m-0 text-sm text-slate-500">
              Предпросмотр для этого типа файла недоступен.
            </p>
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <ExternalLink size={15} />
              Открыть в новой вкладке
            </a>
          </div>
        )}
      </div>
    </Modal>
  );
}
