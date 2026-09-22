import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Download,
  MoreHorizontal,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../components/common/PageMeta";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import Button from "../../../components/ui/button/Button";
import { Modal } from "../../../components/ui/modal";
import { Dropdown } from "../../../components/ui/dropdown/Dropdown";
import { DropdownItem } from "../../../components/ui/dropdown/DropdownItem";
import Pagination from "../../../components/pagination";
import {
  type SettingsDirectoryItem,
  useCreateSettingsDirectoryItem,
  useDeleteSettingsDirectoryItem,
  useSettingsDirectoryQuery,
  useUpdateSettingsDirectoryItem,
} from "../../../api/services/settingsDirectory.service";
import { useTranslation } from "../../../i18n";

const PAGE_SIZE = 20;

type SimpleDirectorySettingsPageProps = {
  slug: string;
  metaTitle: string;
  pageTitle: string;
  pageDescription: string;
  emptyText: string;
  includeDuration?: boolean;
};

export default function SimpleDirectorySettingsPage({
  slug,
  metaTitle,
  pageTitle,
  pageDescription,
  emptyText,
  includeDuration = false,
}: SimpleDirectorySettingsPageProps) {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [isUpsertModalOpen, setIsUpsertModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SettingsDirectoryItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<SettingsDirectoryItem | null>(null);
  const [itemTitle, setItemTitle] = useState("");
  const [itemDuration, setItemDuration] = useState(1);
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
  const createMutation = useCreateSettingsDirectoryItem(slug);
  const updateMutation = useUpdateSettingsDirectoryItem(slug);
  const deleteMutation = useDeleteSettingsDirectoryItem(slug);

  const items = data?.response || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const openCreateModal = () => {
    setEditingItem(null);
    setItemTitle("");
    setItemDuration(1);
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  };

  const openEditModal = (item: SettingsDirectoryItem) => {
    setEditingItem(item);
    setItemTitle(String(item.title || ""));
    const duration = typeof item.duration === "number" ? item.duration : 1;
    setItemDuration(duration > 0 ? duration : 1);
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  };

  const closeUpsertModal = () => {
    setIsUpsertModalOpen(false);
    setEditingItem(null);
    setItemTitle("");
    setItemDuration(1);
  };

  const handleSubmit = async () => {
    const title = itemTitle.trim();

    if (!title) {
      toast.error(t("settings_directory.title_required"));
      return;
    }

    if (includeDuration && (!Number.isInteger(itemDuration) || itemDuration <= 0)) {
      toast.error(t("settings_directory.duration_invalid"));
      return;
    }

    const payload: { title: string;[key: string]: unknown } = { title };
    if (includeDuration) {
      payload.duration = itemDuration;
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
        toast.success(t("settings_directory.updated"));
      } else {
        await createMutation.mutateAsync(payload);
        toast.success(t("settings_directory.created"));
      }

      closeUpsertModal();
    } catch (error) {
      console.error(`Failed to save settings directory item (${slug}):`, error);
      toast.error(t("settings_directory.save_failed"));
    }
  };

  const openDeleteModal = (item: SettingsDirectoryItem) => {
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
      toast.success(t("settings_directory.deleted"));
      closeDeleteModal();
    } catch (error) {
      console.error(`Failed to delete settings directory item (${slug}):`, error);
      toast.error(t("settings_directory.delete_failed"));
    }
  };

  const isSaving = createMutation.isLoading || updateMutation.isLoading;

  const toggleActionsMenu = (guid: string) => {
    setOpenActionsFor((prev) => (prev === guid ? null : guid));
  };

  return (
    <>
      <PageMeta title={metaTitle} description={pageDescription} />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-gray-900">{pageTitle}</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-11"
              startIcon={<Download size={16} />}
              onClick={() => toast.info(t("settings_directory.export_later"))}
            >
              {t("settings_directory.export")}
            </Button>
            <Button className="h-11" startIcon={<Plus size={16} />} onClick={openCreateModal}>
              {t("settings_directory.new")}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 p-4">
            <label className="relative block">
              <Search
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder={t("settings_directory.search_placeholder")}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
              />
            </label>
          </div>

          <div className="max-w-full overflow-x-auto border-t border-gray-100">
            <Table>
              <TableHeader className="border-b border-gray-100">
                <TableRow>
                  <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                    {t("settings_directory.col_title")}
                  </TableCell>
                  {includeDuration && (
                    <TableCell isHeader className="px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                      {t("settings_directory.col_duration")}
                    </TableCell>
                  )}
                  <TableCell isHeader className="px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                    {t("settings_directory.col_actions")}
                  </TableCell>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, index) => (
                    <TableRow key={`${slug}-skeleton-${index}`}>
                      <TableCell className="px-4 py-4">
                        <div className="h-4 w-60 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                      {includeDuration && (
                        <TableCell className="px-4 py-4 text-right">
                          <div className="ml-auto h-4 w-10 animate-pulse rounded bg-gray-200" />
                        </TableCell>
                      )}
                      <TableCell className="px-4 py-4 text-right">
                        <div className="ml-auto h-4 w-16 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={includeDuration ? 3 : 2} className="px-4 py-10 text-center text-sm text-gray-500">
                      {emptyText}
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.guid} className="transition-colors hover:bg-gray-50">
                      <TableCell className="px-4 py-3 text-sm text-gray-800">
                        {String(item.title || t("employees.detail.no_title"))}
                      </TableCell>
                      {includeDuration && (
                        <TableCell className="px-4 py-3 text-right text-sm text-gray-700">
                          {typeof item.duration === "number" ? item.duration : "-"}
                        </TableCell>
                      )}
                      <TableCell className="px-4 py-3">
                        <div className="relative flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => toggleActionsMenu(item.guid)}
                            className="dropdown-toggle rounded-md p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                            aria-label={t("settings_directory.open_actions_aria")}
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
                              {t("settings_directory.edit")}
                            </DropdownItem>
                            <DropdownItem
                              onClick={() => openDeleteModal(item)}
                              className="rounded-lg px-3 py-2 text-sm text-error-600 hover:bg-error-50 hover:text-error-700"
                            >
                              {t("common.delete")}
                            </DropdownItem>
                          </Dropdown>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            limit={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      <Modal
        isOpen={isUpsertModalOpen}
        onClose={closeUpsertModal}
        showCloseButton={false}
        className="mx-4 w-full max-w-[560px] overflow-hidden rounded-2xl border border-gray-200 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3.5">
          <h3 className="text-xl font-semibold text-gray-900">
            {editingItem ? t("settings_directory.edit_record_title") : t("settings_directory.new_record_title")}
          </h3>
          <button
            type="button"
            onClick={closeUpsertModal}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label={t("settings_directory.close_aria")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <label htmlFor={`${slug}-title`} className="block text-sm font-medium text-gray-700">
            {t("settings_directory.title_label")}
          </label>
          <input
            id={`${slug}-title`}
            value={itemTitle}
            onChange={(event) => setItemTitle(event.target.value)}
            placeholder={t("settings_directory.title_placeholder")}
            autoFocus
            className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
          />
          {includeDuration && (
            <div className="space-y-2">
              <label
                htmlFor={`${slug}-duration`}
                className="block text-sm font-medium text-gray-700"
              >
                {t("settings_directory.col_duration")}
              </label>
              <div className="flex gap-2">
                <input
                  id={`${slug}-duration`}
                  type="number"
                  min={1}
                  step={1}
                  value={itemDuration}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isNaN(value)) return;
                    setItemDuration(Math.max(1, Math.floor(value)));
                  }}
                  className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 min-w-[40px] px-0"
                  onClick={() => setItemDuration((prev) => Math.max(1, prev - 1))}
                >
                  -
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 min-w-[40px] px-0"
                  onClick={() => setItemDuration((prev) => prev + 1)}
                >
                  +
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3">
          <Button
            variant="outline"
            onClick={closeUpsertModal}
            className="min-w-[96px] px-3 py-2 text-sm"
          >
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving} className="min-w-[110px] px-3 py-2 text-sm">
            {isSaving ? t("common.saving") : t("common.save")}
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
            <h3 className="text-base font-semibold text-gray-900">{t("settings_directory.delete_record_title")}</h3>
            <button
              type="button"
              onClick={closeDeleteModal}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label={t("settings_directory.close_aria")}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4 text-center">
          <p className="text-sm text-gray-500">
            {t("settings_directory.cannot_undo")}
          </p>
          <p className="text-sm text-gray-700">
            {itemToDelete
              ? t("settings_directory.delete_confirm_named", { title: String(itemToDelete.title) })
              : t("settings_directory.delete_confirm_generic")}
          </p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={closeDeleteModal}
              className="w-full justify-center px-3 py-2 text-sm"
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleteMutation.isLoading}
              className="w-full justify-center bg-error-600 px-3 py-2 text-sm hover:bg-error-700"
            >
              {deleteMutation.isLoading ? t("settings_directory.deleting") : t("common.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
