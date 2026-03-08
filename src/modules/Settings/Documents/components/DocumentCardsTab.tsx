import { type ChangeEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { MoreHorizontal, Search, X } from "lucide-react";
import { toast } from "sonner";
import FileInput from "../../../../components/form/input/FileInput";
import Button from "../../../../components/ui/button/Button";
import { Modal } from "../../../../components/ui/modal";
import { Dropdown } from "../../../../components/ui/dropdown/Dropdown";
import { DropdownItem } from "../../../../components/ui/dropdown/DropdownItem";
import Pagination from "../../../../components/pagination";
import { useUploadFile } from "../../../../api/services/file-upload.service";
import {
  type SettingsDirectoryItem,
  useCreateSettingsDirectoryItem,
  useDeleteSettingsDirectoryItem,
  useSettingsDirectoryQuery,
  useUpdateSettingsDirectoryItem,
} from "../../../../api/services/settingsDirectory.service";

const PAGE_SIZE = 20;

export type DocumentsCardItem = SettingsDirectoryItem & {
  description?: string;
  file?: string;
  documents_count?: number;
  document_count?: number;
  templates_count?: number;
  template_count?: number;
};

type DocumentCardsTabProps = {
  slug: string;
  createRequestId: number;
  isActive: boolean;
  emptyText: string;
  itemTitle: string;
  createModalTitle: string;
  editModalTitle: string;
  deleteModalTitle: string;
  titleRequiredText: string;
  descriptionLabel: string;
  createSuccessText: string;
  updateSuccessText: string;
  deleteSuccessText: string;
  saveErrorText: string;
  deleteErrorText: string;
  includeFileField?: boolean;
  fileRequiredText?: string;
  onCardClick?: (item: DocumentsCardItem) => void;
  showCount?: boolean;
};

const resolveCount = (item: DocumentsCardItem): number | null => {
  const count =
    item.documents_count ??
    item.document_count ??
    item.templates_count ??
    item.template_count;
  return typeof count === "number" ? count : null;
};

export default function DocumentCardsTab({
  slug,
  createRequestId,
  isActive,
  emptyText,
  itemTitle,
  createModalTitle,
  editModalTitle,
  deleteModalTitle,
  titleRequiredText,
  descriptionLabel,
  createSuccessText,
  updateSuccessText,
  deleteSuccessText,
  saveErrorText,
  deleteErrorText,
  includeFileField = false,
  fileRequiredText = "Поле файла обязательно.",
  onCardClick,
  showCount = false,
}: DocumentCardsTabProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isUpsertModalOpen, setIsUpsertModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DocumentsCardItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<DocumentsCardItem | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState("");
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [openActionsFor, setOpenActionsFor] = useState<string | null>(null);
  const actionButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
      setCurrentPage(1);
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchValue]);

  const queryParams = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    }),
    [currentPage, debouncedSearch]
  );

  const { data, isLoading, isFetching } = useSettingsDirectoryQuery({
    slug,
    params: queryParams,
  });
  const uploadMutation = useUploadFile({ folder: "Media" });
  const createMutation = useCreateSettingsDirectoryItem(slug);
  const updateMutation = useUpdateSettingsDirectoryItem(slug);
  const deleteMutation = useDeleteSettingsDirectoryItem(slug);

  const items = (data?.response || []) as DocumentsCardItem[];
  const totalCount = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setFile("");
    setIsUploadingFile(false);
  };

  const openCreateModal = () => {
    setEditingItem(null);
    resetForm();
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  };

  useEffect(() => {
    if (!isActive || createRequestId <= 0) return;
    openCreateModal();
  }, [createRequestId, isActive]);

  const openEditModal = (item: DocumentsCardItem) => {
    setEditingItem(item);
    setTitle(String(item.title || ""));
    setDescription(String(item.description || ""));
    setFile(String(item.file || ""));
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  };

  const closeUpsertModal = () => {
    setIsUpsertModalOpen(false);
    setEditingItem(null);
    resetForm();
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";
    if (!selectedFile) return;

    const isPdf =
      selectedFile.type === "application/pdf" ||
      selectedFile.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      toast.error("Загрузите PDF файл.");
      return;
    }

    try {
      setIsUploadingFile(true);
      const uploadedUrl = await uploadMutation.mutateAsync(selectedFile);
      setFile(uploadedUrl);
      toast.success("PDF файл успешно загружен.");
    } catch (error) {
      console.error(`Failed to upload PDF for slug ${slug}:`, error);
      toast.error("Не удалось загрузить PDF файл.");
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleSubmit = async () => {
    const preparedTitle = title.trim();
    const preparedDescription = description.trim();
    const preparedFile = file.trim();

    if (!preparedTitle) {
      toast.error(titleRequiredText);
      return;
    }

    if (includeFileField && !preparedFile) {
      toast.error(fileRequiredText);
      return;
    }

    const payload: { title: string; description?: string; file?: string } = {
      title: preparedTitle,
      description: preparedDescription,
    };

    if (includeFileField) {
      payload.file = preparedFile;
    }

    try {
      if (editingItem) {
        await updateMutation.mutateAsync({
          guid: editingItem.guid,
          data: {
            ...editingItem,
            ...payload,
          },
        });
        toast.success(updateSuccessText);
      } else {
        await createMutation.mutateAsync(payload);
        toast.success(createSuccessText);
      }

      closeUpsertModal();
    } catch (error) {
      console.error(`Failed to save item for slug ${slug}:`, error);
      toast.error(saveErrorText);
    }
  };

  const openDeleteModal = (item: DocumentsCardItem) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
    setOpenActionsFor(null);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setItemToDelete(null);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      await deleteMutation.mutateAsync(itemToDelete.guid);
      toast.success(deleteSuccessText);
      closeDeleteModal();
    } catch (error) {
      console.error(`Failed to delete item for slug ${slug}:`, error);
      toast.error(deleteErrorText);
    }
  };

  const isSaving = createMutation.isLoading || updateMutation.isLoading;

  const toggleActionsMenu = (guid: string) => {
    setOpenActionsFor((prev) => (prev === guid ? null : guid));
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>, item: DocumentsCardItem) => {
    if (!onCardClick) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onCardClick(item);
  };

  return (
    <>
      <div className="space-y-3">
        <label className="relative block">
          <Search
            size={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Поиск..."
            className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
          />
        </label>


        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={`${slug}-skeleton-${index}`}
                className="h-44 rounded-2xl border border-gray-200 bg-white p-5"
              >
                <div className="h-5 w-4/5 animate-pulse rounded bg-gray-200" />
                <div className="mt-3 h-4 w-5/6 animate-pulse rounded bg-gray-200" />
                <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-gray-200" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
            {emptyText}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => {
              const count = resolveCount(item);
              const itemDescription = String(item.description || "").trim();
              const isClickable = Boolean(onCardClick);

              return (
                <div
                  key={item.guid}
                  className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs transition hover:border-gray-300 ${isClickable ? "cursor-pointer" : ""}`}
                  onClick={isClickable ? () => onCardClick?.(item) : undefined}
                  onKeyDown={(event) => handleCardKeyDown(event, item)}
                  role={isClickable ? "button" : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 text-lg font-semibold text-gray-900">
                      {String(item.title || "Без названия")}
                    </h3>
                    <div className="flex items-center gap-1">
                      {showCount && typeof count === "number" && (
                        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-gray-100 px-2 text-sm font-semibold text-gray-500">
                          {count}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          toggleActionsMenu(item.guid);
                        }}
                        className="dropdown-toggle inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                        aria-label="Открыть действия"
                        ref={(el) => {
                          actionButtonRefs.current[item.guid] = el;
                        }}
                      >
                        <MoreHorizontal size={16} />
                      </button>

                      <Dropdown
                        isOpen={openActionsFor === item.guid}
                        onClose={() => setOpenActionsFor(null)}
                        className="w-40 p-1"
                        usePortal
                        anchorEl={actionButtonRefs.current[item.guid]}
                      >
                        <DropdownItem
                          onClick={() => openEditModal(item)}
                          className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-500"
                        >
                          Изменить
                        </DropdownItem>
                        <DropdownItem
                          onClick={() => openDeleteModal(item)}
                          className="rounded-lg px-3 py-2 text-sm text-error-600 hover:bg-error-50 hover:text-error-700"
                        >
                          Удалить
                        </DropdownItem>
                      </Dropdown>
                    </div>
                  </div>

                  <p className="mt-2.5 line-clamp-3 text-sm font-medium text-gray-500">
                    {itemDescription || "Без описания"}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          limit={PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
      </div>

      <Modal
        isOpen={isUpsertModalOpen}
        onClose={closeUpsertModal}
        showCloseButton={false}
        className="mx-4 w-full max-w-[640px] overflow-hidden rounded-2xl border border-gray-200 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3.5">
          <h3 className="text-xl font-semibold text-gray-900">
            {editingItem ? editModalTitle : createModalTitle}
          </h3>
          <button
            type="button"
            onClick={closeUpsertModal}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div className="space-y-2">
            <label htmlFor={`${slug}-title`} className="block text-sm font-medium text-gray-700">
              Название
            </label>
            <input
              id={`${slug}-title`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Введите название"
              autoFocus
              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor={`${slug}-description`} className="block text-sm font-medium text-gray-700">
              {descriptionLabel}
            </label>
            <textarea
              id={`${slug}-description`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Введите описание"
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
            />
          </div>

          {includeFileField && (
            <div className="space-y-2">
              <label htmlFor={`${slug}-file`} className="block text-sm font-medium text-gray-700">
                PDF файл
              </label>
              <FileInput
                id={`${slug}-file`}
                accept=".pdf,application/pdf"
                onChange={handleFileUpload}
                className={isUploadingFile ? "cursor-wait opacity-70" : ""}
              />

              {isUploadingFile && (
                <p className="text-xs text-gray-500">Загрузка PDF файла...</p>
              )}

              {file && !isUploadingFile && (
                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <a
                    href={file}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-sm font-medium text-brand-600 hover:underline"
                  >
                    Прикрепленный PDF (открыть)
                  </a>
                  <button
                    type="button"
                    onClick={() => setFile("")}
                    className="ml-2 text-xs font-medium text-gray-500 transition hover:text-error-600"
                  >
                    Удалить
                  </button>
                </div>
              )}

              {!file && !isUploadingFile && (
                <p className="text-xs text-gray-500">Загрузите PDF файл для шаблона.</p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
          <Button
            variant="outline"
            onClick={closeUpsertModal}
            className="min-w-[96px] px-3 py-2 text-sm"
          >
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSaving || isUploadingFile}
            className="min-w-[110px] px-3 py-2 text-sm"
          >
            {isSaving ? "Сохранение..." : isUploadingFile ? "Загрузка файла..." : "Сохранить"}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        showCloseButton={false}
        className="mx-4 w-full max-w-[340px] overflow-hidden rounded-2xl border border-gray-200 p-0 shadow-xl"
      >
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">{deleteModalTitle}</h3>
            <button
              type="button"
              onClick={closeDeleteModal}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="Закрыть"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4 text-center">
          <p className="text-sm text-gray-500">Это действие нельзя отменить.</p>
          <p className="text-sm text-gray-700">
            {itemToDelete
              ? `Вы уверены, что хотите удалить "${String(itemToDelete.title)}"?`
              : `Вы уверены, что хотите удалить ${itemTitle.toLowerCase()}?`}
          </p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={closeDeleteModal}
              className="w-full justify-center px-3 py-2 text-sm"
            >
              Отмена
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleteMutation.isLoading}
              className="w-full justify-center bg-error-600 px-3 py-2 text-sm hover:bg-error-700"
            >
              {deleteMutation.isLoading ? "Удаление..." : "Удалить"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
