import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Eye, ExternalLink, FileQuestion, X } from "lucide-react";
import { renderAsync } from "docx-preview";
import { Modal } from "../../../components/ui/modal";

export type PreviewKind =
  | "image"
  | "pdf"
  | "docx"
  | "office"
  | "text"
  | "video"
  | "audio"
  | "unsupported";

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

/** Office formats the browser can't open itself — handed to Microsoft's public
 *  viewer, which only works for a URL it can fetch (so not blob:/data:). */
const OFFICE_EXT = ["doc", "xls", "xlsx", "xlsm", "xlsb", "ppt", "pptx", "odt", "ods", "odp", "rtf"];
const TEXT_EXT = [
  "txt", "csv", "tsv", "md", "json", "log", "xml", "yml", "yaml",
  "html", "htm", "css", "js", "ts", "tsx", "jsx", "sql", "sh", "py", "go", "java",
];

export const resolvePreviewKind = (fileUrl: string, fileName: string): PreviewKind => {
  const ext = getExtension(fileName) || getExtension(fileUrl);
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif", "ico"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (["mp4", "webm", "ogv", "mov"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "m4a", "aac"].includes(ext)) return "audio";
  if (TEXT_EXT.includes(ext)) return "text";
  if (OFFICE_EXT.includes(ext)) {
    return /^https?:\/\//i.test(fileUrl) ? "office" : "unsupported";
  }
  return "unsupported";
};

const officeViewerUrl = (fileUrl: string): string =>
  `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;

/**
 * Eye button that opens the preview modal for one file.
 *
 * Owns its own open state so a caller showing a file only has to drop this in
 * next to the name — no modal wiring per list, per chip, per row.
 */
export const FilePreviewButton: React.FC<{
  fileUrl: string;
  fileName: string;
  className?: string;
  size?: number;
}> = ({ fileUrl, fileName, className, size = 14 }) => {
  const [isOpen, setIsOpen] = useState(false);
  if (!fileUrl) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(true);
        }}
        title="Предпросмотр"
        aria-label="Предпросмотр файла"
        className={
          className ??
          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-current opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
        }
      >
        <Eye size={size} />
      </button>
      <DocumentPreviewModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        fileUrl={fileUrl}
        fileName={fileName}
      />
    </>
  );
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
  const [textContent, setTextContent] = useState("");

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

  const loadText = useCallback(async () => {
    if (!fileUrl) return;
    setIsDocxLoading(true);
    setDocxError("");
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(`Preview fetch failed: ${response.status}`);
      const text = await response.text();
      // ponytail: hard slice instead of virtualised scrolling — a preview isn't
      // an editor, and 200k chars already fills far more than anyone reads.
      setTextContent(text.length > 200_000 ? `${text.slice(0, 200_000)}\n…` : text);
    } catch (error) {
      console.error("Failed to load text preview:", error);
      setDocxError("Не удалось загрузить содержимое файла.");
    } finally {
      setIsDocxLoading(false);
    }
  }, [fileUrl]);

  useEffect(() => {
    if (!isOpen) return;

    setDocxError("");
    setPdfPreviewUrl("");
    setTextContent("");
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
      return;
    }

    if (kind === "text") {
      void loadText();
    }
  }, [isOpen, kind, preparePdf, renderDocx, loadText]);

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
        ) : actualKind === "office" ? (
          <iframe
            src={officeViewerUrl(fileUrl)}
            title={fileName}
            className="h-[78vh] w-full rounded-lg border-0 bg-white shadow-sm"
          />
        ) : actualKind === "video" ? (
          <div className="flex min-h-full items-center justify-center">
            <video src={fileUrl} controls className="max-h-[78vh] max-w-full rounded-lg shadow-sm" />
          </div>
        ) : actualKind === "audio" ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <audio src={fileUrl} controls className="w-full max-w-xl" />
          </div>
        ) : actualKind === "text" ? (
          <div className="mx-auto max-w-4xl rounded-lg bg-white p-4 shadow-sm">
            {isDocxLoading && (
              <div className="py-10 text-center text-sm text-slate-500">Загрузка предпросмотра...</div>
            )}
            {docxError && <div className="py-10 text-center text-sm text-rose-600">{docxError}</div>}
            {!isDocxLoading && !docxError && (
              <pre className="m-0 max-h-[74vh] overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-slate-800">
                {textContent}
              </pre>
            )}
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
