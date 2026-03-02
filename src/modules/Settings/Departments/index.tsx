import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Search,
  X,
} from "lucide-react";
import Select, { type StylesConfig } from "react-select";
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
  type Department,
  useCreateDepartment,
  useDeleteDepartment,
  useDepartmentsSettingsQuery,
  useUpdateDepartment,
} from "../../../api/services/department.service";

type Option = {
  value: string;
  label: string;
};

type FlattenedTreeRow = {
  department: Department;
  level: number;
  hasChildren: boolean;
};

const ROOT_KEY = "__root__";

const resolveEmployeesCount = (department: Department): number => {
  if (typeof department.employees_count === "number") return department.employees_count;
  if (typeof department.employee_count === "number") return department.employee_count;
  if (Array.isArray(department.employees)) return department.employees.length;
  return 0;
};

const getParentSelectStyles = (): StylesConfig<Option, false> => ({
  control: (base, state) => ({
    ...base,
    minHeight: "36px",
    height: "36px",
    borderColor: state.isFocused ? "var(--color-brand-500)" : "#d1d5db",
    borderRadius: "0.5rem",
    boxShadow: state.isFocused ? "0 0 0 3px rgba(var(--company-color-rgb, 70, 95, 255), 0.12)" : "none",
    "&:hover": {
      borderColor: state.isFocused ? "var(--color-brand-500)" : "#9ca3af",
    },
  }),
  valueContainer: (base) => ({ ...base, padding: "0 10px", fontSize: "14px" }),
  input: (base) => ({ ...base, margin: 0, padding: 0, fontSize: "14px" }),
  indicatorsContainer: (base) => ({ ...base, height: "34px" }),
  option: (base, state) => ({
    ...base,
    fontSize: "14px",
    cursor: "pointer",
    backgroundColor: state.isSelected ? "var(--color-brand-500)" : state.isFocused ? "#f3f4f6" : "white",
    color: state.isSelected ? "white" : "#111827",
    padding: "8px 10px",
  }),
  menu: (base) => ({
    ...base,
    zIndex: 100000,
    borderRadius: "0.5rem",
    border: "1px solid #e5e7eb",
  }),
  menuPortal: (base) => ({
    ...base,
    zIndex: 100000,
  }),
  singleValue: (base) => ({ ...base, fontSize: "14px" }),
  placeholder: (base) => ({ ...base, fontSize: "14px", color: "#9ca3af" }),
});

