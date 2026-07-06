import { useMemo, useRef, useState } from "react";

import { Loader2, Lock, MoreHorizontal, Plus, Shield, X } from "lucide-react";
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
import {
  MODULE_CATALOG,
  type ModuleKey,
} from "./moduleCatalog";
import {
  type Role,
  useDeleteRole,
  useRolesQuery,
  useSaveRole,
} from "../../../api/services/role.service";

export default function RolesSettingsPage() {
  const [isUpsertModalOpen, setIsUpsertModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedModules, setSelectedModules] = useState<Set<ModuleKey>>(
    new Set()
  );
  const [openActionsFor, setOpenActionsFor] = useState<string | null>(null);
  const actionButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const { data, isLoading, isFetching } = useRolesQuery({
    keepPreviousData: true,
  });
  const saveMutation = useSaveRole();
  const deleteMutation = useDeleteRole();

  const roles = useMemo(() => data ?? [], [data]);
  const isTableFetching = isFetching && !isLoading;
  const isSaving = saveMutation.isLoading;

  const openCreateModal = () => {
    setEditingRole(null);
    setTitle("");
    setDescription("");
    setSelectedModules(new Set());
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  };

  const openEditModal = (role: Role) => {
    setEditingRole(role);
    setTitle(role.title);
    setDescription(role.description);
    setSelectedModules(new Set(role.modules));
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  };

  const closeUpsertModal = () => {
    setIsUpsertModalOpen(false);
    setEditingRole(null);
    setTitle("");
    setDescription("");
    setSelectedModules(new Set());
  };

  const toggleModule = (key: ModuleKey) => {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allSelected = selectedModules.size === MODULE_CATALOG.length;
  const toggleAll = () => {
    setSelectedModules(
      allSelected ? new Set() : new Set(MODULE_CATALOG.map((m) => m.key))
    );
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("Название роли обязательно.");
      return;
    }

    try {
      await saveMutation.mutateAsync({
        id: editingRole?.id,
        role: {
          title: trimmedTitle,
          description: description.trim(),
          modules: MODULE_CATALOG.filter((m) =>
            selectedModules.has(m.key)
          ).map((m) => m.key),
        },
      });
      toast.success(editingRole ? "Роль обновлена." : "Роль создана.");
      closeUpsertModal();
    } catch (error) {
      console.error("Failed to save role:", error);
      toast.error("Не удалось сохранить роль. Попробуйте еще раз.");
    }
  };

  const openDeleteModal = (role: Role) => {
    setRoleToDelete(role);
    setIsDeleteModalOpen(true);
    setOpenActionsFor(null);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setRoleToDelete(null);
  };

  const confirmDelete = async () => {
    if (!roleToDelete) return;
    try {
      await deleteMutation.mutateAsync(roleToDelete.id);
      toast.success("Роль удалена.");
      closeDeleteModal();
    } catch (error) {
      console.error("Failed to delete role:", error);
      toast.error("Не удалось удалить роль.");
    }
  };

  const toggleActionsMenu = (id: string) => {
    setOpenActionsFor((prev) => (prev === id ? null : id));
  };

  return (
    <>
      <PageMeta
        title="Роли и доступы | Настройки"
        description="Управление ролями и доступом к модулям"
      />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">
              Роли и доступы
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Создавайте роли и выбирайте, какие модули им доступны.
            </p>
          </div>
          <Button className="h-11" startIcon={<Plus size={16} />} onClick={openCreateModal}>
            Новая роль
          </Button>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white">
          <div className="relative max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100">
                <TableRow>
                  <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                    Роль
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                    Доступные модули
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                    Действия
                  </TableCell>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={`roles-skeleton-${index}`}>
                      <TableCell className="px-4 py-4">
                        <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <div className="h-4 w-64 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right">
                        <div className="ml-auto h-4 w-16 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : roles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="px-4 py-12 text-center text-sm text-gray-500">
                      <Shield size={28} className="mx-auto mb-2 text-gray-300" />
                      Роли пока не созданы. Нажмите «Новая роль», чтобы начать.
                    </TableCell>
                  </TableRow>
                ) : (
                  roles.map((role) => (
                    <TableRow key={role.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-brand-100 bg-brand-50 text-brand-500">
                            <Shield size={15} />
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-gray-800">
                              {role.title || "Без названия"}
                            </div>
                            {role.description && (
                              <div className="truncate text-xs text-gray-500">
                                {role.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {role.modules.length === 0 ? (
                            <span className="text-xs text-gray-400">Нет доступа</span>
                          ) : (
                            MODULE_CATALOG.filter((m) =>
                              role.modules.includes(m.key)
                            ).map((m) => (
                              <span
                                key={m.key}
                                className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
                              >
                                {m.label}
                              </span>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="relative flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => toggleActionsMenu(role.id)}
                            className="dropdown-toggle rounded-md p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                            aria-label="Открыть действия"
                            ref={(el) => {
                              actionButtonRefs.current[role.id] = el;
                            }}
                          >
                            <MoreHorizontal size={16} />
                          </button>

                          <Dropdown
                            isOpen={openActionsFor === role.id}
                            onClose={() => setOpenActionsFor(null)}
                            className="w-40 p-1"
                            usePortal
                            anchorEl={actionButtonRefs.current[role.id]}
                          >
                            <DropdownItem
                              onClick={() => openEditModal(role)}
                              className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-500"
                            >
                              Изменить
                            </DropdownItem>
                            <DropdownItem
                              onClick={() => openDeleteModal(role)}
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

            {isTableFetching && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
                <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm">
                  <Loader2 size={16} className="animate-spin" />
                  Загрузка...
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create / Edit */}
      <Modal
        isOpen={isUpsertModalOpen}
        onClose={closeUpsertModal}
        showCloseButton={false}
        className="mx-4 w-full max-w-[640px] overflow-hidden rounded-2xl border border-gray-200 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="text-xl font-semibold text-gray-900">
            {editingRole ? "Изменить роль" : "Новая роль"}
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

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label htmlFor="role-title" className="mb-1.5 block text-sm font-medium text-gray-700">
              Название
            </label>
            <input
              id="role-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например: HR-менеджер"
              autoFocus
              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
            />
          </div>

          <div>
            <label htmlFor="role-description" className="mb-1.5 block text-sm font-medium text-gray-700">
              Описание
            </label>
            <input
              id="role-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Короткое описание роли (необязательно)"
              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Доступные модули
              </label>
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs font-medium text-brand-500 hover:text-brand-600"
              >
                {allSelected ? "Снять все" : "Выбрать все"}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {MODULE_CATALOG.map((mod) => {
                const Icon = mod.icon;
                const checked = selectedModules.has(mod.key);
                return (
                  <button
                    key={mod.key}
                    type="button"
                    onClick={() => toggleModule(mod.key)}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      checked
                        ? "border-brand-300 bg-brand-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                        checked
                          ? "bg-brand-100 text-brand-600"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-800">
                        {mod.label}
                      </span>
                      <span className="block truncate text-xs text-gray-500">
                        {mod.description}
                      </span>
                    </span>
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                        checked
                          ? "border-brand-500 bg-brand-500 text-white"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      {checked && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path
                            d="M10 3L4.5 8.5L2 6"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3">
          <Button variant="outline" onClick={closeUpsertModal} className="min-w-[96px] px-3 py-2 text-sm">
            Отмена
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving} className="min-w-[110px] px-3 py-2 text-sm">
            {isSaving ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </Modal>

      {/* Delete */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        showCloseButton={false}
        className="mx-4 w-full max-w-[360px] overflow-hidden rounded-2xl border border-gray-200 p-0 shadow-xl"
      >
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Удалить роль</h3>
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
          <p className="inline-flex items-center gap-1.5 text-xs text-gray-500">
            <Lock size={13} /> Сотрудники с этой ролью останутся без роли.
          </p>
          <p className="text-sm text-gray-700">
            {roleToDelete
              ? `Вы уверены, что хотите удалить роль "${roleToDelete.title}"?`
              : "Вы уверены, что хотите удалить эту роль?"}
          </p>

          <div className="flex gap-2">
            <Button variant="outline" onClick={closeDeleteModal} className="w-full justify-center px-3 py-2 text-sm">
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
