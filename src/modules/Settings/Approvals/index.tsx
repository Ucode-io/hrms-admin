import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ChevronLeft, MoreHorizontal, Plus, Search, X } from "lucide-react";
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
import { type ApprovalProcess, getProcessTypeLabel } from "./mockData";
import {
  useApprovalProcessesQuery,
  useDeleteApprovalProcess,
} from "../../../api/services/approval.service";

export default function ApprovalsSettingsPage() {
  const navigate = useNavigate();
  const { data: processes, isLoading } = useApprovalProcessesQuery();
  const deleteProcessMutation = useDeleteApprovalProcess();
  const items = useMemo(() => processes ?? [], [processes]);
  const [searchValue, setSearchValue] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ApprovalProcess | null>(null);
  const [openActionsFor, setOpenActionsFor] = useState<string | null>(null);
  const actionButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const filteredItems = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      [item.title, getProcessTypeLabel(item.type)].some((field) =>
        field.toLowerCase().includes(query)
      )
    );
  }, [items, searchValue]);

  const toggleActionsMenu = (id: string) => {
    setOpenActionsFor((prev) => (prev === id ? null : id));
  };

  const openDeleteModal = (item: ApprovalProcess) => {
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
      await deleteProcessMutation.mutateAsync(itemToDelete.id);
      toast.success("Процесс одобрения удалён.");
      closeDeleteModal();
    } catch (error) {
      console.error("Failed to delete approval process:", error);
      toast.error("Не удалось удалить процесс.");
    }
  };

  return (
    <>
      <PageMeta
        title="Одобрения | Настройки"
        description="Настройка процессов одобрения"
      />

      <div className="space-y-4">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-gray-700"
        >
          <ChevronLeft size={16} />
          Назад
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Одобрения</h1>
            <p className="mt-1 text-sm text-gray-500">
              Процессы многоступенчатого одобрения заявок сотрудников.
            </p>
          </div>
          <Button
            className="h-11"
            startIcon={<Plus size={16} />}
            onClick={() => navigate("/settings/approvals/new")}
          >
            Добавить процесс
          </Button>
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
                  <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                    Процесс
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                    Департаменты
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                    Этапы
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                    Действия
                  </TableCell>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100">
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                      {isLoading ? "Загрузка…" : "Процессы одобрения не найдены"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id} className="transition-colors hover:bg-gray-50">
                      <TableCell className="px-4 py-3 text-sm text-gray-800">
                        <Link
                          to={`/settings/approvals/${item.id}`}
                          className="font-medium text-brand-600 transition hover:text-brand-700"
                        >
                          {item.title || "Без названия"}
                        </Link>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-700">
                        {getProcessTypeLabel(item.type)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-700">
                        <div className="flex flex-wrap gap-1.5">
                          {item.departments.length === 0 ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            item.departments.map((dep) => (
                              <span
                                key={dep.id}
                                className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
                              >
                                {dep.title}
                              </span>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                        {item.stages.length}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="relative flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => toggleActionsMenu(item.id)}
                            className="dropdown-toggle rounded-md p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                            aria-label="Открыть действия"
                            ref={(el) => {
                              actionButtonRefs.current[item.id] = el;
                            }}
                          >
                            <MoreHorizontal size={16} />
                          </button>

                          <Dropdown
                            isOpen={openActionsFor === item.id}
                            onClose={() => setOpenActionsFor(null)}
                            className="w-40 p-1"
                            usePortal
                            anchorEl={actionButtonRefs.current[item.id]}
                          >
                            <DropdownItem
                              onClick={() => navigate(`/settings/approvals/${item.id}`)}
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
        </div>
      </div>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        showCloseButton={false}
        className="mx-4 w-full max-w-[340px] overflow-hidden rounded-2xl border border-gray-200 p-0 shadow-xl"
      >
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Удалить процесс</h3>
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
              ? `Вы уверены, что хотите удалить "${itemToDelete.title}"?`
              : "Вы уверены, что хотите удалить этот процесс?"}
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
              onClick={() => void confirmDelete()}
              disabled={deleteProcessMutation.isLoading}
              className="w-full justify-center bg-error-600 px-3 py-2 text-sm hover:bg-error-700"
            >
              {deleteProcessMutation.isLoading ? "Удаление…" : "Удалить"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
