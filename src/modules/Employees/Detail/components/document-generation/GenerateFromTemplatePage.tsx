import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../../../components/common/PageMeta";
import Button from "../../../../../components/ui/button/Button";
import { useCreateDocument } from "../../../../../api/services/document.service";
import { useEmployeeQuery } from "../../../../../api/services/employee.service";
import { useUploadFile } from "../../../../../api/services/file-upload.service";
import { useSettingsDirectoryItemQuery } from "../../../../../api/services/settingsDirectory.service";
import documentTemplateGenerationService from "../../../../../api/services/documentTemplateGeneration.service";
import DocxPreview from "./DocxPreview";

type TemplateItem = {
  guid: string;
  title?: string;
  description?: string;
  file?: string;
};

const TEMPLATES_SLUG = "document_templates";

function getValueByPath(source: unknown, path: string): unknown {
  if (!source || typeof source !== "object") return "";
  const parts = path.split(".").filter(Boolean);
  let current: unknown = source;

  for (const part of parts) {
    if (!current || typeof current !== "object") return "";
    current = (current as Record<string, unknown>)[part];
  }

  return current ?? "";
}

function normalizeValue(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) {
    return value.filter((item) => item != null).map((item) => String(item)).join(", ");
  }
  if (typeof value === "object") return "";
  return String(value);
}

function buildEmployeeVariableDefaults(employee: unknown, variables: string[]): Record<string, string> {
  const defaults: Record<string, string> = {};

  for (const variable of variables) {
    const normalizedKey = variable.trim();
    if (!normalizedKey) continue;
    const path = normalizedKey.startsWith("user.") ? normalizedKey.slice("user.".length) : normalizedKey;
    defaults[normalizedKey] = normalizeValue(getValueByPath(employee, path));
  }

  return defaults;
}

function base64ToFile(base64: string, fileName: string, mimeType: string): File {
  const byteString = atob(base64);
  const buffer = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i += 1) {
    buffer[i] = byteString.charCodeAt(i);
  }
  return new File([buffer], fileName, { type: mimeType });
}

function downloadGeneratedFile(file: File) {
  const downloadUrl = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = file.name || "generated-document.docx";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}

