import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../components/common/PageMeta";
import Button from "../../../components/ui/button/Button";
import { Modal } from "../../../components/ui/modal";
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
import { useTranslation } from "../../../i18n";

const ROOT_KEY = "__root__";

export default function DepartmentsSettingsPage() {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [isUpsertModalOpen, setIsUpsertModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);
  const [departmentTitle, setDepartmentTitle] = useState("");
  const [parentDepartmentId, setParentDepartmentId] = useState("");
  const [leaderUserId, setLeaderUserId] = useState("");

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
    const options: Option[] = [{ value: "", label: t("settings_departments.page.no_parent") }];

    const allowed = departments
      .filter((dep) => !forbiddenParentIds.has(dep.guid))
      .sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "ru"));

    for (const dep of allowed) {
      const level = departmentLevels.get(dep.guid) || 0;
      const prefix = level > 0 ? `${"|- ".repeat(Math.min(level, 4))}` : "";
      options.push({
        value: dep.guid,
        label: `${prefix}${String(dep.title || t("settings_departments.page.untitled"))}`,
      });
    }

    return options;
  }, [departmentLevels, departments, forbiddenParentIds, t]);

  const leaderFallbackLabel = useMemo(
    () => (editingDepartment ? resolveDepartmentLeaderName(editingDepartment) : ""),
    [editingDepartment]
  );

  const openCreateModal = () => {
    setEditingDepartment(null);
    setDepartmentTitle("");
    setParentDepartmentId("");
    setLeaderUserId("");
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  };

  const openEditModal = (department: Department) => {
    setEditingDepartment(department);
    setDepartmentTitle(String(department.title || ""));
    setParentDepartmentId(department.departments_id || "");
    setLeaderUserId(department.user_base_id || "");
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  };

  const closeUpsertModal = () => {
    setIsUpsertModalOpen(false);
    setEditingDepartment(null);
    setDepartmentTitle("");
    setParentDepartmentId("");
    setLeaderUserId("");
  };

  const handleSubmit = async () => {
    const title = departmentTitle.trim();

    if (!title) {
      toast.error(t("settings_departments.page.title_required"));
      return;
    }

    const payload = {
      title,
      departments_id: parentDepartmentId || null,
      user_base_id: leaderUserId || null,
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
        toast.success(t("settings_departments.page.update_success"));
      } else {
        await createMutation.mutateAsync(payload);
        toast.success(t("settings_departments.page.create_success"));
      }

      closeUpsertModal();
    } catch (error) {
      console.error("Failed to save department:", error);
      toast.error(t("settings_departments.page.save_error"));
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
      toast.success(t("settings_departments.page.delete_success"));
      closeDeleteModal();
    } catch (error) {
      console.error("Failed to delete department:", error);
      toast.error(t("settings_departments.page.delete_error"));
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

  return (
    <>
      <PageMeta title={t("settings_departments.page.page_meta_title")} description={t("settings_departments.page.page_meta_description")} />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-gray-900">{t("settings_departments.page.title")}</h1>
          <Button className="h-11" startIcon={<Plus size={16} />} onClick={openCreateModal}>
            {t("settings_departments.page.add_button")}
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
                placeholder={t("settings_departments.page.search_placeholder")}
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
        leaderFallbackLabel={leaderFallbackLabel}
        parentOptions={parentOptions}
        onClose={closeUpsertModal}
        onDepartmentTitleChange={setDepartmentTitle}
        onParentDepartmentChange={setParentDepartmentId}
        onLeaderChange={setLeaderUserId}
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
            <h3 className="text-base font-semibold text-gray-900">{t("settings_departments.page.delete_modal_title")}</h3>
            <button
              type="button"
              onClick={closeDeleteModal}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label={t("settings_departments.page.close_aria")}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4 text-center">
          <p className="text-sm text-gray-700">
            {departmentToDelete
              ? t("settings_departments.page.delete_confirm_named", { title: String(departmentToDelete.title) })
              : t("settings_departments.page.delete_confirm_generic")}
          </p>

          {deletingHasChildren && (
            <p className="text-xs text-error-600">
              {t("settings_departments.page.delete_has_children")}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={closeDeleteModal}
              className="w-full justify-center px-3 py-2 text-sm"
            >
              {t("settings_departments.page.cancel")}
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleteMutation.isLoading}
              className="w-full justify-center bg-error-600 px-3 py-2 text-sm hover:bg-error-700"
            >
              {deleteMutation.isLoading ? t("settings_departments.page.deleting") : t("settings_departments.page.delete_action")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
