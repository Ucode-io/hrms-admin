import { type ChangeEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  Download,
  Eye,
  File,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  Image,
  Search,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import type { StylesConfig } from "react-select";
import Button from "../../../../components/ui/button/Button";
import { Modal } from "../../../../components/ui/modal";
import EmployeeInfiniteSelect from "../../../../components/autocomplete/EmployeeInfiniteSelect";
import { useUploadFile } from "../../../../api/services/file-upload.service";
import {
  useCreateDocument,
  useDeleteDocument,
  useDocumentsQuery,
} from "../../../../api/services/document.service";
import { useSettingsDirectoryQuery } from "../../../../api/services/settingsDirectory.service";

type DocumentsSectionProps = {
  employeeGuid?: string;
  brandColor: string;
};

type DocumentFolderItem = {
  guid: string;
  title: string;
  description?: string;
  [key: string]: unknown;
};

type EmployeeDocumentItem = {
  guid: string;
  name?: string;
  file?: string;
  type?: string[] | string;
  user_base_id?: string | null;
  user_base_id_data?: {
    first_name?: string | null;
    second_name?: string | null;
    middle_name?: string | null;
    email?: string | null;
    phone?: string | null;
    [key: string]: unknown;
  } | null;
  document_folders_id?: string | null;
  document_folders_id_data?: {
    guid?: string;
    title?: string;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

const FOLDERS_SLUG = "document_folders";
const TEMPLATES_SLUG = "document_templates";

type TemplateItem = {
  guid: string;
  title?: string;
  description?: string;
  file?: string;
  [key: string]: unknown;
};

type SelectOption = {
  value: string;
  label: string;
};

const detectDocumentType = (file: File): string => {
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (mime.includes("word") || name.endsWith(".doc") || name.endsWith(".docx")) {
    return "doc";
  }
  if (mime.includes("spreadsheet") || name.endsWith(".xls") || name.endsWith(".xlsx")) {
    return "xlsx";
  }

  return "file";
};

const getGenerateEmployeeSelectStyles = (): StylesConfig<SelectOption, false> => ({
  control: (base, state) => ({
    ...base,
    minHeight: "44px",
    height: "44px",
    borderColor: state.isFocused ? "var(--color-brand-500)" : "#cbd5e1",
    borderRadius: "0.75rem",
    boxShadow: state.isFocused ? "0 0 0 3px rgba(var(--company-color-rgb, 70, 95, 255), 0.10)" : "none",
    "&:hover": {
      borderColor: state.isFocused ? "var(--color-brand-500)" : "#cbd5e1",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "0 12px",
    fontSize: "14px",
    color: "#0f172a",
  }),
  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0,
    fontSize: "14px",
    color: "#0f172a",
  }),
  indicatorsContainer: (base) => ({
    ...base,
    height: "42px",
  }),
  indicatorSeparator: (base) => ({
    ...base,
    backgroundColor: "#e2e8f0",
  }),
  singleValue: (base) => ({
    ...base,
    fontSize: "14px",
    color: "#0f172a",
  }),
  placeholder: (base) => ({
    ...base,
    fontSize: "14px",
    color: "#94a3b8",
  }),
  option: (base, state) => ({
    ...base,
    fontSize: "14px",
    cursor: "pointer",
    backgroundColor: state.isSelected ? "var(--color-brand-500)" : state.isFocused ? "#f8fafc" : "white",
    color: state.isSelected ? "white" : "#0f172a",
    padding: "10px 12px",
  }),
  menu: (base) => ({
    ...base,
    zIndex: 100100,
    borderRadius: "0.75rem",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 100100,
  }),
});

const normalizeDocumentType = (value: EmployeeDocumentItem["type"]): string => {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" && value[0] ? value[0] : "file";
  }
  if (typeof value === "string" && value) {
    return value;
  }
  return "file";
};

const resolveFolderId = (doc: EmployeeDocumentItem): string => {
  if (typeof doc.document_folders_id === "string" && doc.document_folders_id) {
    return doc.document_folders_id;
  }

  if (
    doc.document_folders_id_data &&
    typeof doc.document_folders_id_data.guid === "string" &&
    doc.document_folders_id_data.guid
  ) {
    return doc.document_folders_id_data.guid;
  }

  return "";
};

const getDocumentName = (doc: EmployeeDocumentItem): string => {
  if (doc.name && String(doc.name).trim()) {
    return String(doc.name).trim();
  }

  if (doc.file && String(doc.file).trim()) {
    const parts = String(doc.file).split("/");
    return parts[parts.length - 1] || "Без названия";
  }

  return "Без названия";
};

const getDocumentEmployeeLabel = (doc: EmployeeDocumentItem): string => {
  const employee = doc.user_base_id_data;
  if (!employee || typeof employee !== "object") return "";

  const fullName = [
    employee.second_name,
    employee.first_name,
    employee.middle_name,
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .join(" ");

  if (fullName) return fullName;
  if (typeof employee.email === "string" && employee.email.trim()) return employee.email.trim();
  if (typeof employee.phone === "string" && employee.phone.trim()) return employee.phone.trim();
  return "";
};

const getDocumentEmployeePhoto = (doc: EmployeeDocumentItem): string => {
  const employee = doc.user_base_id_data as { photo?: unknown } | null;
  const photo = employee?.photo;
  return typeof photo === "string" && photo.trim() ? photo.trim() : "";
};

const getEmployeeInitials = (label: string): string =>
  label
    .split(" ")
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();

const getTypeBadgeColor = (type: string): string => {
  switch (type) {
    case "image":
      return "bg-blue-100 text-blue-700";
    case "video":
      return "bg-purple-100 text-purple-700";
    case "pdf":
      return "bg-red-100 text-red-700";
    case "doc":
      return "bg-indigo-100 text-indigo-700";
    case "xlsx":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
};

const DocumentTypeIcon = ({ type, className = "h-5 w-5" }: { type: string; className?: string }) => {
  switch (type) {
    case "image":
      return <Image className={className} />;
    case "video":
      return <Video className={className} />;
    case "pdf":
    case "doc":
      return <FileText className={className} />;
    case "xlsx":
      return <FileSpreadsheet className={className} />;
    default:
      return <File className={className} />;
  }
};

export default function EmployeeDocumentsSection({
  employeeGuid,
  brandColor,
}: DocumentsSectionProps) {
  const normalizedEmployeeGuid = typeof employeeGuid === "string" ? employeeGuid.trim() : "";
  const isGlobalMode = !normalizedEmployeeGuid;
  const navigate = useNavigate();
  const [uploadingFolderId, setUploadingFolderId] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState<DocumentFolderItem | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isUploadEmployeeModalOpen, setIsUploadEmployeeModalOpen] = useState(false);
  const [selectedTemplateGuid, setSelectedTemplateGuid] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");
  const [selectedGenerateEmployeeGuid, setSelectedGenerateEmployeeGuid] = useState("");
  const [selectedUploadEmployeeGuid, setSelectedUploadEmployeeGuid] = useState("");
  const [pendingUploadFolder, setPendingUploadFolder] = useState<DocumentFolderItem | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const activeFolderUploadInputRef = useRef<HTMLInputElement | null>(null);

  const { data: foldersData, isLoading: isFoldersLoading } = useSettingsDirectoryQuery({
    slug: FOLDERS_SLUG,
    params: {
      limit: 1000,
      offset: 0,
    },
  });

  const { data: docsData, isLoading: isDocsLoading } = useDocumentsQuery({
    data: normalizedEmployeeGuid ? { user_base_id: normalizedEmployeeGuid } : {},
    allowWithoutFilters: isGlobalMode,
    querySettings: {
      enabled: isGlobalMode ? true : Boolean(normalizedEmployeeGuid),
    },
  });
  const { data: templatesData, isLoading: isTemplatesLoading } = useSettingsDirectoryQuery({
    slug: TEMPLATES_SLUG,
    params: {
      limit: 1000,
      offset: 0,
      search: templateSearch.trim() || undefined,
    },
    querySettings: {
      enabled: isTemplateModalOpen,
    },
  });

  const uploadMutation = useUploadFile({ folder: "Media" });
  const createDocumentMutation = useCreateDocument();
  const deleteDocumentMutation = useDeleteDocument();

  const folders = useMemo(
    () => ((foldersData?.response || []) as DocumentFolderItem[]),
    [foldersData?.response]
  );
  const documents = useMemo(
    () => ((docsData?.response || []) as EmployeeDocumentItem[]),
    [docsData?.response]
  );
  const templates = useMemo(
    () => ((templatesData?.response || []) as TemplateItem[]),
    [templatesData?.response]
  );
  const filteredTemplates = useMemo(() => {
    const needle = templateSearch.trim().toLowerCase();
    if (!needle) return templates;
    return templates.filter((template) => {
      const title = String(template.title || "").toLowerCase();
      const description = String(template.description || "").toLowerCase();
      return title.includes(needle) || description.includes(needle);
    });
  }, [templateSearch, templates]);
  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateGuid) return filteredTemplates[0] || null;
    return filteredTemplates.find((item) => item.guid === selectedTemplateGuid) || filteredTemplates[0] || null;
  }, [filteredTemplates, selectedTemplateGuid]);

  useEffect(() => {
    if (!isTemplateModalOpen) return;
    if (selectedTemplateGuid) return;
    if (filteredTemplates.length === 0) return;
    setSelectedTemplateGuid(filteredTemplates[0].guid);
  }, [filteredTemplates, isTemplateModalOpen, selectedTemplateGuid]);

  const documentsByFolder = useMemo(() => {
    const grouped = new Map<string, EmployeeDocumentItem[]>();

    for (const folder of folders) {
      grouped.set(folder.guid, []);
    }

    for (const doc of documents) {
      const folderId = resolveFolderId(doc);
      if (!folderId) continue;

      const existing = grouped.get(folderId) || [];
      existing.push(doc);
      grouped.set(folderId, existing);
    }

    return grouped;
  }, [documents, folders]);

  const activeFolderDocuments = useMemo(() => {
    if (!activeFolder) return [];
    return documentsByFolder.get(activeFolder.guid) || [];
  }, [activeFolder, documentsByFolder]);

  const openUploadDialog = (folder: DocumentFolderItem) => {
    if (isGlobalMode) {
      setPendingUploadFolder(folder);
      setSelectedUploadEmployeeGuid("");
      setIsUploadEmployeeModalOpen(true);
      return;
    }

    const input = fileInputRefs.current[folder.guid];
    if (!input) return;
    input.click();
  };

  const openActiveFolderUploadDialog = () => {
    if (!activeFolder) return;

    if (isGlobalMode) {
      setPendingUploadFolder(activeFolder);
      setSelectedUploadEmployeeGuid("");
      setIsUploadEmployeeModalOpen(true);
      return;
    }

    activeFolderUploadInputRef.current?.click();
  };

  const closeUploadEmployeeModal = () => {
    setIsUploadEmployeeModalOpen(false);
    setPendingUploadFolder(null);
    setSelectedUploadEmployeeGuid("");
  };

  const continueUploadWithEmployee = () => {
    if (!pendingUploadFolder?.guid) return;
    if (!selectedUploadEmployeeGuid) {
      toast.error("Выберите сотрудника для документа.");
      return;
    }

    const input =
      activeFolder?.guid === pendingUploadFolder.guid
        ? activeFolderUploadInputRef.current
        : fileInputRefs.current[pendingUploadFolder.guid];

    if (!input) return;

    setIsUploadEmployeeModalOpen(false);
    input.click();
  };

  const getUploadEmployeeGuid = () => normalizedEmployeeGuid || selectedUploadEmployeeGuid;

  const uploadDocumentToFolder = async (folder: DocumentFolderItem, selectedFile: File) => {
    const uploadEmployeeGuid = getUploadEmployeeGuid();
    if (isGlobalMode && !uploadEmployeeGuid) {
      toast.error("Выберите сотрудника для документа.");
      return;
    }

    try {
      setUploadingFolderId(folder.guid);
      const uploadedUrl = await uploadMutation.mutateAsync(selectedFile);
      const detectedType = detectDocumentType(selectedFile);

      await createDocumentMutation.mutateAsync({
        name: selectedFile.name,
        file: uploadedUrl,
        type: [detectedType],
        ...(uploadEmployeeGuid ? { user_base_id: uploadEmployeeGuid } : {}),
        document_folders_id: folder.guid,
      });

      toast.success(`Документ добавлен в папку «${folder.title}».`);
    } catch (error) {
      console.error("Failed to upload employee document:", error);
      toast.error("Не удалось загрузить документ.");
    } finally {
      setUploadingFolderId(null);
      closeUploadEmployeeModal();
    }
  };

  const handleUploadToFolder = async (
    folder: DocumentFolderItem,
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";
    if (!selectedFile) {
      if (isGlobalMode) closeUploadEmployeeModal();
      return;
    }

    await uploadDocumentToFolder(folder, selectedFile);
  };

  const handleUploadToActiveFolder = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";
    if (!selectedFile || !activeFolder) {
      if (isGlobalMode) closeUploadEmployeeModal();
      return;
    }

    await uploadDocumentToFolder(activeFolder, selectedFile);
  };

  const openGenerateTemplatePicker = () => {
    if (!activeFolder?.guid) {
      toast.error("Сначала выберите папку для нового документа.");
      return;
    }
    setSelectedTemplateGuid("");
    setTemplateSearch("");
    setSelectedGenerateEmployeeGuid("");
    setIsTemplateModalOpen(true);
  };

  const closeTemplateModal = () => {
    setIsTemplateModalOpen(false);
  };

  const openGeneratePage = () => {
    if (!activeFolder?.guid || !selectedTemplate?.guid) {
      return;
    }

    const generationEmployeeGuid = normalizedEmployeeGuid || selectedGenerateEmployeeGuid;
    if (!generationEmployeeGuid) {
      toast.error("Выберите сотрудника для генерации документа.");
      return;
    }

    closeTemplateModal();
    const queryParams = new URLSearchParams({
      folderId: activeFolder.guid,
    });
    if (isGlobalMode) {
      queryParams.set("employeeId", generationEmployeeGuid);
      navigate(`/documents/generate/${selectedTemplate.guid}?${queryParams.toString()}`);
      return;
    }

    navigate(
      `/employees/${generationEmployeeGuid}/documents/generate/${selectedTemplate.guid}?${queryParams.toString()}`
    );
  };

  const handleOpenFile = (doc: EmployeeDocumentItem) => {
    if (!doc.file) {
      toast.error("У документа нет файла.");
      return;
    }

    window.open(doc.file, "_blank", "noopener,noreferrer");
  };

  const handleDownloadFile = (
    event: MouseEvent<HTMLButtonElement>,
    doc: EmployeeDocumentItem
  ) => {
    event.stopPropagation();

    if (!doc.file) {
      toast.error("У документа нет файла.");
      return;
    }

    const link = document.createElement("a");
    link.href = doc.file;
    link.download = getDocumentName(doc);
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteFile = async (
    event: MouseEvent<HTMLButtonElement>,
    doc: EmployeeDocumentItem
  ) => {
    event.stopPropagation();

    if (!doc.guid) return;

    try {
      setDeletingDocumentId(doc.guid);
      await deleteDocumentMutation.mutateAsync(doc.guid);
      toast.success(`Документ «${getDocumentName(doc)}» удален.`);
    } catch (error) {
      console.error("Failed to delete employee document:", error);
      toast.error("Не удалось удалить документ.");
    } finally {
      setDeletingDocumentId(null);
    }
  };

  if (isFoldersLoading || isDocsLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`employee-documents-folder-skeleton-${index}`}
              className="rounded-xl border border-slate-200 p-5"
            >
              <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200" />
              <div className="mt-3 h-4 w-1/3 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (folders.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-100 px-6 py-4.5">
          <div className="flex items-center gap-2">
            <span style={{ color: brandColor }}>
              <FileText className="w-4 h-4" />
            </span>
            <h3 className="m-0 text-[15px] font-bold text-slate-900">Документы</h3>
          </div>
        </div>
        <div className="px-6 py-5 text-[14px] text-slate-400">
          Папки документов не найдены.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {activeFolder ? (
          <>
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => setActiveFolder(null)}
                  className="mb-3 inline-flex items-center gap-1.5 border-none bg-transparent p-0 text-[13px] font-medium text-slate-500 transition hover:text-slate-700"
                >
                  <ChevronLeft className="h-4 w-4" />
                  К папкам
                </button>
                <h3 className="m-0 truncate text-[20px] font-bold leading-none text-slate-900">
                  {activeFolder.title || "Папка"}
                </h3>
                <p className="mt-2 text-[13px] text-slate-500">
                  {activeFolderDocuments.length} файлов
                </p>
              </div>
            </div>

            <div className="px-6 py-5">
              <div className="flex flex-wrap items-start gap-3">
                {activeFolderDocuments.map((doc) => {
                  const type = normalizeDocumentType(doc.type);
                  const docName = getDocumentName(doc);
                  const employeeLabel = getDocumentEmployeeLabel(doc);
                  const employeePhoto = getDocumentEmployeePhoto(doc);
                  const deleting = deletingDocumentId === doc.guid;

                  return (
                    <div
                      key={doc.guid}
                      className="flex h-[240px] w-full flex-col rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 sm:w-[360px]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                          <DocumentTypeIcon type={type} />
                        </div>
                        <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${getTypeBadgeColor(type)}`}>
                          {type.toUpperCase()}
                        </span>
                      </div>

                      <p className="m-0 mt-3 truncate text-[14px] font-semibold text-slate-900">{docName}</p>
                      <p className="mt-1 truncate text-[12px] text-slate-500">{doc.file || "—"}</p>
                      {employeeLabel ? (
                        <div className="mt-2.5 inline-flex max-w-full items-center gap-2 self-start rounded-full border border-slate-200 bg-slate-50 py-1 pl-1 pr-2.5">
                          {employeePhoto ? (
                            <img
                              src={employeePhoto}
                              alt={employeeLabel}
                              className="h-6 w-6 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <span
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                              style={{ backgroundColor: brandColor }}
                            >
                              {getEmployeeInitials(employeeLabel)}
                            </span>
                          )}
                          <span className="truncate text-[12px] font-medium text-slate-700">
                            {employeeLabel}
                          </span>
                        </div>
                      ) : null}

                      <div className="mt-auto pt-4 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenFile(doc)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                          title="Открыть"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => handleDownloadFile(event, doc)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                          title="Скачать"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => void handleDeleteFile(event, doc)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-100 text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                          title="Удалить"
                          disabled={deleting}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                <div className="flex h-[240px] w-[210px] shrink-0 flex-col gap-3">
                  <button
                    type="button"
                    onClick={openActiveFolderUploadDialog}
                    disabled={uploadingFolderId === activeFolder.guid}
                    className="min-h-0 flex-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-default disabled:opacity-70"
                  >
                    <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-500">
                        <Upload className="h-5 w-5" style={{ color: brandColor }} />
                      </div>
                      <p className="m-0 text-[14px] font-semibold text-slate-700">
                        {uploadingFolderId === activeFolder.guid ? "Загрузка..." : "Добавить файл"}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={openGenerateTemplatePicker}
                    className="min-h-0 flex-1 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 transition hover:border-slate-400 hover:bg-slate-100"
                  >
                    <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white text-slate-500">
                        <FilePlus2 className="h-5 w-5" style={{ color: brandColor }} />
                      </div>
                      <p className="m-0 text-[14px] font-semibold text-slate-700">Сгенерировать файл</p>
                    </div>
                  </button>
                </div>
                <input
                  ref={activeFolderUploadInputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => void handleUploadToActiveFolder(event)}
                />
              </div>

              {activeFolderDocuments.length === 0 ? (
                <p className="mt-3 text-[13px] text-slate-500">В этой папке пока нет файлов.</p>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div className="border-b border-slate-100 px-6 py-4.5">
              <div className="flex items-center gap-2">
                <span style={{ color: brandColor }}>
                  <FileText className="w-4 h-4" />
                </span>
                <h3 className="m-0 text-[15px] font-bold text-slate-900">Документы</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 px-6 py-5 md:grid-cols-2 xl:grid-cols-3">
              {folders.map((folder) => {
                const docsInFolder = documentsByFolder.get(folder.guid) || [];
                const isUploading = uploadingFolderId === folder.guid;

                return (
                  <div
                    key={folder.guid}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveFolder(folder)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setActiveFolder(folder);
                      }
                    }}
                    className="cursor-pointer rounded-xl border border-slate-200 bg-white px-5 py-4 text-left transition hover:border-slate-300"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="m-0 truncate text-[16px] font-bold text-slate-900">
                          {folder.title || "Без названия"}
                        </p>
                        <p className="mt-2 text-[13px] text-slate-500">
                          {docsInFolder.length} файлов
                        </p>
                      </div>
                      <Folder className="h-5 w-5 shrink-0 text-slate-400" />
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-medium text-slate-700"
                        onClick={(event) => {
                          event.stopPropagation();
                          setActiveFolder(folder);
                        }}
                      >
                        <FolderOpen className="h-4 w-4" />
                        Открыть
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-[13px] font-medium text-slate-700"
                        onClick={(event) => {
                          event.stopPropagation();
                          openUploadDialog(folder);
                        }}
                      >
                        <Upload className="h-4 w-4" style={{ color: brandColor }} />
                        {isUploading ? "Загрузка..." : "Добавить"}
                      </button>
                      <input
                        ref={(element) => {
                          fileInputRefs.current[folder.guid] = element;
                        }}
                        type="file"
                        className="hidden"
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => {
                          event.stopPropagation();
                          void handleUploadToFolder(folder, event);
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={isUploadEmployeeModalOpen}
        onClose={closeUploadEmployeeModal}
        className="mx-4 w-full max-w-md p-6"
      >
        <div className="space-y-4">
          <div className="pr-14">
            <h3 className="text-xl font-semibold text-slate-900">Выбор сотрудника</h3>
            <p className="mt-1 text-sm text-slate-500">
              Выберите сотрудника, к которому будет прикреплен файл
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Сотрудник</p>
            <EmployeeInfiniteSelect
              value={selectedUploadEmployeeGuid}
              onChange={setSelectedUploadEmployeeGuid}
              placeholder="Выберите сотрудника"
              styles={getGenerateEmployeeSelectStyles()}
              classNamePrefix="documents-upload-employee-select"
              menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={closeUploadEmployeeModal}>
              Отмена
            </Button>
            <Button
              onClick={continueUploadWithEmployee}
              disabled={!pendingUploadFolder || !selectedUploadEmployeeGuid}
            >
              Выбрать файл
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isTemplateModalOpen} onClose={closeTemplateModal} className="mx-4 w-full max-w-2xl p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Выбор шаблона</h3>
            <p className="mt-1 text-sm text-slate-500">Выберите шаблон для генерации документа</p>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={templateSearch}
              onChange={(event) => setTemplateSearch(event.target.value)}
              placeholder="Поиск шаблона..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
            />
          </div>

          <div className="max-h-[55vh] overflow-y-auto rounded-xl border border-slate-200 p-3">
            {isTemplatesLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`template-skeleton-${index}`}
                    className="h-[72px] animate-pulse rounded-lg border border-slate-200 bg-slate-100"
                  />
                ))}
              </div>
            ) : filteredTemplates.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                {templateSearch.trim() ? "По вашему запросу ничего не найдено." : "Шаблоны документов не найдены."}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredTemplates.map((template) => {
                  const isActive = template.guid === selectedTemplate?.guid;
                  return (
                    <button
                      key={template.guid}
                      type="button"
                      onClick={() => setSelectedTemplateGuid(template.guid)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        isActive
                          ? "border-brand-300 bg-brand-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <p className="line-clamp-2 text-sm font-semibold text-slate-900">
                        {String(template.title || "Без названия")}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                        {String(template.description || "Без описания")}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {isGlobalMode ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Сотрудник для генерации</p>
              <EmployeeInfiniteSelect
                value={selectedGenerateEmployeeGuid}
                onChange={setSelectedGenerateEmployeeGuid}
                placeholder="Выберите сотрудника"
                styles={getGenerateEmployeeSelectStyles()}
                classNamePrefix="documents-generate-employee-select"
                menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
              />
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={closeTemplateModal}>
              Отмена
            </Button>
            <Button
              onClick={openGeneratePage}
              disabled={!selectedTemplate || isTemplatesLoading || (isGlobalMode && !selectedGenerateEmployeeGuid)}
            >
              Продолжить
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
