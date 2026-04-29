import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ChevronLeft, ChevronRight, ExternalLink, Minus, Plus } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import { toast } from "sonner";
import PageMeta from "../../../../components/common/PageMeta";
import Button from "../../../../components/ui/button/Button";
import {
  type SettingsDirectoryItem,
  useSettingsDirectoryItemQuery,
} from "../../../../api/services/settingsDirectory.service";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const DOCUMENT_TEMPLATES_SLUG = "document_templates";
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 2.2;
const ZOOM_STEP = 0.1;

type DocumentTemplateItem = SettingsDirectoryItem & {
  description?: string;
  file?: string;
};

export default function DocumentTemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const guid = String(id || "");

  const { data, isLoading, isError } = useSettingsDirectoryItemQuery({
    slug: DOCUMENT_TEMPLATES_SLUG,
    guid,
    querySettings: {
      enabled: Boolean(guid),
    },
  });

  const template = (data || null) as DocumentTemplateItem | null;
  const fileUrl = String(template?.file || "").trim();
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    setPageNumber(1);
    setNumPages(0);
    setScale(1);
  }, [fileUrl]);

  const onDocumentLoadSuccess = ({ numPages: loadedNumPages }: { numPages: number }) => {
    setNumPages(loadedNumPages);
    setPageNumber(1);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error("Failed to load document template PDF:", error);
    toast.error("Не удалось загрузить PDF файл.");
  };

  const canGoPrev = pageNumber > 1;
  const canGoNext = numPages > 0 && pageNumber < numPages;
  const canZoomOut = scale > MIN_ZOOM;
  const canZoomIn = scale < MAX_ZOOM;

  if (!guid) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
        Идентификатор шаблона не указан.
      </div>
    );
  }

  return (
    <>
      <PageMeta title="Шаблон документа | Настройки" description="Предпросмотр PDF шаблона документа" />

      <div className="space-y-4">
        <Link
          to="/settings/documents?tab=templates"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-gray-700"
        >
          <ChevronLeft size={16} />
          Назад
        </Link>

        {isLoading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="h-7 w-80 animate-pulse rounded bg-gray-200" />
            <div className="mt-2 h-5 w-56 animate-pulse rounded bg-gray-200" />
            <div className="mt-4 h-[70vh] min-h-[420px] animate-pulse rounded-xl bg-gray-100" />
          </div>
        ) : isError || !template ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
            Шаблон документа не найден.
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <h1 className="text-3xl font-semibold text-gray-900">
                {String(template.title || "Шаблон документа")}
              </h1>
              <p className="text-base font-medium text-gray-500">
                {String(template.description || "Без описания")}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-2xl border border-gray-200 bg-white shadow-theme-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
                  {/* <h2 className="text-sm text-gray-900">Предварительный просмотр шаблона</h2> */}

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      className="h-9 px-3 py-2"
                      disabled={!canGoPrev}
                      onClick={() => setPageNumber((prev) => Math.max(1, prev - 1))}
                    >
                      <ChevronLeft size={16} />
                    </Button>

                    <span className="min-w-[64px] text-center text-sm font-medium text-gray-600">
                      {numPages > 0 ? `${pageNumber} / ${numPages}` : "0 / 0"}
                    </span>

                    <Button
                      variant="outline"
                      className="h-9 px-3 py-2"
                      disabled={!canGoNext}
                      onClick={() => setPageNumber((prev) => Math.min(numPages, prev + 1))}
                    >
                      <ChevronRight size={16} />
                    </Button>

                    <Button
                      variant="outline"
                      className="h-9 px-3 py-2"
                      disabled={!canZoomOut}
                      onClick={() => setScale((prev) => Math.max(MIN_ZOOM, Number((prev - ZOOM_STEP).toFixed(2))))}
                    >
                      <Minus size={16} />
                    </Button>

                    <span className="min-w-[58px] text-center text-sm font-medium text-gray-600">
                      {Math.round(scale * 100)}%
                    </span>

                    <Button
                      variant="outline"
                      className="h-9 px-3 py-2"
                      disabled={!canZoomIn}
                      onClick={() => setScale((prev) => Math.min(MAX_ZOOM, Number((prev + ZOOM_STEP).toFixed(2))))}
                    >
                      <Plus size={16} />
                    </Button>

                    {fileUrl && (
                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                      >
                        <ExternalLink size={14} />
                        Открыть PDF
                      </a>
                    )}
                  </div>
                </div>

                {fileUrl ? (
                  <div className="h-[72vh] min-h-[520px] overflow-auto bg-gray-50 p-4">
                    <div className="mx-auto w-fit rounded-xl border border-gray-200 bg-white p-4">
                      <Document
                        file={fileUrl}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={onDocumentLoadError}
                        loading={
                          <div className="flex h-[320px] w-[240px] items-center justify-center text-sm text-gray-500">
                            Загрузка PDF...
                          </div>
                        }
                        error={
                          <div className="flex h-[320px] w-[240px] items-center justify-center text-sm text-error-600">
                            Не удалось отобразить PDF.
                          </div>
                        }
                      >
                        <Page pageNumber={pageNumber} scale={scale} />
                      </Document>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-10 text-center text-sm text-gray-500">
                    Для этого шаблона не указан URL PDF файла.
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs">
                <h3 className="text-lg font-semibold text-gray-900">Обнаруженные переменные</h3>
                <p className="mt-2 text-sm font-medium text-gray-500">
                  Список переменных будет добавлен позже.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
