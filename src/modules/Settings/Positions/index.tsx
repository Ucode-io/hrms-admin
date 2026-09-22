import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ChevronDown,
  ChevronRight,
  Download,
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
  type Position,
  useCreatePosition,
  useDeletePosition,
  usePositionsQuery,
  useUpdatePosition,
} from "../../../api/services/position.service";
import { useExperienceLevelGroupsQuery } from "../../../api/services/experienceLevelGroup.service";
import { useTranslation } from "../../../i18n";

type Option = {
  value: string;
  label: string;
};

type FlattenedTreeRow = {
  position: Position;
  level: number;
  hasChildren: boolean;
};

const ROOT_KEY = "__root__";

const resolveParentPositionId = (position: Position): string | null => {
  const rawValue = position.positions_id;
  return typeof rawValue === "string" && rawValue ? rawValue : null;
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

export default function PositionsSettingsPage() {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [isUpsertModalOpen, setIsUpsertModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [positionToDelete, setPositionToDelete] = useState<Position | null>(null);
  const [positionTitle, setPositionTitle] = useState("");
  const [positionGroupId, setPositionGroupId] = useState("");
  const [parentPositionId, setParentPositionId] = useState("");

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

  const { data, isLoading } = usePositionsQuery({
    params: { all: true },
  });
  const { data: groupsData } = useExperienceLevelGroupsQuery({ params: { limit: 200, offset: 0 } });
  const createMutation = useCreatePosition();
  const updateMutation = useUpdatePosition();
  const deleteMutation = useDeletePosition();

  const positions = useMemo(() => data?.response || [], [data?.response]);
  const experienceLevelGroups = useMemo(() => groupsData?.response || [], [groupsData?.response]);
  const groupTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of experienceLevelGroups) {
      map.set(group.guid, String(group.title || t("settings_misc.positions.untitled")));
    }
    return map;
  }, [experienceLevelGroups]);
  const groupOptions = useMemo<Option[]>(() => {
    const options: Option[] = [{ value: "", label: t("settings_misc.positions.no_group") }];
    for (const group of [...experienceLevelGroups].sort((a, b) =>
      String(a.title || "").localeCompare(String(b.title || ""), "ru")
    )) {
      options.push({ value: group.guid, label: String(group.title || t("settings_misc.positions.untitled")) });
    }
    return options;
  }, [experienceLevelGroups]);
  const selectedGroupOption = useMemo(
    () => groupOptions.find((option) => option.value === positionGroupId) || groupOptions[0],
    [groupOptions, positionGroupId]
  );

  useEffect(() => {
    if (initializedExpandRef.current || positions.length === 0) {
      return;
    }

    const parents = new Set<string>();
    for (const pos of positions) {
      const parentId = resolveParentPositionId(pos);
      if (parentId) {
        parents.add(parentId);
      }
    }

    setExpandedGuids(Array.from(parents));
    initializedExpandRef.current = true;
  }, [positions]);

  const positionsById = useMemo(
    () => new Map(positions.map((position) => [position.guid, position])),
    [positions]
  );

  const filteredPositions = useMemo(() => {
    if (!debouncedSearch) {
      return positions;
    }

    const keep = new Set<string>();

    for (const pos of positions) {
      const title = String(pos.title || "").toLowerCase();
      if (!title.includes(debouncedSearch)) {
        continue;
      }

      let current: Position | undefined = pos;
      while (current) {
        if (keep.has(current.guid)) {
          break;
        }

        keep.add(current.guid);
        const parentId = resolveParentPositionId(current);
        current = parentId ? positionsById.get(parentId) : undefined;
      }
    }

    return positions.filter((pos) => keep.has(pos.guid));
  }, [debouncedSearch, positions, positionsById]);

  const filteredIds = useMemo(
    () => new Set(filteredPositions.map((position) => position.guid)),
    [filteredPositions]
  );

  const childrenByParent = useMemo(() => {
    const map = new Map<string, Position[]>();

    for (const pos of filteredPositions) {
      const parentId = resolveParentPositionId(pos);
      const parentKey = parentId && filteredIds.has(parentId) ? parentId : ROOT_KEY;

      if (!map.has(parentKey)) {
        map.set(parentKey, []);
      }

      map.get(parentKey)?.push(pos);
    }

    for (const children of map.values()) {
      children.sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "ru"));
    }

    return map;
  }, [filteredIds, filteredPositions]);

  const flattenedRows = useMemo<FlattenedTreeRow[]>(() => {
    const rows: FlattenedTreeRow[] = [];
    const searchMode = Boolean(debouncedSearch);

    const walk = (parentKey: string, level: number) => {
      const children = childrenByParent.get(parentKey) || [];

      for (const child of children) {
        const hasChildren = (childrenByParent.get(child.guid)?.length || 0) > 0;
        rows.push({
          position: child,
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

  const positionsWithChildren = useMemo(() => {
    const withChildren = new Set<string>();
    for (const position of positions) {
      const parentId = resolveParentPositionId(position);
      if (parentId) {
        withChildren.add(parentId);
      }
    }
    return withChildren;
  }, [positions]);

  const positionLevels = useMemo(() => {
    const levels = new Map<string, number>();

    const allIds = new Set(positions.map((position) => position.guid));
    const map = new Map<string, Position[]>();

    for (const position of positions) {
      const parentId = resolveParentPositionId(position);
      const parentKey = parentId && allIds.has(parentId) ? parentId : ROOT_KEY;

      if (!map.has(parentKey)) {
        map.set(parentKey, []);
      }

      map.get(parentKey)?.push(position);
    }

    const walk = (parentKey: string, level: number) => {
      const children = map.get(parentKey) || [];
      children.sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "ru"));

      for (const child of children) {
        levels.set(child.guid, level);
        walk(child.guid, level + 1);
      }
    };

    walk(ROOT_KEY, 0);
    return levels;
  }, [positions]);

  const forbiddenParentIds = useMemo(() => {
    if (!editingPosition) {
      return new Set<string>();
    }

    const blocked = new Set<string>([editingPosition.guid]);
    const queue = [editingPosition.guid];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId) continue;

      for (const position of positions) {
        if (resolveParentPositionId(position) === currentId && !blocked.has(position.guid)) {
          blocked.add(position.guid);
          queue.push(position.guid);
        }
      }
    }

    return blocked;
  }, [editingPosition, positions]);

  const parentOptions = useMemo<Option[]>(() => {
    const options: Option[] = [{ value: "", label: t("settings_misc.positions.no_parent") }];

    const allowed = positions
      .filter((position) => !forbiddenParentIds.has(position.guid))
      .sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "ru"));

    for (const position of allowed) {
      const level = positionLevels.get(position.guid) || 0;
      const prefix = level > 0 ? `${"|- ".repeat(Math.min(level, 4))}` : "";
      options.push({
        value: position.guid,
        label: `${prefix}${String(position.title || t("settings_misc.positions.untitled"))}`,
      });
    }

    return options;
  }, [forbiddenParentIds, positionLevels, positions]);

  const selectedParentOption = useMemo(
    () => parentOptions.find((option) => option.value === parentPositionId) || parentOptions[0],
    [parentOptions, parentPositionId]
  );

  const openCreateModal = () => {
    setEditingPosition(null);
    setPositionTitle("");
    setParentPositionId("");
    setPositionGroupId("");
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  };

  const openEditModal = (position: Position) => {
    setEditingPosition(position);
    setPositionTitle(String(position.title || ""));
    setParentPositionId(resolveParentPositionId(position) || "");
    setPositionGroupId(
      typeof position.experience_level_groups_id === "string"
        ? position.experience_level_groups_id
        : ""
    );
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  };

  const closeUpsertModal = () => {
    setIsUpsertModalOpen(false);
    setEditingPosition(null);
    setPositionTitle("");
    setParentPositionId("");
    setPositionGroupId("");
  };

  const handleSubmit = async () => {
    const title = positionTitle.trim();

    if (!title) {
      toast.error(t("settings_misc.positions.title_required"));
      return;
    }

    const payload = {
      title,
      positions_id: parentPositionId || null,
      experience_level_groups_id: positionGroupId || null,
    };

    try {
      if (editingPosition) {
        await updateMutation.mutateAsync({
          guid: editingPosition.guid,
          data: {
            ...editingPosition,
            ...payload,
          },
        });
        toast.success(t("settings_misc.positions.update_success"));
      } else {
        await createMutation.mutateAsync(payload);
        toast.success(t("settings_misc.positions.create_success"));
      }

      closeUpsertModal();
    } catch (error) {
      console.error("Failed to save position:", error);
      toast.error(t("settings_misc.positions.save_error"));
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
      toast.success(t("settings_misc.positions.delete_success"));
      closeDeleteModal();
    } catch (error) {
      console.error("Failed to delete position:", error);
      toast.error(t("settings_misc.positions.delete_error"));
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
    positionToDelete && positionsWithChildren.has(positionToDelete.guid)
  );

  const menuPortalTarget = typeof document !== "undefined" ? document.body : null;

  return (
    <>
      <PageMeta title={t("settings_misc.positions.page_title")} description={t("settings_misc.positions.page_description")} />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-gray-900">{t("settings_misc.positions.heading")}</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-11"
              startIcon={<Download size={16} />}
              onClick={() => toast.info(t("settings_misc.positions.export_soon"))}
            >
              {t("settings_misc.positions.export")}
            </Button>
            <Button className="h-11" startIcon={<Plus size={16} />} onClick={openCreateModal}>
              {t("settings_misc.positions.new")}
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
                placeholder={t("settings_misc.positions.search_placeholder")}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
              />
            </label>
          </div>

          <div className="max-w-full overflow-x-auto border-t border-gray-100">
            <Table>
              <TableHeader className="border-b border-gray-100">
                <TableRow>
                  <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                    {t("settings_misc.positions.col_title")}
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                    {t("settings_misc.positions.col_level_group")}
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                    {t("settings_misc.positions.col_actions")}
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
                      <TableCell className="px-4 py-4">
                        <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right">
                        <div className="ml-auto h-4 w-16 animate-pulse rounded bg-gray-200" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : flattenedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="px-4 py-10 text-center text-sm text-gray-500">
                      {t("settings_misc.positions.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  flattenedRows.map((row) => {
                    const { position, level, hasChildren } = row;
                    const isExpanded = expandedGuids.includes(position.guid);

                    return (
                      <TableRow key={position.guid} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="px-4 py-3 text-sm text-gray-800">
                          <div
                            className="flex items-center gap-2"
                            style={{ paddingLeft: `${level * 26}px` }}
                          >
                            {hasChildren ? (
                              <button
                                type="button"
                                onClick={() => toggleNode(position.guid)}
                                className="rounded-md p-0.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                                aria-label={isExpanded ? t("settings_misc.positions.collapse") : t("settings_misc.positions.expand")}
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

                            <span>{String(position.title || t("settings_misc.positions.untitled"))}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700">
                          {(() => {
                            const groupId =
                              typeof position.experience_level_groups_id === "string"
                                ? position.experience_level_groups_id
                                : "";
                            const groupTitle =
                              (groupId && groupTitleById.get(groupId)) ||
                              (typeof position.experience_level_groups_id_data?.title === "string"
                                ? position.experience_level_groups_id_data.title
                                : "");
                            return groupTitle ? (
                              <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                                {groupTitle}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="relative flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => toggleActionsMenu(position.guid)}
                              className="dropdown-toggle rounded-md p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                              aria-label={t("settings_misc.positions.open_actions")}
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
                                {t("settings_misc.positions.edit")}
                              </DropdownItem>
                              <DropdownItem
                                onClick={() => openDeleteModal(position)}
                                className="rounded-lg px-3 py-2 text-sm text-error-600 hover:bg-error-50 hover:text-error-700"
                              >
                                {t("settings_misc.positions.delete")}
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
            {editingPosition ? t("settings_misc.positions.modal_edit_title") : t("settings_misc.positions.modal_create_title")}
          </h3>
          <button
            type="button"
            onClick={closeUpsertModal}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label={t("settings_misc.positions.close")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <div>
            <label htmlFor="position-title" className="mb-1.5 block text-sm font-medium text-gray-700">
              {t("settings_misc.positions.title_label")}
            </label>
            <input
              id="position-title"
              value={positionTitle}
              onChange={(event) => setPositionTitle(event.target.value)}
              placeholder={t("settings_misc.positions.title_placeholder")}
              autoFocus
              className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {t("settings_misc.positions.parent_label")}
            </label>
            <Select
              options={parentOptions}
              value={selectedParentOption}
              onChange={(option) => setParentPositionId(option?.value || "")}
              placeholder={t("settings_misc.positions.parent_placeholder")}
              isSearchable
              styles={getParentSelectStyles()}
              menuPortalTarget={menuPortalTarget || undefined}
              menuPosition="fixed"
              classNamePrefix="position-parent-select"
              noOptionsMessage={() => t("settings_misc.positions.no_options")}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {t("settings_misc.positions.level_group_label")}
            </label>
            <Select
              options={groupOptions}
              value={selectedGroupOption}
              onChange={(option) => setPositionGroupId(option?.value || "")}
              placeholder={t("settings_misc.positions.level_group_placeholder")}
              isSearchable
              styles={getParentSelectStyles()}
              menuPortalTarget={menuPortalTarget || undefined}
              menuPosition="fixed"
              classNamePrefix="position-group-select"
              noOptionsMessage={() => t("settings_misc.positions.no_options")}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3">
          <Button
            variant="outline"
            onClick={closeUpsertModal}
            className="min-w-[96px] px-3 py-2 text-sm"
          >
            {t("settings_misc.positions.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving} className="min-w-[110px] px-3 py-2 text-sm">
            {isSaving ? t("settings_misc.positions.saving") : t("settings_misc.positions.save")}
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
            <h3 className="text-base font-semibold text-gray-900">{t("settings_misc.positions.delete_modal_title")}</h3>
            <button
              type="button"
              onClick={closeDeleteModal}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label={t("settings_misc.positions.close")}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4 text-center">
          <p className="text-sm text-gray-700">
            {positionToDelete
              ? t("settings_misc.positions.delete_confirm_named", { title: String(positionToDelete.title) })
              : t("settings_misc.positions.delete_confirm_generic")}
          </p>

          {deletingHasChildren && (
            <p className="text-xs text-error-600">
              {t("settings_misc.positions.delete_has_children")}
            </p>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={closeDeleteModal}
              className="w-full justify-center px-3 py-2 text-sm"
            >
              {t("settings_misc.positions.cancel")}
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleteMutation.isLoading}
              className="w-full justify-center bg-error-600 px-3 py-2 text-sm hover:bg-error-700"
            >
              {deleteMutation.isLoading ? t("settings_misc.positions.deleting") : t("settings_misc.positions.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
