import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ChevronLeft } from "lucide-react";
import PageMeta from "../../../../../components/common/PageMeta";
import Button from "../../../../../components/ui/button/Button";
import { useSettingsDirectoryQuery } from "../../../../../api/services/settingsDirectory.service";
import DocxPreview from "./DocxPreview";

type TemplateItem = {
  guid: string;
  title?: string;
  description?: string;
  file?: string;
};

const TEMPLATES_SLUG = "document_templates";

export default function EmployeeDocumentTemplateSelectPage() {
  const { id } = useParams<{ id: string }>();
  const employeeGuid = String(id || "");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const folderId = String(searchParams.get("folderId") || "");

  const { data, isLoading } = useSettingsDirectoryQuery({
    slug: TEMPLATES_SLUG,
    params: {
      limit: 1000,
      offset: 0,
    },
  });

  const templates = useMemo(() => ((data?.response || []) as TemplateItem[]), [data?.response]);
  const [selectedTemplateGuid, setSelectedTemplateGuid] = useState("");

  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateGuid) return templates[0] || null;
    return templates.find((item) => item.guid === selectedTemplateGuid) || null;
  }, [selectedTemplateGuid, templates]);

  const openGeneratePage = () => {
    if (!employeeGuid || !selectedTemplate?.guid) return;

    const query = folderId ? `?folderId=${encodeURIComponent(folderId)}` : "";
    navigate(`/employees/${employeeGuid}/documents/generate/${selectedTemplate.guid}${query}`);
  };

  return (
    <>
      <PageMeta
        title="Выбор шаблона документа | Сотрудники"
        description="Выбор шаблона для генерации документа сотрудника"
      />

      <div className="space-y-4">
        <Link
          to={`/employees/${employeeGuid}`}
          state={{ activeTab: "Документы" }}
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-gray-700"
        >
          <ChevronLeft size={16} />
          Назад к сотруднику
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Выбор шаблона</h1>
            <p className="mt-1 text-base font-medium text-gray-500">
              Выберите DOCX шаблон для генерации документа
            </p>
          </div>
          <Button onClick={openGeneratePage} disabled={!selectedTemplate}>
            Продолжить
          </Button>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="h-8 w-56 animate-pulse rounded bg-gray-200" />
            <div className="mt-4 h-[60vh] animate-pulse rounded bg-gray-100" />
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
            Шаблоны документов не найдены.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="max-h-[calc(100vh-180px)] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3">
              <div className="space-y-2">
                {templates.map((template) => {
                  const isActive = template.guid === (selectedTemplate?.guid || templates[0]?.guid);

                  return (
                    <button
                      key={template.guid}
                      type="button"
                      onClick={() => setSelectedTemplateGuid(template.guid)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        isActive
                          ? "border-brand-300 bg-brand-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <p className="line-clamp-2 text-sm font-semibold text-gray-900">
                        {String(template.title || "Без названия")}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                        {String(template.description || "Без описания")}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <DocxPreview fileUrl={String(selectedTemplate?.file || "")} title="Предпросмотр шаблона" />
          </div>
        )}
      </div>
    </>
  );
}