export default function DepartmentsSettingsPage() {
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [isUpsertModalOpen, setIsUpsertModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);
  const [departmentTitle, setDepartmentTitle] = useState("");
  const [parentDepartmentId, setParentDepartmentId] = useState("");

  const [expandedGuids, setExpandedGuids] = useState<string[]>([]);
  const [openActionsFor, setOpenActionsFor] = useState<string | null>(null);

  const actionButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const initializedExpandRef = useRef(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim().toLowerCase());
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchValue]);

  const { data, isLoading, isFetching } = useDepartmentsSettingsQuery({
    params: { limit: 1000 },
  });

  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment();
  const deleteMutation = useDeleteDepartment();

  const departments = data?.response || [];

  useEffect(() => {
    if (initializedExpandRef.current || departments.length === 0) {
      return;
    }

    const parents = new Set<string>();
    for (const dep of departments) {
      if (dep.departments_id) {
        parents.add(dep.departments_id);
      }
    }

    setExpandedGuids(Array.from(parents));
    initializedExpandRef.current = true;
  }, [departments]);

  const departmentsById = useMemo(
    () => new Map(departments.map((dep) => [dep.guid, dep])),
    [departments]
  );

  const filteredDepartments = useMemo(() => {
    if (!debouncedSearch) {
      return departments;
    }

    const keep = new Set<string>();

    for (const dep of departments) {
      const title = String(dep.title || "").toLowerCase();
      if (!title.includes(debouncedSearch)) {
        continue;
      }

      let current: Department | undefined = dep;
      while (current) {
        if (keep.has(current.guid)) {
          break;
        }

        keep.add(current.guid);
        current = current.departments_id
          ? departmentsById.get(current.departments_id)
          : undefined;
      }
    }

    return departments.filter((dep) => keep.has(dep.guid));
  }, [departments, departmentsById, debouncedSearch]);

  const filteredIds = useMemo(
    () => new Set(filteredDepartments.map((dep) => dep.guid)),
    [filteredDepartments]
  );

  const childrenByParent = useMemo(() => {
    const map = new Map<string, Department[]>();

    for (const dep of filteredDepartments) {
      const parentKey = dep.departments_id && filteredIds.has(dep.departments_id)
        ? dep.departments_id
        : ROOT_KEY;

      if (!map.has(parentKey)) {
        map.set(parentKey, []);
      }

      map.get(parentKey)?.push(dep);
    }

    for (const children of map.values()) {
      children.sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "ru"));
    }

    return map;
  }, [filteredDepartments, filteredIds]);

  const flattenedRows = useMemo<FlattenedTreeRow[]>(() => {
    const rows: FlattenedTreeRow[] = [];
    const searchMode = Boolean(debouncedSearch);

    const walk = (parentKey: string, level: number) => {
      const children = childrenByParent.get(parentKey) || [];

      for (const child of children) {
        const hasChildren = (childrenByParent.get(child.guid)?.length || 0) > 0;
        rows.push({
          department: child,
          level,
          hasChildren,
        });

        const isExpanded = searchMode || expandedGuids.includes(child.guid);
        if (hasChildren && isExpanded) {
          walk(child.guid, level + 1);
        }
      }
    };

    walk(ROOT_KEY, 0);
    return rows;
  }, [childrenByParent, debouncedSearch, expandedGuids]);

  const departmentsWithChildren = useMemo(() => {
    const withChildren = new Set<string>();
    for (const dep of departments) {
      if (dep.departments_id) {
        withChildren.add(dep.departments_id);
      }
    }
    return withChildren;
  }, [departments]);

  const departmentLevels = useMemo(() => {
    const levels = new Map<string, number>();

    const allIds = new Set(departments.map((dep) => dep.guid));
    const map = new Map<string, Department[]>();

    for (const dep of departments) {
      const parentKey = dep.departments_id && allIds.has(dep.departments_id)
        ? dep.departments_id
        : ROOT_KEY;

      if (!map.has(parentKey)) {
        map.set(parentKey, []);
      }

      map.get(parentKey)?.push(dep);
    }

    const walk = (parentKey: string, level: number) => {
      const children = map.get(parentKey) || [];
      for (const child of children) {
        levels.set(child.guid, level);
        walk(child.guid, level + 1);
      }
    };

    walk(ROOT_KEY, 0);
    return levels;
  }, [departments]);

  const forbiddenParentIds = useMemo(() => {
    if (!editingDepartment) {
      return new Set<string>();
    }

    const blocked = new Set<string>([editingDepartment.guid]);
    const queue = [editingDepartment.guid];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId) continue;

      for (const dep of departments) {
        if (dep.departments_id === currentId && !blocked.has(dep.guid)) {
          blocked.add(dep.guid);
          queue.push(dep.guid);
        }
      }
    }

    return blocked;
  }, [departments, editingDepartment]);

  const parentOptions = useMemo<Option[]>(() => {
    const options: Option[] = [{ value: "", label: "Без родителя" }];

    const allowed = departments
      .filter((dep) => !forbiddenParentIds.has(dep.guid))
      .sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "ru"));

    for (const dep of allowed) {
      const level = departmentLevels.get(dep.guid) || 0;
      const prefix = level > 0 ? `${"|- ".repeat(Math.min(level, 4))}` : "";
      options.push({ value: dep.guid, label: `${prefix}${String(dep.title || "Без названия")}` });
    }

    return options;
  }, [departmentLevels, departments, forbiddenParentIds]);

  const selectedParentOption = useMemo(
    () => parentOptions.find((option) => option.value === parentDepartmentId) || parentOptions[0],
    [parentDepartmentId, parentOptions]
  );

  const openCreateModal = () => {
    setEditingDepartment(null);
    setDepartmentTitle("");
    setParentDepartmentId("");
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  };

  const openEditModal = (department: Department) => {
    setEditingDepartment(department);
    setDepartmentTitle(String(department.title || ""));
    setParentDepartmentId(department.departments_id || "");
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  };

  const closeUpsertModal = () => {
    setIsUpsertModalOpen(false);
    setEditingDepartment(null);
    setDepartmentTitle("");
    setParentDepartmentId("");
  };

  const handleSubmit = async () => {
    const title = departmentTitle.trim();

    if (!title) {
      toast.error("Название департамента обязательно.");
      return;
    }

    const payload = {
      title,
      departments_id: parentDepartmentId || null,
    };

    try {
      if (editingDepartment) {
        await updateMutation.mutateAsync({
          guid: editingDepartment.guid,
          data: {
            ...editingDepartment,
            ...payload,
          },
        });
        toast.success("Департамент успешно обновлен.");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Департамент успешно создан.");
      }

      closeUpsertModal();
    } catch (error) {
      console.error("Failed to save department:", error);
      toast.error("Не удалось сохранить департамент. Попробуйте еще раз.");
    }
  };

  const openDeleteModal = (department: Department) => {
    setDepartmentToDelete(department);
    setIsDeleteModalOpen(true);
    setOpenActionsFor(null);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setDepartmentToDelete(null);
  };

  const confirmDelete = async () => {
    if (!departmentToDelete) return;

    try {
      await deleteMutation.mutateAsync(departmentToDelete.guid);
      toast.success("Департамент удален.");
      closeDeleteModal();
    } catch (error) {
      console.error("Failed to delete department:", error);
      toast.error("Не удалось удалить департамент.");
    }
  };

  const isSaving = createMutation.isLoading || updateMutation.isLoading;

  const toggleActionsMenu = (guid: string) => {
    setOpenActionsFor((prev) => (prev === guid ? null : guid));
  };

  const toggleNode = (guid: string) => {
    setExpandedGuids((prev) =>
      prev.includes(guid) ? prev.filter((id) => id !== guid) : [...prev, guid]
    );
  };

  const deletingHasChildren = Boolean(
    departmentToDelete && departmentsWithChildren.has(departmentToDelete.guid)
  );

  const menuPortalTarget = typeof document !== "undefined" ? document.body : null;

  return (
    <>
      <PageMeta title="Департаменты | Настройки" description="Структура департаментов компании" />

      <div className="space-y-4">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-gray-700"
        >
          <ChevronLeft size={16} />
          Назад
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-gray-900">Департаменты</h1>
          <Button className="h-11" startIcon={<Plus size={16} />} onClick={openCreateModal}>
            Добавить
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

          {isFetching && (
            <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-400">
              Обновление...
            </div>
          )}

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
                    <TableRow key={`departments-skeleton-${index}`}>
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
                ) : flattenedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="px-4 py-10 text-center text-sm text-gray-500">
                      Департаменты не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  flattenedRows.map((row) => {
                    const { department, level, hasChildren } = row;
                    const isExpanded = expandedGuids.includes(department.guid);

                    return (
                      <TableRow key={department.guid} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="px-4 py-3 text-sm text-gray-800">
                          <div
                            className="flex items-center gap-2"
                            style={{ paddingLeft: `${level * 26}px` }}
                          >
                            {hasChildren ? (
                              <button
                                type="button"
                                onClick={() => toggleNode(department.guid)}
                                className="rounded-md p-0.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                                aria-label={isExpanded ? "Свернуть" : "Развернуть"}
                              >
                                {isExpanded || debouncedSearch ? (
                                  <ChevronDown size={16} />
                                ) : (
                                  <ChevronRight size={16} />
                                )}
                              </button>
                            ) : (
                              <span className="inline-block h-4 w-4" />
                            )}

                            <span>{String(department.title || "Без названия")}</span>
                          </div>
                        </TableCell>

                        <TableCell className="px-4 py-3 text-right text-sm text-gray-700">
                          {resolveEmployeesCount(department)}
                        </TableCell>

                        <TableCell className="px-4 py-3">
                          <div className="relative flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => toggleActionsMenu(department.guid)}
                              className="dropdown-toggle rounded-md p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                              aria-label="Открыть действия"
                              ref={(el) => {
                                actionButtonRefs.current[department.guid] = el;
                              }}
                            >
                              <MoreHorizontal size={16} />
                            </button>

                            <Dropdown
                              isOpen={openActionsFor === department.guid}
                              onClose={() => setOpenActionsFor(null)}
                              className="w-40 p-1"
                              usePortal
                              anchorEl={actionButtonRefs.current[department.guid]}
                            >
                              <DropdownItem
                                onClick={() => openEditModal(department)}
                                className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-500"
                              >
                                Изменить
                              </DropdownItem>
                              <DropdownItem
                                onClick={() => openDeleteModal(department)}
                                className="rounded-lg px-3 py-2 text-sm text-error-600 hover:bg-error-50 hover:text-error-700"
                              >
                                Удалить
                              </DropdownItem>
                            </Dropdown>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
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
            {editingDepartment ? "Изменить департамент" : "Новый департамент"}
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
          <div>
            <label htmlFor="department-title" className="mb-1.5 block text-sm font-medium text-gray-700">
              Название
            </label>
            <input
              id="department-title"
              value={departmentTitle}
              onChange={(event) => setDepartmentTitle(event.target.value)}
              placeholder="Введите название департамента"
              autoFocus
              className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Родительский департамент
            </label>
            <Select
              options={parentOptions}
              value={selectedParentOption}
              onChange={(option) => setParentDepartmentId(option?.value || "")}
              placeholder="Выберите департамент"
              isSearchable
              styles={getParentSelectStyles()}
              menuPortalTarget={menuPortalTarget || undefined}
              menuPosition="fixed"
              classNamePrefix="department-parent-select"
              noOptionsMessage={() => "Ничего не найдено"}
            />
          </div>
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
        className="mx-4 w-full max-w-[360px] overflow-hidden rounded-2xl border border-gray-200 p-0 shadow-xl"
      >
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Удалить департамент</h3>
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
          <p className="text-sm text-gray-700">
            {departmentToDelete
              ? `Вы уверены, что хотите удалить "${String(departmentToDelete.title)}"?`
              : "Вы уверены, что хотите удалить этот департамент?"}
          </p>

          {deletingHasChildren && (
            <p className="text-xs text-error-600">
              У выбранного департамента есть дочерние элементы. Сначала перенесите или удалите их.
            </p>
          )}

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
