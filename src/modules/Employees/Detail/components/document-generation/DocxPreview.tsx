import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { renderAsync } from "docx-preview";

type DocxPreviewProps = {
  fileUrl: string;
  title?: string;
  openLabel?: string;
};

export default function DocxPreview({
  fileUrl,
  title = "DOCX шаблон",
  openLabel = "Открыть DOCX",
}: DocxPreviewProps) {
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const renderPreview = useCallback(async () => {
    if (!previewContainerRef.current || !fileUrl) return;

    setIsLoading(true);
    setPreviewError("");
    previewContainerRef.current.innerHTML = "";

    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Preview fetch failed: ${response.status}`);
      }
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      await renderAsync(arrayBuffer, previewContainerRef.current, undefined, {
        inWrapper: true,
        breakPages: true,
      });
    } catch (error) {
      console.error("Failed to render DOCX preview:", error);
      setPreviewError("Не удалось отобразить DOCX предпросмотр.");
    } finally {
      setIsLoading(false);
    }
  }, [fileUrl]);

  useEffect(() => {
    if (!fileUrl) return;
    void renderPreview();
  }, [fileUrl, renderPreview]);

  if (!fileUrl) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
        Для этого шаблона не указан DOCX файл.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-theme-xs">
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        <a
          href={fileUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          <ExternalLink size={14} />
          {openLabel}
        </a>
      </div>

      <div className="h-[72vh] min-h-[520px] overflow-auto bg-gray-50 p-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          {isLoading && (
            <div className="py-8 text-center text-sm text-gray-500">Загрузка DOCX предпросмотра...</div>
          )}

          {previewError && (
            <div className="py-8 text-center text-sm text-error-600">{previewError}</div>
          )}

          <div ref={previewContainerRef} className="min-h-[320px]" />
        </div>
      </div>
    </div>
  );
}
