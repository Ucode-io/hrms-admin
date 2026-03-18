import { type ChangeEvent, type MouseEvent, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  Download,
  Eye,
  File,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  Image,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { useUploadFile } from "../../../../api/services/file-upload.service";
import {
  useCreateDocument,
  useDeleteDocument,
  useDocumentsQuery,
} from "../../../../api/services/document.service";
import { useSettingsDirectoryQuery } from "../../../../api/services/settingsDirectory.service";

type DocumentsSectionProps = {
  employeeGuid: string;
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
  document_folders_id?: string | null;
  document_folders_id_data?: {
    guid?: string;
    title?: string;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

const FOLDERS_SLUG = "document_folders";

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
  const [uploadingFolderId, setUploadingFolderId] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState<DocumentFolderItem | null>(null);
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
    data: {
      user_base_id: employeeGuid,
    },
    querySettings: {
      enabled: Boolean(employeeGuid),
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

  const openUploadDialog = (folderGuid: string) => {
    const input = fileInputRefs.current[folderGuid];
    if (!input) return;
    input.click();
  };

  const uploadDocumentToFolder = async (folder: DocumentFolderItem, selectedFile: File) => {
    try {
      setUploadingFolderId(folder.guid);
      const uploadedUrl = await uploadMutation.mutateAsync(selectedFile);
      const detectedType = detectDocumentType(selectedFile);

      await createDocumentMutation.mutateAsync({
        name: selectedFile.name,
        file: uploadedUrl,
        type: [detectedType],
        user_base_id: employeeGuid,
        document_folders_id: folder.guid,
      });

      toast.success(`Документ добавлен в папку «${folder.title}».`);
    } catch (error) {
      console.error("Failed to upload employee document:", error);
      toast.error("Не удалось загрузить документ.");
    } finally {
      setUploadingFolderId(null);
    }
  };

  const handleUploadToFolder = async (
    folder: DocumentFolderItem,
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";
    if (!selectedFile) return;

    await uploadDocumentToFolder(folder, selectedFile);
  };

  const handleUploadToActiveFolder = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";
    if (!selectedFile || !activeFolder) return;

    await uploadDocumentToFolder(activeFolder, selectedFile);
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
                  const deleting = deletingDocumentId === doc.guid;

                  return (
                    <div
                      key={doc.guid}
                      className="w-full rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 sm:w-[360px]"
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

                      <div className="mt-4 flex items-center gap-2">
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

                <button
                  type="button"
                  onClick={() => activeFolderUploadInputRef.current?.click()}
                  disabled={uploadingFolderId === activeFolder.guid}
                  className="h-[140px] w-[140px] shrink-0 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 transition hover:border-slate-400 hover:bg-slate-100 disabled:cursor-default disabled:opacity-70"
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
                          openUploadDialog(folder.guid);
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
    </>
  );
}
