import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { ChevronLeft, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../components/common/PageMeta";
import Button from "../../../components/ui/button/Button";
import { Modal } from "../../../components/ui/modal";
import departmentExperienceLevelService, {
  useSyncDepartmentExperienceLevels,
} from "../../../api/services/departmentExperienceLevel.service";
import {
  type Department,
  useCreateDepartment,
  useDeleteDepartment,
  useDepartmentsSettingsAggregationQuery,
  useUpdateDepartment,
} from "../../../api/services/department.service";
import DepartmentUpsertModal from "./components/DepartmentUpsertModal";
import DepartmentsTable from "./components/DepartmentsTable";
import type { FlattenedTreeRow, Option } from "./types";
import { resolveDepartmentLeaderName } from "./utils";

const ROOT_KEY = "__root__";

const resolveCreatedOrUpdatedGuid = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const data = payload as Record<string, unknown>;
  if (typeof data.guid === "string" && data.guid) {
    return data.guid;
  }

  const response = data.response;
  if (response && typeof response === "object") {
    const responseObj = response as Record<string, unknown>;
    if (typeof responseObj.guid === "string" && responseObj.guid) {
      return responseObj.guid;
    }
  }

  if (Array.isArray(response)) {
    const first = response[0];
    if (first && typeof first === "object") {
      const firstObj = first as Record<string, unknown>;
      if (typeof firstObj.guid === "string" && firstObj.guid) {
        return firstObj.guid;
      }
    }
  }

  return null;
};

