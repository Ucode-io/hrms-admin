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
  type Position,
  useCreatePosition,
  useDeletePosition,
  usePositionsQuery,
  useUpdatePosition,
} from "../../../api/services/position.service";
import { useTranslation } from "../../../../i18n";

const PAGE_SIZE = 20;

const resolveEmployeesCount = (position: Position): number => {
  if (typeof position.employees_count === "number") return position.employees_count;
  if (typeof position.employee_count === "number") return position.employee_count;
  if (Array.isArray(position.employees)) return position.employees.length;
  return 0;
};

export default function PositionsSettingsPage() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [isUpsertModalOpen, setIsUpsertModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [positionToDelete, setPositionToDelete] = useState<Position | null>(null);
  const [positionTitle, setPositionTitle] = useState("");
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

  const { data, isLoading, isFetching } = usePositionsQuery({ params: queryParams });
  const createMutation = useCreatePosition();
  const updateMutation = useUpdatePosition();
  const deleteMutation = useDeletePosition();

  const positions = data?.response || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const openCreateModal = () => {
    setEditingPosition(null);
    setPositionTitle("");
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  };

  const openEditModal = (position: Position) => {
    setEditingPosition(position);
    setPositionTitle(String(position.title || ""));
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  };

  const closeUpsertModal = () => {
    setIsUpsertModalOpen(false);
    setEditingPosition(null);
    setPositionTitle("");
  };

  const handleSubmit = async () => {
    const title = positionTitle.trim();

    if (!title) {
      toast.error(t("settings_experience_levels.positions.title_required"));
      return;
    }

    try {
      if (editingPosition) {
        await updateMutation.mutateAsync({
          guid: editingPosition.guid,
          data: { title },
        });
        toast.success(t("settings_experience_levels.positions.update_success"));
      } else {
        await createMutation.mutateAsync({ title });
        toast.success(t("settings_experience_levels.positions.create_success"));
      }

      closeUpsertModal();
    } catch (error) {
      console.error("Failed to save position:", error);
      toast.error(t("settings_experience_levels.positions.save_error"));
    }
  };

  const openDeleteModal = (position: Position) => {
    setPositionToDelete(position);
    setIsDeleteModalOpen(true);
    setOpenActionsFor(null);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setPositionToDelete(null);
  };

  const confirmDelete = async () => {
    if (!positionToDelete) return;

    try {
      await deleteMutation.mutateAsync(positionToDelete.guid);
      toast.success(t("settings_experience_levels.positions.delete_success"));
      closeDeleteModal();
    } catch (error) {
      console.error("Failed to delete position:", error);
      toast.error(t("settings_experience_levels.positions.delete_error"));
    }
  };

  const isSaving = createMutation.isLoading || updateMutation.isLoading;

  const toggleActionsMenu = (guid: string) => {
    setOpenActionsFor((prev) => (prev === guid ? null : guid));
  };

  return (
    <>
      <PageMeta title={t("settings_experience_levels.positions.page_meta.title")} description={t("settings_experience_levels.positions.page_meta.description")} />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-gray-900">{t("settings_experience_levels.positions.heading")}</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-11"
              startIcon={<Download size={16} />}
              onClick={() => toast.info(t("settings_experience_levels.export_soon"))}
            >
              {t("settings_experience_levels.action.export")}
            </Button>
            <Button className="h-11" startIcon={<Plus size={16} />} onClick={openCreateModal}>
              {t("settings_experience_levels.positions.action.new")}
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
                placeholder={t("settings_experience_levels.positions.search_placeholder")}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
              />
            </label>
          </div>

          <div className="max-w-full overflow-x-auto border-t border-gray-100">
            <Table>
              <TableHeader className="border-b border-gray-100">
                <TableRow>
                  <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                    {t("settings_experience_levels.positions.column.title")}
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                    {t("settings_experience_levels.positions.column.employees")}
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                    {t("settings_experience_levels.positions.column.actions")}
                  </TableCell>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, index) => (
                    <TableRow key={`positions-skeleton-${index}`}>
                      <TableCell className="px-4 py-4">
                        <div className="h-4 w-60 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right">
                        <div className="ml-auto h-4 w-8 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right">
                        <div className="ml-auto h-4 w-16 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : positions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="px-4 py-10 text-center text-sm text-gray-500">
                      {t("settings_experience_levels.positions.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  positions.map((position) => (
                    <TableRow key={position.guid} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="px-4 py-3 text-sm text-gray-800">
                        {String(position.title || t("settings_experience_levels.positions.untitled"))}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right text-sm text-gray-700">
                        {resolveEmployeesCount(position)}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="relative flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => toggleActionsMenu(position.guid)}
                            className="dropdown-toggle rounded-md p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                            aria-label={t("settings_experience_levels.positions.open_actions")}
                            ref={(el) => {
                              actionButtonRefs.current[position.guid] = el;
                            }}
                          >
                            <MoreHorizontal size={16} />
                          </button>

                          <Dropdown
                            isOpen={openActionsFor === position.guid}
                            onClose={() => setOpenActionsFor(null)}
                            className="w-40 p-1"
                            usePortal
                            anchorEl={actionButtonRefs.current[position.guid]}
                          >
                            <DropdownItem
                              onClick={() => openEditModal(position)}
                              className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-500"
                            >
                              {t("settings_experience_levels.action.edit")}
                            </DropdownItem>
                            <DropdownItem
                              onClick={() => openDeleteModal(position)}
                              className="rounded-lg px-3 py-2 text-sm text-error-600 hover:bg-error-50 hover:text-error-700"
                            >
                              {t("settings_experience_levels.action.delete")}
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
            {editingPosition ? t("settings_experience_levels.positions.modal.edit_title") : t("settings_experience_levels.positions.modal.create_title")}
          </h3>
          <button
            type="button"
            onClick={closeUpsertModal}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label={t("settings_experience_levels.close")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <label htmlFor="position-title" className="block text-sm font-medium text-gray-700">
            {t("settings_experience_levels.positions.title_label")}
          </label>
          <input
            id="position-title"
            value={positionTitle}
            onChange={(event) => setPositionTitle(event.target.value)}
            placeholder={t("settings_experience_levels.positions.title_placeholder")}
            autoFocus
            className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
          />
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3">
          <Button
            variant="outline"
            onClick={closeUpsertModal}
            className="min-w-[96px] px-3 py-2 text-sm"
          >
            {t("settings_experience_levels.action.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving} className="min-w-[110px] px-3 py-2 text-sm">
            {isSaving ? t("settings_experience_levels.action.saving") : t("settings_experience_levels.action.save")}
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
            <h3 className="text-base font-semibold text-gray-900">{t("settings_experience_levels.positions.modal.delete_title")}</h3>
            <button
              type="button"
              onClick={closeDeleteModal}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label={t("settings_experience_levels.close")}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4 text-center">
          <p className="text-sm text-gray-500">
            {t("settings_experience_levels.modal.delete_irreversible")}
          </p>
          <p className="text-sm text-gray-700">
            {positionToDelete
              ? t("settings_experience_levels.positions.modal.delete_confirm_named", { title: String(positionToDelete.title) })
              : t("settings_experience_levels.positions.modal.delete_confirm_generic")}
          </p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={closeDeleteModal}
              className="w-full justify-center px-3 py-2 text-sm"
            >
              {t("settings_experience_levels.action.cancel")}
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleteMutation.isLoading}
              className="w-full justify-center bg-error-600 px-3 py-2 text-sm hover:bg-error-700"
            >
              {deleteMutation.isLoading ? t("settings_experience_levels.action.deleting") : t("settings_experience_levels.action.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
