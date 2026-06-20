import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router";
import {
  ExternalLink,
  FileText,
  UploadCloud,
  X,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { renderAsync } from "docx-preview";
import { toast } from "sonner";
import PageMeta from "../../../../components/common/PageMeta";
import Button from "../../../../components/ui/button/Button";
import { useUploadFile } from "../../../../api/services/file-upload.service";
import {
  useCreateSettingsDirectoryItem,
  useSettingsDirectoryItemQuery,
  useUpdateSettingsDirectoryItem,
} from "../../../../api/services/settingsDirectory.service";

const DOCUMENT_TEMPLATES_SLUG = "document_templates";

const AVAILABLE_EMPLOYEE_VARIABLES = [
  { key: "{{user.guid}}", label: "ID сотрудника" },
  { key: "{{user.first_name}}", label: "Имя сотрудника" },
  { key: "{{user.second_name}}", label: "Фамилия сотрудника" },
  { key: "{{user.middle_name}}", label: "Отчество сотрудника" },
  { key: "{{user.birth_date}}", label: "Дата рождения" },
  { key: "{{user.date_hire}}", label: "Дата приема на работу" },
  { key: "{{user.dismissal_date}}", label: "Дата увольнения" },
  { key: "{{user.phone}}", label: "Мобильный телефон" },
  { key: "{{user.work_phone}}", label: "Рабочий телефон" },
  { key: "{{user.telegram}}", label: "Telegram" },
  { key: "{{user.gender}}", label: "Пол сотрудника" },
  { key: "{{user.email}}", label: "Корпоративная почта" },
  { key: "{{user.personal_email}}", label: "Личная почта" },
  { key: "{{user.photo}}", label: "Фото сотрудника" },
  { key: "{{user.login}}", label: "Логин" },
  { key: "{{user.status}}", label: "Статус сотрудника" },
  { key: "{{user.language}}", label: "Язык" },
  { key: "{{user.created_at}}", label: "Дата создания записи" },
  { key: "{{user.updated_at}}", label: "Дата обновления записи" },
  { key: "{{user.deleted_at}}", label: "Дата удаления записи" },
];

export default function CreateDocumentTemplatePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const guid = String(id || "");
  const isEditMode = Boolean(guid);
  const createMutation = useCreateSettingsDirectoryItem(DOCUMENT_TEMPLATES_SLUG);
  const updateMutation = useUpdateSettingsDirectoryItem(DOCUMENT_TEMPLATES_SLUG);
  const uploadMutation = useUploadFile({ folder: "Media" });
  const { data: templateData, isLoading: isTemplateLoading, isError: isTemplateError } = useSettingsDirectoryItemQuery({
    slug: DOCUMENT_TEMPLATES_SLUG,
    guid,
    querySettings: {
      enabled: isEditMode,
    },
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const titleInputRef = useRef<HTMLTextAreaElement | null>(null);

  const isSaving = createMutation.isLoading || updateMutation.isLoading;
  const isBusy = isSaving || isUploadingFile;

  useEffect(() => {
    if (!isEditMode || !templateData) return;

    setTitle(String(templateData.title || ""));
    setDescription(String(templateData.description || ""));
    const existingFileUrl = String(templateData.file || "").trim();
    setFileUrl(existingFileUrl);
    const derivedName = decodeURIComponent(existingFileUrl.split("/").pop() || "");
    setFileName(derivedName || "template.docx");
  }, [isEditMode, templateData]);

  const renderDocxPreview = useCallback(async (source: Blob) => {
    if (!previewContainerRef.current) return;

    setIsRenderingPreview(true);
    setPreviewError("");
    previewContainerRef.current.innerHTML = "";

    try {
      const arrayBuffer = await source.arrayBuffer();
      await renderAsync(arrayBuffer, previewContainerRef.current, undefined, {
        inWrapper: true,
        breakPages: true,
      });
    } catch (error) {
      console.error("Failed to render DOCX preview:", error);
      setPreviewError("Не удалось отобразить DOCX предпросмотр.");
    } finally {
      setIsRenderingPreview(false);
    }
  }, []);

  useEffect(() => {
    if (!fileUrl) return;

    if (previewFile) {
      void renderDocxPreview(previewFile);
      return;
    }

    let isCancelled = false;

    const loadRemoteDocxPreview = async () => {
      if (!previewContainerRef.current) return;

      setIsRenderingPreview(true);
      setPreviewError("");
      previewContainerRef.current.innerHTML = "";

      try {
        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(`Preview fetch failed: ${response.status}`);
        }
        const blob = await response.blob();
        if (isCancelled) return;
        await renderDocxPreview(blob);
      } catch (error) {
        console.error("Failed to load remote DOCX preview:", error);
        if (isCancelled) return;
        setPreviewError("Не удалось загрузить DOCX предпросмотр.");
        setIsRenderingPreview(false);
      }
    };

    void loadRemoteDocxPreview();

    return () => {
      isCancelled = true;
    };
  }, [fileUrl, previewFile, renderDocxPreview]);

  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  const handleFileUpload = useCallback(
    async (selectedFile: File) => {
      const lowerCaseName = selectedFile.name.toLowerCase();
      const isDocxMime =
        selectedFile.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const isDocxExt = lowerCaseName.endsWith(".docx");
      if (!isDocxMime && !isDocxExt) {
        toast.error("Загрузите DOCX файл.");
        return;
      }

      try {
        setIsUploadingFile(true);
        const uploadedUrl = await uploadMutation.mutateAsync(selectedFile);
        setFileUrl(uploadedUrl);
        setFileName(selectedFile.name);
        setPreviewFile(selectedFile);
        toast.success("DOCX файл успешно загружен.");
      } catch (error) {
        console.error("Failed to upload document template DOCX:", error);
        toast.error("Не удалось загрузить DOCX файл.");
      } finally {
        setIsUploadingFile(false);
      }
    },
    [uploadMutation]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const selectedFile = acceptedFiles[0];
      if (!selectedFile) return;
      void handleFileUpload(selectedFile);
    },
    [handleFileUpload]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    multiple: false,
    disabled: isBusy,
    noClick: true,
    noKeyboard: true,
    accept: {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
  });

  const uploadBlockClassName = useMemo(() => {
    if (isDragActive) {
      return "border-brand-400 bg-brand-50";
    }
    return "border-gray-300 bg-gray-50";
  }, [isDragActive]);

  const handleSubmit = async () => {
    const preparedTitle = title.trim();
    const preparedDescription = description.trim();
    const preparedFile = fileUrl.trim();

    if (!preparedTitle) {
      toast.error("Название шаблона обязательно.");
      return;
    }

    if (!preparedFile) {
      toast.error("DOCX файл обязателен.");
      return;
    }

    try {
      if (isEditMode) {
        await updateMutation.mutateAsync({
          guid,
          data: {
            title: preparedTitle,
            description: preparedDescription,
            file: preparedFile,
          },
        });
        toast.success("Шаблон документа обновлен.");
        navigate(`/settings/documents/templates/${guid}`);
      } else {
        const result = await createMutation.mutateAsync({
          title: preparedTitle,
          description: preparedDescription,
          file: preparedFile,
        });
        toast.success("Шаблон документа создан.");

        const createdGuid = result?.response?.guid || result?.guid;
        if (createdGuid) {
          navigate(`/settings/documents/templates/${String(createdGuid)}`);
          return;
        }
        navigate("/settings/documents?tab=templates");
      }
    } catch (error) {
      console.error("Failed to create document template:", error);
      toast.error("Не удалось сохранить шаблон документа.");
    }
  };

  const handleAutoResize = (event: React.FormEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  if (isEditMode && isTemplateLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
        Загрузка шаблона...
      </div>
    );
  }

  if (isEditMode && isTemplateError) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
        Шаблон документа не найден.
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title={isEditMode ? "Редактирование шаблона документа | Настройки" : "Новый шаблон документа | Настройки"}
        description={isEditMode ? "Редактирование шаблона документа" : "Добавление шаблона документа"}
      />

      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-[320px] flex-1 space-y-1">
            <textarea
              ref={titleInputRef}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onInput={handleAutoResize}
              placeholder="Новый шаблон документа"
              rows={1}
              className="w-full resize-none overflow-hidden rounded-lg border border-transparent bg-transparent px-3 py-1 text-4xl font-semibold leading-tight text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-200"
            />
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              onInput={handleAutoResize}
              placeholder="Описание шаблона"
              rows={1}
              className="w-full resize-none overflow-hidden rounded-lg border border-transparent bg-transparent px-3 py-1 text-base font-medium text-gray-500 outline-none placeholder:text-gray-400 focus:border-gray-200"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-11"
              onClick={() => navigate("/settings/documents?tab=templates")}
              disabled={isBusy}
            >
              Отмена
            </Button>
            <Button
              className="h-11"
              onClick={handleSubmit}
              disabled={isBusy}
            >
              {isSaving ? "Сохранение..." : isUploadingFile ? "Загрузка файла..." : "Сохранить"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-theme-xs">
            <div className="border-b border-gray-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-900">DOCX шаблон</h2>
            </div>

            <div className="space-y-4 p-4">
              <input {...getInputProps()} />

              {!fileUrl ? (
                <div
                  {...getRootProps()}
                  className={`rounded-xl border border-dashed p-6 transition ${uploadBlockClassName}`}
                >
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-gray-600 shadow-theme-xs">
                      <UploadCloud size={20} />
                    </div>
                    <p className="text-sm font-semibold text-gray-800">
                      {isDragActive ? "Отпустите DOCX файл здесь" : "Перетащите DOCX файл сюда"}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">или нажмите, чтобы выбрать файл</p>
                    <button
                      type="button"
                      onClick={open}
                      className="mt-4 text-sm font-semibold text-brand-600 hover:underline"
                    >
                      Выбрать файл
                    </button>
                  </div>
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-gray-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileText size={16} className="shrink-0 text-gray-500" />
                      <span className="truncate text-sm font-medium text-gray-700">
                        {fileName || "Загруженный DOCX"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" className="h-9 px-3 py-2" onClick={open} disabled={isBusy}>
                        Заменить
                      </Button>

                      <a
                        href={fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                      >
                        <ExternalLink size={14} />
                        Открыть DOCX
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          setFileUrl("");
                          setFileName("");
                          setPreviewFile(null);
                          setPreviewError("");
                          if (previewContainerRef.current) {
                            previewContainerRef.current.innerHTML = "";
                          }
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-500 transition hover:bg-gray-50 hover:text-error-600"
                        aria-label="Удалить файл"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="h-[72vh] min-h-[520px] overflow-auto bg-gray-50 p-4">
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      {isRenderingPreview && (
                        <div className="py-8 text-center text-sm text-gray-500">Загрузка DOCX предпросмотра...</div>
                      )}

                      {previewError && (
                        <div className="py-8 text-center text-sm text-error-600">{previewError}</div>
                      )}

                      <div ref={previewContainerRef} className="min-h-[320px]" />
                    </div>
                  </div>
                </div>
              )}

              {isUploadingFile && (
                <p className="text-xs text-gray-500">Загрузка DOCX файла...</p>
              )}
            </div>
          </div>

          <div className="flex max-h-[calc(100vh-150px)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs">
            <h3 className="text-lg font-semibold text-gray-900">Доступные переменные</h3>
            <p className="mt-2 text-sm font-medium text-gray-500">Поля сотрудника</p>

            <div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
              {AVAILABLE_EMPLOYEE_VARIABLES.map((variable) => (
                <div
                  key={variable.key}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                >
                  <p className="font-mono text-sm text-gray-800">{variable.key}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{variable.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