export default function EmployeeGenerateDocumentFromTemplatePage() {
  const { id, templateId } = useParams<{ id?: string; templateId: string }>();
  const employeeGuidFromPath = String(id || "");
  const selectedTemplateGuid = String(templateId || "");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const employeeGuidFromQuery = String(searchParams.get("employeeId") || "");
  const employeeGuid = employeeGuidFromPath || employeeGuidFromQuery;
  const isEmployeeContextRoute = Boolean(employeeGuidFromPath);
  const folderId = String(searchParams.get("folderId") || "");

  const { data: employee, isLoading: isEmployeeLoading } = useEmployeeQuery(employeeGuid);
  const { data: templateData, isLoading: isTemplateLoading, isError: isTemplateError } = useSettingsDirectoryItemQuery({
    slug: TEMPLATES_SLUG,
    guid: selectedTemplateGuid,
    querySettings: {
      enabled: Boolean(selectedTemplateGuid),
    },
  });

  const template = (templateData || null) as TemplateItem | null;
  const templateFileUrl = String(template?.file || "").trim();
  const createDocumentMutation = useCreateDocument();
  const uploadMutation = useUploadFile({ folder: "Media" });

  const [variables, setVariables] = useState<string[]>([]);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [isLoadingVariables, setIsLoadingVariables] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!templateFileUrl) return;

    let isCancelled = false;

    const loadVariables = async () => {
      setIsLoadingVariables(true);
      try {
        const response = await documentTemplateGenerationService.extractTemplateVariables({
          template_url: templateFileUrl,
        });
        if (isCancelled) return;
        setVariables(response.result.variables);
      } catch (error) {
        console.error("Failed to extract template variables:", error);
        if (!isCancelled) {
          toast.error("Не удалось получить переменные шаблона.");
          setVariables([]);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingVariables(false);
        }
      }
    };

    void loadVariables();

    return () => {
      isCancelled = true;
    };
  }, [templateFileUrl]);

  const defaultVariableValues = useMemo(() => {
    return buildEmployeeVariableDefaults(employee, variables);
  }, [employee, variables]);

  useEffect(() => {
    setVariableValues((prev) => ({ ...defaultVariableValues, ...prev }));
  }, [defaultVariableValues]);

  const isSaving = isGenerating || uploadMutation.isLoading || createDocumentMutation.isLoading;

  const handleGenerate = async () => {
    if (!employeeGuid || !selectedTemplateGuid) return;
    if (!folderId) {
      toast.error("Не удалось определить папку для сохранения документа.");
      return;
    }
    if (!templateFileUrl) {
      toast.error("У шаблона отсутствует DOCX файл.");
      return;
    }

    try {
      setIsGenerating(true);

      const generated = await documentTemplateGenerationService.generateDocument({
        template_url: templateFileUrl,
        variables: variableValues,
        output_file_name: `${String(template?.title || "Документ")}.docx`,
      });

      const generatedFile = base64ToFile(
        generated.result.file_base64,
        generated.result.file_name,
        generated.result.mime_type
      );
      downloadGeneratedFile(generatedFile);

      const uploadedUrl = await uploadMutation.mutateAsync(generatedFile);

      await createDocumentMutation.mutateAsync({
        name: generated.result.file_name,
        file: uploadedUrl,
        type: ["doc"],
        user_base_id: employeeGuid,
        document_folders_id: folderId,
      });

      toast.success("Документ успешно сгенерирован.");
      if (isEmployeeContextRoute) {
        navigate(`/employees/${employeeGuid}`, { state: { activeTab: "Документы" } });
      } else {
        navigate("/documents");
      }
    } catch (error) {
      console.error("Failed to generate employee document from template:", error);
      toast.error("Не удалось сгенерировать документ.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (isTemplateLoading || isEmployeeLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
        Загрузка...
      </div>
    );
  }

  if (isTemplateError || !template) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
        Шаблон документа не найден.
      </div>
    );
  }

  if (!employeeGuid) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
        Не выбран сотрудник для генерации документа.
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title="Генерация документа | Сотрудники"
        description="Генерация документа сотрудника по шаблону"
      />

      <div className="space-y-4">
        <Link
          to={isEmployeeContextRoute ? `/employees/${employeeGuid}` : "/documents"}
          state={isEmployeeContextRoute ? { activeTab: "Документы" } : undefined}
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-gray-700"
        >
          <ChevronLeft size={16} />
          {isEmployeeContextRoute ? "Назад к сотруднику" : "Назад к документам"}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-[320px] flex-1 space-y-1">
            <textarea
              value={String(template.title || "Без названия")}
              readOnly
              rows={1}
              className="w-full resize-none overflow-hidden rounded-lg border border-transparent bg-transparent px-3 py-1 text-4xl font-semibold leading-tight text-gray-900 outline-none"
            />
            <textarea
              value={String(template.description || "Без описания")}
              readOnly
              rows={1}
              className="w-full resize-none overflow-hidden rounded-lg border border-transparent bg-transparent px-3 py-1 text-base font-medium text-gray-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-11"
              onClick={() => {
                if (isEmployeeContextRoute) {
                  navigate(`/employees/${employeeGuid}`, { state: { activeTab: "Документы" } });
                  return;
                }
                navigate("/documents");
              }}
              disabled={isSaving}
            >
              Отмена
            </Button>
            <Button className="h-11" onClick={handleGenerate} disabled={isSaving || isLoadingVariables}>
              {isSaving ? "Генерация..." : "Сгенерировать файл"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <DocxPreview fileUrl={templateFileUrl} title="DOCX шаблон" />

          <div className="flex max-h-[calc(100vh-150px)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs">
            <h3 className="text-lg font-semibold text-gray-900">Переменные</h3>
            <p className="mt-2 text-sm font-medium text-gray-500">Заполните значения для генерации документа</p>

            <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
              {isLoadingVariables ? (
                <p className="text-sm text-gray-500">Загрузка переменных шаблона...</p>
              ) : variables.length === 0 ? (
                <p className="text-sm text-gray-500">В шаблоне не найдены переменные.</p>
              ) : (
                variables.map((variable) => (
                  <div key={variable} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                    <p className="font-mono text-xs text-gray-500">{`{{${variable}}}`}</p>
                    <input
                      value={variableValues[variable] || ""}
                      onChange={(event) =>
                        setVariableValues((prev) => ({
                          ...prev,
                          [variable]: event.target.value,
                        }))
                      }
                      placeholder="Введите значение"
                      className="mt-2 h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
