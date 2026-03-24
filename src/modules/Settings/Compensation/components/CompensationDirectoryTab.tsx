import { useEffect, useMemo, useRef, useState } from "react";
import { MoreHorizontal, Search, TrendingDown, TrendingUp, X } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";
import Button from "../../../../components/ui/button/Button";
import { Modal } from "../../../../components/ui/modal";
import { Dropdown } from "../../../../components/ui/dropdown/Dropdown";
import { DropdownItem } from "../../../../components/ui/dropdown/DropdownItem";
import Pagination from "../../../../components/pagination";
import {
  type SettingsDirectoryItem,
  useCreateSettingsDirectoryItem,
  useDeleteSettingsDirectoryItem,
  useSettingsDirectoryQuery,
  useUpdateSettingsDirectoryItem,
} from "../../../../api/services/settingsDirectory.service";

const PAGE_SIZE = 20;

type OperationType = "income" | "deduction";

const OPERATION_LABELS: Record<OperationType, string> = {
  income: "Начисление",
  deduction: "Удержание",
};

const OPERATION_TAG_STYLES: Record<OperationType, string> = {
  income: "border-emerald-200 bg-emerald-50 text-emerald-700",
  deduction: "border-rose-200 bg-rose-50 text-rose-700",
};

const resolveOperationType = (value: unknown): OperationType => {
  if (Array.isArray(value)) {
    return value[0] === "deduction" || value[0] === "outcome" ? "deduction" : "income";
  }

  return value === "deduction" || value === "outcome" ? "deduction" : "income";
};

type CompensationDirectoryTabProps = {
  slug: string;
  emptyText: string;
  createRequestId?: number;
};

export default function CompensationDirectoryTab({
  slug,
  emptyText,
  createRequestId = 0,
}: CompensationDirectoryTabProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [isUpsertModalOpen, setIsUpsertModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SettingsDirectoryItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<SettingsDirectoryItem | null>(null);
  const [itemTitle, setItemTitle] = useState("");
  const [itemOperationType, setItemOperationType] = useState<OperationType>("income");
  const [openActionsFor, setOpenActionsFor] = useState<string | null>(null);
  const actionButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const isCompensationTypes = slug === "compensation_types";

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

  useEffect(() => {
    if (createRequestId <= 0) return;
    setEditingItem(null);
    setItemTitle("");
    setItemOperationType("income");
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  }, [createRequestId]);

  const openEditModal = (item: SettingsDirectoryItem) => {
    setEditingItem(item);
    setItemTitle(String(item.title || ""));
    setItemOperationType(resolveOperationType(item.operation_type));
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  };

  const closeUpsertModal = () => {
    setIsUpsertModalOpen(false);
    setEditingItem(null);
    setItemTitle("");
    setItemOperationType("income");
  };

  const handleSubmit = async () => {
    const title = itemTitle.trim();

    if (!title) {
      toast.error("Название обязательно.");
      return;
    }

    try {
      const payload: { title: string; operation_type?: OperationType[] } = { title };
      if (isCompensationTypes) {
        payload.operation_type = [itemOperationType];
      }

      if (editingItem) {
        await updateMutation.mutateAsync({
          guid: editingItem.guid,
          data: {
            ...editingItem,
            ...payload,
          },
        });
        toast.success("Запись успешно обновлена.");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Запись успешно создана.");
      }

      closeUpsertModal();
    } catch (error) {
      console.error(`Failed to save settings directory item (${slug}):`, error);
      toast.error("Не удалось сохранить запись. Попробуйте еще раз.");
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
      toast.success("Запись удалена.");
      closeDeleteModal();
    } catch (error) {
      console.error(`Failed to delete settings directory item (${slug}):`, error);
      toast.error("Не удалось удалить запись.");
    }
  };

  const isSaving = createMutation.isLoading || updateMutation.isLoading;

  const toggleActionsMenu = (guid: string) => {
    setOpenActionsFor((prev) => (prev === guid ? null : guid));
  };

  return (
    <>
      <div className="space-y-4">
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
                placeholder="Поиск..."
                className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
              />
            </label>
          </div>


          <div className="max-w-full overflow-x-auto border-t border-gray-100">
            <Table>
              <TableHeader className="border-b border-gray-100">
                <TableRow>
                  <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                    Название
                  </TableCell>
                  {isCompensationTypes ? (
                    <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                      Тип операции
                    </TableCell>
                  ) : null}
                  <TableCell isHeader className="px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                    Действия
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
                      {isCompensationTypes ? (
                        <TableCell className="px-4 py-4">
                          <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
                        </TableCell>
                      ) : null}
                      <TableCell className="px-4 py-4 text-right">
                        <div className="ml-auto h-4 w-16 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isCompensationTypes ? 3 : 2} className="px-4 py-10 text-center text-sm text-gray-500">
                      {emptyText}
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.guid} className="transition-colors hover:bg-gray-50">
                      <TableCell className="px-4 py-3 text-sm text-gray-800">
                        {String(item.title || "Без названия")}
                      </TableCell>
                      {isCompensationTypes ? (
                        <TableCell className="px-4 py-3 text-sm text-gray-800">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[12px] font-semibold ${OPERATION_TAG_STYLES[resolveOperationType(item.operation_type)]}`}
                          >
                            {OPERATION_LABELS[resolveOperationType(item.operation_type)]}
                          </span>
                        </TableCell>
                      ) : null}
                      <TableCell className="px-4 py-3">
                        <div className="relative flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => toggleActionsMenu(item.guid)}
                            className="dropdown-toggle rounded-md p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
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
            {editingItem ? "Изменить запись" : "Новая запись"}
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

        <div className="space-y-3 px-4 py-4">
          <label htmlFor={`${slug}-title`} className="block text-sm font-medium text-gray-700">
            Название
          </label>
          <input
            id={`${slug}-title`}
            value={itemTitle}
            onChange={(event) => setItemTitle(event.target.value)}
            placeholder="Введите название"
            autoFocus
            className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
          />

          {isCompensationTypes ? (
            <div className="pt-1">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Тип операции
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setItemOperationType("income")}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                    itemOperationType === "income"
                      ? "border-emerald-300 bg-emerald-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/50"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      itemOperationType === "income"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <TrendingUp className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-[13px] font-semibold text-slate-900">
                      Начисление
                    </span>
                    <span className="mt-0.5 block text-[12px] text-slate-500">
                      income
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setItemOperationType("deduction")}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                    itemOperationType === "deduction"
                      ? "border-rose-300 bg-rose-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-rose-200 hover:bg-rose-50/50"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      itemOperationType === "deduction"
                        ? "bg-rose-100 text-rose-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <TrendingDown className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-[13px] font-semibold text-slate-900">
                      Удержание
                    </span>
                    <span className="mt-0.5 block text-[12px] text-slate-500">
                      deduction
                    </span>
                  </span>
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3">
          <Button
            variant="outline"
            onClick={closeUpsertModal}
            className="min-w-[96px] px-3 py-2 text-sm"
          >
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving} className="min-w-[110px] px-3 py-2 text-sm">
            {isSaving ? "Сохранение..." : "Сохранить"}
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
            <h3 className="text-base font-semibold text-gray-900">Удалить запись</h3>
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
          <p className="text-sm text-gray-500">
            Это действие нельзя отменить.
          </p>
          <p className="text-sm text-gray-700">
            {itemToDelete
              ? `Вы уверены, что хотите удалить "${String(itemToDelete.title)}"?`
              : "Вы уверены, что хотите удалить эту запись?"}
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