export default function DepartmentsSettingsPage() {
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [isUpsertModalOpen, setIsUpsertModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);
  const [departmentTitle, setDepartmentTitle] = useState("");
  const [parentDepartmentId, setParentDepartmentId] = useState("");
  const [leaderUserId, setLeaderUserId] = useState("");
  const [experienceLevelIds, setExperienceLevelIds] = useState<string[]>([]);
  const [experienceLevelFallbackOptions, setExperienceLevelFallbackOptions] = useState<Option[]>(
    []
  );
  const [isLoadingExperienceLevels, setIsLoadingExperienceLevels] = useState(false);

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

  const { data, isLoading } = useDepartmentsSettingsAggregationQuery({
    params: { limit: 1000 },
  });

  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment();
  const deleteMutation = useDeleteDepartment();
  const syncExperienceLevelsMutation = useSyncDepartmentExperienceLevels();

  const departments = useMemo(() => data?.response || [], [data?.response]);

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
  }, [debouncedSearch, departments, departmentsById]);

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

  const leaderFallbackLabel = useMemo(
    () => (editingDepartment ? resolveDepartmentLeaderName(editingDepartment) : ""),
    [editingDepartment]
  );

  const loadExperienceLevelsForDepartment = async (departmentGuid: string) => {
    setIsLoadingExperienceLevels(true);

    try {
      const relations = await departmentExperienceLevelService.getListByDepartment(departmentGuid);
      const nextIds: string[] = [];
      const fallback: Option[] = [];
      const seenFallback = new Set<string>();

      for (const relation of relations.response) {
        if (!relation.experience_levels_id) continue;
        nextIds.push(relation.experience_levels_id);

        const titleFromRelation =
          relation.experience_levels_id_data &&
          typeof relation.experience_levels_id_data === "object" &&
          typeof relation.experience_levels_id_data.title === "string"
            ? relation.experience_levels_id_data.title
            : relation.experience_levels_id;

        if (!seenFallback.has(relation.experience_levels_id)) {
          fallback.push({
            value: relation.experience_levels_id,
            label: titleFromRelation,
          });
          seenFallback.add(relation.experience_levels_id);
        }
      }

      setExperienceLevelIds(Array.from(new Set(nextIds)));
      setExperienceLevelFallbackOptions(fallback);
    } catch (error) {
      console.error("Failed to load department experience levels:", error);
      toast.error("Не удалось загрузить уровни опыта для департамента.");
      setExperienceLevelIds([]);
      setExperienceLevelFallbackOptions([]);
    } finally {
      setIsLoadingExperienceLevels(false);
    }
  };

  const openCreateModal = () => {
    setEditingDepartment(null);
    setDepartmentTitle("");
    setParentDepartmentId("");
    setLeaderUserId("");
    setExperienceLevelIds([]);
    setExperienceLevelFallbackOptions([]);
    setIsLoadingExperienceLevels(false);
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  };

  const openEditModal = (department: Department) => {
    setEditingDepartment(department);
    setDepartmentTitle(String(department.title || ""));
    setParentDepartmentId(department.departments_id || "");
    setLeaderUserId(department.user_base_id || "");
    setExperienceLevelIds([]);
    setExperienceLevelFallbackOptions([]);
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
    void loadExperienceLevelsForDepartment(department.guid);
  };

  const closeUpsertModal = () => {
    setIsUpsertModalOpen(false);
    setEditingDepartment(null);
    setDepartmentTitle("");
    setParentDepartmentId("");
    setLeaderUserId("");
    setExperienceLevelIds([]);
    setExperienceLevelFallbackOptions([]);
    setIsLoadingExperienceLevels(false);
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
      user_base_id: leaderUserId || null,
    };

    try {
      let savedDepartmentGuid: string | null = editingDepartment?.guid || null;

      if (editingDepartment) {
        const updateResult = await updateMutation.mutateAsync({
          guid: editingDepartment.guid,
          data: {
            ...editingDepartment,
            ...payload,
          },
        });
        savedDepartmentGuid = resolveCreatedOrUpdatedGuid(updateResult) || editingDepartment.guid;
        toast.success("Департамент успешно обновлен.");
      } else {
        const createResult = await createMutation.mutateAsync(payload);
        savedDepartmentGuid = resolveCreatedOrUpdatedGuid(createResult);
        toast.success("Департамент успешно создан.");
      }

      if (!savedDepartmentGuid) {
        toast.error("Департамент сохранен, но не удалось определить GUID для связи с уровнями опыта.");
        return;
      }

      await syncExperienceLevelsMutation.mutateAsync({
        departmentGuid: savedDepartmentGuid,
        experienceLevelIds,
      });

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

  const isSaving =
    createMutation.isLoading ||
    updateMutation.isLoading ||
    syncExperienceLevelsMutation.isLoading ||
    isLoadingExperienceLevels;

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

          <DepartmentsTable
            isLoading={isLoading}
            flattenedRows={flattenedRows}
            expandedGuids={expandedGuids}
            debouncedSearch={debouncedSearch}
            openActionsFor={openActionsFor}
            actionButtonRefs={actionButtonRefs}
            onToggleNode={toggleNode}
            onToggleActionsMenu={toggleActionsMenu}
            onCloseActionsMenu={() => setOpenActionsFor(null)}
            onEdit={openEditModal}
            onDelete={openDeleteModal}
            getLeaderName={resolveDepartmentLeaderName}
          />
        </div>
      </div>

      <DepartmentUpsertModal
        isOpen={isUpsertModalOpen}
        isSaving={isSaving}
        isEditing={Boolean(editingDepartment)}
        departmentTitle={departmentTitle}
        parentDepartmentId={parentDepartmentId}
        leaderUserId={leaderUserId}
        experienceLevelIds={experienceLevelIds}
        experienceLevelFallbackOptions={experienceLevelFallbackOptions}
        leaderFallbackLabel={leaderFallbackLabel}
        parentOptions={parentOptions}
        onClose={closeUpsertModal}
        onDepartmentTitleChange={setDepartmentTitle}
        onParentDepartmentChange={setParentDepartmentId}
        onLeaderChange={setLeaderUserId}
        onExperienceLevelsChange={setExperienceLevelIds}
        onSubmit={handleSubmit}
      />

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
