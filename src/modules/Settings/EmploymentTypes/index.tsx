import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  ChevronLeft,
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
  type EmploymentType,
  useCreateEmploymentType,
  useDeleteEmploymentType,
  useEmploymentTypesQuery,
  useUpdateEmploymentType,
} from "../../../api/services/employmentType.service";

const PAGE_SIZE = 20;

const resolveEmployeesCount = (employmentType: EmploymentType): number => {
  if (typeof employmentType.employees_count === "number") return employmentType.employees_count;
  if (typeof employmentType.employee_count === "number") return employmentType.employee_count;
  if (Array.isArray(employmentType.employees)) return employmentType.employees.length;
  return 0;
};

export default function EmploymentTypesSettingsPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [isUpsertModalOpen, setIsUpsertModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingEmploymentType, setEditingEmploymentType] = useState<EmploymentType | null>(null);
  const [employmentTypeToDelete, setEmploymentTypeToDelete] = useState<EmploymentType | null>(null);
  const [employmentTypeTitle, setEmploymentTypeTitle] = useState("");
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

  const { data, isLoading, isFetching } = useEmploymentTypesQuery({ params: queryParams });
  const createMutation = useCreateEmploymentType();
  const updateMutation = useUpdateEmploymentType();
  const deleteMutation = useDeleteEmploymentType();

  const employmentTypes = data?.response || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const openCreateModal = () => {
    setEditingEmploymentType(null);
    setEmploymentTypeTitle("");
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  };

  const openEditModal = (employmentType: EmploymentType) => {
    setEditingEmploymentType(employmentType);
    setEmploymentTypeTitle(String(employmentType.title || ""));
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  };

  const closeUpsertModal = () => {
    setIsUpsertModalOpen(false);
    setEditingEmploymentType(null);
    setEmploymentTypeTitle("");
  };

  const handleSubmit = async () => {
    const title = employmentTypeTitle.trim();

    if (!title) {
      toast.error("Название вида занятости обязательно.");
      return;
    }

    try {
      if (editingEmploymentType) {
        await updateMutation.mutateAsync({
          guid: editingEmploymentType.guid,
          data: {
            ...editingEmploymentType,
            title,
          },
        });
        toast.success("Вид занятости успешно обновлен.");
      } else {
        await createMutation.mutateAsync({ title });
        toast.success("Вид занятости успешно создан.");
      }

      closeUpsertModal();
    } catch (error) {
      console.error("Failed to save employment type:", error);
      toast.error("Не удалось сохранить вид занятости. Попробуйте еще раз.");
    }
  };

  const openDeleteModal = (employmentType: EmploymentType) => {
    setEmploymentTypeToDelete(employmentType);
    setIsDeleteModalOpen(true);
    setOpenActionsFor(null);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setEmploymentTypeToDelete(null);
  };

  const confirmDelete = async () => {
    if (!employmentTypeToDelete) return;

    try {
      await deleteMutation.mutateAsync(employmentTypeToDelete.guid);
      toast.success("Вид занятости удален.");
      closeDeleteModal();
    } catch (error) {
      console.error("Failed to delete employment type:", error);
      toast.error("Не удалось удалить вид занятости.");
    }
  };

  const isSaving = createMutation.isLoading || updateMutation.isLoading;

  const toggleActionsMenu = (guid: string) => {
    setOpenActionsFor((prev) => (prev === guid ? null : guid));
  };

  return (
    <>
      <PageMeta title="Виды занятости | Настройки" description="Список видов занятости компании" />

      <div className="space-y-4">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-gray-700"
        >
          <ChevronLeft size={16} />
          Назад
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-gray-900">Виды занятости</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-11"
              startIcon={<Download size={16} />}
              onClick={() => toast.info("Экспорт будет доступен позже.")}
            >
              Экспорт
            </Button>
            <Button className="h-11" startIcon={<Plus size={16} />} onClick={openCreateModal}>
              Новый
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
                  <TableCell isHeader className="px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                    Сотрудники
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                    Действия
                  </TableCell>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, index) => (
                    <TableRow key={`employment_types-skeleton-${index}`}>
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
                ) : employmentTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="px-4 py-10 text-center text-sm text-gray-500">
                      Виды занятости не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  employmentTypes.map((employmentType) => (
                    <TableRow key={employmentType.guid} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="px-4 py-3 text-sm text-gray-800">
                        {String(employmentType.title || "Без названия")}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right text-sm text-gray-700">
                        {resolveEmployeesCount(employmentType)}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="relative flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => toggleActionsMenu(employmentType.guid)}
                            className="dropdown-toggle rounded-md p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                            aria-label="Открыть действия"
                            ref={(el) => {
                              actionButtonRefs.current[employmentType.guid] = el;
                            }}
                          >
                            <MoreHorizontal size={16} />
                          </button>

                          <Dropdown
                            isOpen={openActionsFor === employmentType.guid}
                            onClose={() => setOpenActionsFor(null)}
                            className="w-40 p-1"
                            usePortal
                            anchorEl={actionButtonRefs.current[employmentType.guid]}
                          >
                            <DropdownItem
                              onClick={() => openEditModal(employmentType)}
                              className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-500"
                            >
                              Изменить
                            </DropdownItem>
                            <DropdownItem
                              onClick={() => openDeleteModal(employmentType)}
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
            {editingEmploymentType ? "Изменить вид занятости" : "Новый вид занятости"}
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
          <label htmlFor="employment-type-title" className="block text-sm font-medium text-gray-700">
            Название
          </label>
          <input
            id="employment-type-title"
            value={employmentTypeTitle}
            onChange={(event) => setEmploymentTypeTitle(event.target.value)}
            placeholder="Введите название вида занятости"
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
            <h3 className="text-base font-semibold text-gray-900">Удалить вид занятости</h3>
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
            {employmentTypeToDelete
              ? `Вы уверены, что хотите удалить "${String(employmentTypeToDelete.title)}"?`
              : "Вы уверены, что хотите удалить этот вид занятости?"}
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
