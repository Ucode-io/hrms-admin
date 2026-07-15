import { useEffect, useMemo, useRef, useState } from "react";

import {
  ChevronDown,
  ChevronRight,
  Download,
  FolderPlus,
  MoreHorizontal,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../components/common/PageMeta";
import Button from "../../../components/ui/button/Button";
import { Modal } from "../../../components/ui/modal";
import { Dropdown } from "../../../components/ui/dropdown/Dropdown";
import { DropdownItem } from "../../../components/ui/dropdown/DropdownItem";
import {
  type ExperienceLevel,
  useCreateExperienceLevel,
  useDeleteExperienceLevel,
  useExperienceLevelsQuery,
  useUpdateExperienceLevel,
} from "../../../api/services/experienceLevel.service";
import {
  type ExperienceLevelGroup,
  useCreateExperienceLevelGroup,
  useDeleteExperienceLevelGroup,
  useExperienceLevelGroupsQuery,
  useUpdateExperienceLevelGroup,
} from "../../../api/services/experienceLevelGroup.service";

export default function ExperienceLevelsSettingsPage() {
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  // Group modals
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ExperienceLevelGroup | null>(null);
  const [groupTitle, setGroupTitle] = useState("");
  const [isGroupDeleteOpen, setIsGroupDeleteOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<ExperienceLevelGroup | null>(null);

  // Level modals
  const [isLevelModalOpen, setIsLevelModalOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<ExperienceLevel | null>(null);
  const [levelTitle, setLevelTitle] = useState("");
  const [levelGroupId, setLevelGroupId] = useState("");
  const [isLevelDeleteOpen, setIsLevelDeleteOpen] = useState(false);
  const [levelToDelete, setLevelToDelete] = useState<ExperienceLevel | null>(null);

  const [openActionsFor, setOpenActionsFor] = useState<string | null>(null);
  const actionButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim().toLowerCase());
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  const { data: groupsData, isLoading: isGroupsLoading } = useExperienceLevelGroupsQuery({
    params: { limit: 200, offset: 0 },
  });
  const { data: levelsData, isLoading: isLevelsLoading } = useExperienceLevelsQuery({
    params: { limit: 1000, offset: 0 },
  });

  const createGroupMutation = useCreateExperienceLevelGroup();
  const updateGroupMutation = useUpdateExperienceLevelGroup();
  const deleteGroupMutation = useDeleteExperienceLevelGroup();

  const createLevelMutation = useCreateExperienceLevel();
  const updateLevelMutation = useUpdateExperienceLevel();
  const deleteLevelMutation = useDeleteExperienceLevel();

  const groups = useMemo(() => groupsData?.response || [], [groupsData?.response]);
  const levels = useMemo(() => levelsData?.response || [], [levelsData?.response]);

  const levelsByGroup = useMemo(() => {
    const map = new Map<string, ExperienceLevel[]>();
    for (const level of levels) {
      const key = String(level.experience_level_groups_id || "");
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(level);
    }
    for (const list of map.values()) {
      list.sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "ru"));
    }
    return map;
  }, [levels]);

  const isLoading = isGroupsLoading || isLevelsLoading;

  const visibleGroups = useMemo(() => {
    const sorted = [...groups].sort((a, b) =>
      String(a.title || "").localeCompare(String(b.title || ""), "ru")
    );

    if (!debouncedSearch) return sorted;

    return sorted.filter((group) => {
      const titleMatch = String(group.title || "").toLowerCase().includes(debouncedSearch);
      const levelMatch = (levelsByGroup.get(group.guid) || []).some((level) =>
        String(level.title || "").toLowerCase().includes(debouncedSearch)
      );
      return titleMatch || levelMatch;
    });
  }, [groups, debouncedSearch, levelsByGroup]);

  const getVisibleLevels = (groupGuid: string): ExperienceLevel[] => {
    const groupLevels = levelsByGroup.get(groupGuid) || [];
    if (!debouncedSearch) return groupLevels;

    const group = groups.find((item) => item.guid === groupGuid);
    const groupTitleMatch = String(group?.title || "").toLowerCase().includes(debouncedSearch);
    if (groupTitleMatch) return groupLevels;

    return groupLevels.filter((level) =>
      String(level.title || "").toLowerCase().includes(debouncedSearch)
    );
  };

  const toggleGroup = (guid: string) => {
    setExpandedGroups((prev) =>
      prev.includes(guid) ? prev.filter((id) => id !== guid) : [...prev, guid]
    );
  };

  const toggleActionsMenu = (key: string) => {
    setOpenActionsFor((prev) => (prev === key ? null : key));
  };

  /* ── Group handlers ── */
  const openCreateGroup = () => {
    setEditingGroup(null);
    setGroupTitle("");
    setIsGroupModalOpen(true);
    setOpenActionsFor(null);
  };

  const openEditGroup = (group: ExperienceLevelGroup) => {
    setEditingGroup(group);
    setGroupTitle(String(group.title || ""));
    setIsGroupModalOpen(true);
    setOpenActionsFor(null);
  };

  const closeGroupModal = () => {
    setIsGroupModalOpen(false);
    setEditingGroup(null);
    setGroupTitle("");
  };

  const handleGroupSubmit = async () => {
    const title = groupTitle.trim();
    if (!title) {
      toast.error("Название группы обязательно.");
      return;
    }

    try {
      if (editingGroup) {
        await updateGroupMutation.mutateAsync({
          guid: editingGroup.guid,
          data: { ...editingGroup, title },
        });
        toast.success("Группа успешно обновлена.");
      } else {
        await createGroupMutation.mutateAsync({ title });
        toast.success("Группа успешно создана.");
      }
      closeGroupModal();
    } catch (error) {
      console.error("Failed to save experience level group:", error);
      toast.error("Не удалось сохранить группу. Попробуйте еще раз.");
    }
  };

  const openDeleteGroup = (group: ExperienceLevelGroup) => {
    setGroupToDelete(group);
    setIsGroupDeleteOpen(true);
    setOpenActionsFor(null);
  };

  const closeDeleteGroup = () => {
    setIsGroupDeleteOpen(false);
    setGroupToDelete(null);
  };

  const confirmDeleteGroup = async () => {
    if (!groupToDelete) return;
    try {
      await deleteGroupMutation.mutateAsync(groupToDelete.guid);
      toast.success("Группа удалена.");
      closeDeleteGroup();
    } catch (error) {
      console.error("Failed to delete experience level group:", error);
      toast.error("Не удалось удалить группу.");
    }
  };

  /* ── Level handlers ── */
  const openCreateLevel = (groupGuid: string) => {
    setEditingLevel(null);
    setLevelTitle("");
    setLevelGroupId(groupGuid);
    setIsLevelModalOpen(true);
    setOpenActionsFor(null);
    setExpandedGroups((prev) => (prev.includes(groupGuid) ? prev : [...prev, groupGuid]));
  };

  const openEditLevel = (level: ExperienceLevel) => {
    setEditingLevel(level);
    setLevelTitle(String(level.title || ""));
    setLevelGroupId(String(level.experience_level_groups_id || ""));
    setIsLevelModalOpen(true);
    setOpenActionsFor(null);
  };

  const closeLevelModal = () => {
    setIsLevelModalOpen(false);
    setEditingLevel(null);
    setLevelTitle("");
    setLevelGroupId("");
  };

  const handleLevelSubmit = async () => {
    const title = levelTitle.trim();
    if (!title) {
      toast.error("Название уровня опыта обязательно.");
      return;
    }
    if (!levelGroupId) {
      toast.error("Выберите группу для уровня опыта.");
      return;
    }

    try {
      if (editingLevel) {
        await updateLevelMutation.mutateAsync({
          guid: editingLevel.guid,
          data: {
            ...editingLevel,
            title,
            experience_level_groups_id: levelGroupId,
          },
        });
        toast.success("Уровень опыта успешно обновлен.");
      } else {
        await createLevelMutation.mutateAsync({
          title,
          experience_level_groups_id: levelGroupId,
        });
        toast.success("Уровень опыта успешно создан.");
      }
      closeLevelModal();
    } catch (error) {
      console.error("Failed to save experience level:", error);
      toast.error("Не удалось сохранить уровень опыта. Попробуйте еще раз.");
    }
  };

  const openDeleteLevel = (level: ExperienceLevel) => {
    setLevelToDelete(level);
    setIsLevelDeleteOpen(true);
    setOpenActionsFor(null);
  };

  const closeDeleteLevel = () => {
    setIsLevelDeleteOpen(false);
    setLevelToDelete(null);
  };

  const confirmDeleteLevel = async () => {
    if (!levelToDelete) return;
    try {
      await deleteLevelMutation.mutateAsync(levelToDelete.guid);
      toast.success("Уровень опыта удален.");
      closeDeleteLevel();
    } catch (error) {
      console.error("Failed to delete experience level:", error);
      toast.error("Не удалось удалить уровень опыта.");
    }
  };

  const isSavingGroup = createGroupMutation.isLoading || updateGroupMutation.isLoading;
  const isSavingLevel = createLevelMutation.isLoading || updateLevelMutation.isLoading;

  return (
    <>
      <PageMeta title="Уровень опыта | Настройки" description="Группы и уровни опыта компании" />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-gray-900">Уровень опыта</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-11"
              startIcon={<Download size={16} />}
              onClick={() => toast.info("Экспорт будет доступен позже.")}
            >
              Экспорт
            </Button>
            <Button className="h-11" startIcon={<FolderPlus size={16} />} onClick={openCreateGroup}>
              Новая группа
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
                placeholder="Поиск по группам и уровням..."
                className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
              />
            </label>
          </div>

          <div className="p-4">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`group-skeleton-${index}`}
                    className="h-14 animate-pulse rounded-xl bg-gray-100"
                  />
                ))}
              </div>
            ) : visibleGroups.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-500">
                {debouncedSearch ? "Ничего не найдено" : "Группы уровней опыта не найдены"}
              </div>
            ) : (
              <div className="space-y-3">
                {visibleGroups.map((group) => {
                  const isExpanded = debouncedSearch
                    ? true
                    : expandedGroups.includes(group.guid);
                  const groupLevels = getVisibleLevels(group.guid);
                  const groupActionsKey = `group-${group.guid}`;

                  return (
                    <div
                      key={group.guid}
                      className="overflow-hidden rounded-xl border border-gray-200"
                    >
                      <div className="flex items-center justify-between gap-3 bg-gray-50 px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleGroup(group.guid)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <span className="text-gray-500">
                            {isExpanded ? (
                              <ChevronDown size={18} />
                            ) : (
                              <ChevronRight size={18} />
                            )}
                          </span>
                          <span className="truncate text-sm font-semibold text-gray-900">
                            {String(group.title || "Без названия")}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                            {(levelsByGroup.get(group.guid) || []).length}
                          </span>
                        </button>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            className="h-8 px-2.5 py-1 text-xs"
                            startIcon={<Plus size={14} />}
                            onClick={() => openCreateLevel(group.guid)}
                          >
                            Уровень
                          </Button>

                          <div className="relative flex items-center">
                            <button
                              type="button"
                              onClick={() => toggleActionsMenu(groupActionsKey)}
                              className="dropdown-toggle rounded-md p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                              aria-label="Открыть действия группы"
                              ref={(el) => {
                                actionButtonRefs.current[groupActionsKey] = el;
                              }}
                            >
                              <MoreHorizontal size={16} />
                            </button>

                            <Dropdown
                              isOpen={openActionsFor === groupActionsKey}
                              onClose={() => setOpenActionsFor(null)}
                              className="w-40 p-1"
                              usePortal
                              anchorEl={actionButtonRefs.current[groupActionsKey]}
                            >
                              <DropdownItem
                                onClick={() => openEditGroup(group)}
                                className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-500"
                              >
                                Изменить группу
                              </DropdownItem>
                              <DropdownItem
                                onClick={() => openDeleteGroup(group)}
                                className="rounded-lg px-3 py-2 text-sm text-error-600 hover:bg-error-50 hover:text-error-700"
                              >
                                Удалить группу
                              </DropdownItem>
                            </Dropdown>
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="divide-y divide-gray-100 border-t border-gray-100">
                          {groupLevels.length === 0 ? (
                            <div className="px-4 py-4 text-sm text-gray-400">
                              В этой группе пока нет уровней опыта.
                            </div>
                          ) : (
                            groupLevels.map((level) => {
                              const levelActionsKey = `level-${level.guid}`;
                              return (
                                <div
                                  key={level.guid}
                                  className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
                                >
                                  <span className="pl-6 text-sm text-gray-800">
                                    {String(level.title || "Без названия")}
                                  </span>

                                  <div className="flex items-center gap-4">
                                    <div className="relative flex items-center">
                                      <button
                                        type="button"
                                        onClick={() => toggleActionsMenu(levelActionsKey)}
                                        className="dropdown-toggle rounded-md p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                                        aria-label="Открыть действия уровня"
                                        ref={(el) => {
                                          actionButtonRefs.current[levelActionsKey] = el;
                                        }}
                                      >
                                        <MoreHorizontal size={16} />
                                      </button>

                                      <Dropdown
                                        isOpen={openActionsFor === levelActionsKey}
                                        onClose={() => setOpenActionsFor(null)}
                                        className="w-40 p-1"
                                        usePortal
                                        anchorEl={actionButtonRefs.current[levelActionsKey]}
                                      >
                                        <DropdownItem
                                          onClick={() => openEditLevel(level)}
                                          className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-500"
                                        >
                                          Изменить
                                        </DropdownItem>
                                        <DropdownItem
                                          onClick={() => openDeleteLevel(level)}
                                          className="rounded-lg px-3 py-2 text-sm text-error-600 hover:bg-error-50 hover:text-error-700"
                                        >
                                          Удалить
                                        </DropdownItem>
                                      </Dropdown>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Group upsert modal */}
      <Modal
        isOpen={isGroupModalOpen}
        onClose={closeGroupModal}
        showCloseButton={false}
        className="mx-4 w-full max-w-[560px] overflow-hidden rounded-2xl border border-gray-200 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3.5">
          <h3 className="text-xl font-semibold text-gray-900">
            {editingGroup ? "Изменить группу" : "Новая группа"}
          </h3>
          <button
            type="button"
            onClick={closeGroupModal}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <label htmlFor="experience-group-title" className="block text-sm font-medium text-gray-700">
            Название группы
          </label>
          <input
            id="experience-group-title"
            value={groupTitle}
            onChange={(event) => setGroupTitle(event.target.value)}
            placeholder="Введите название группы"
            autoFocus
            className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
          />
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3">
          <Button variant="outline" onClick={closeGroupModal} className="min-w-[96px] px-3 py-2 text-sm">
            Отмена
          </Button>
          <Button onClick={handleGroupSubmit} disabled={isSavingGroup} className="min-w-[110px] px-3 py-2 text-sm">
            {isSavingGroup ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </Modal>

      {/* Level upsert modal */}
      <Modal
        isOpen={isLevelModalOpen}
        onClose={closeLevelModal}
        showCloseButton={false}
        className="mx-4 w-full max-w-[560px] overflow-hidden rounded-2xl border border-gray-200 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3.5">
          <h3 className="text-xl font-semibold text-gray-900">
            {editingLevel ? "Изменить уровень опыта" : "Новый уровень опыта"}
          </h3>
          <button
            type="button"
            onClick={closeLevelModal}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <div>
            <label htmlFor="experience-level-group" className="mb-1.5 block text-sm font-medium text-gray-700">
              Группа
            </label>
            <select
              id="experience-level-group"
              value={levelGroupId}
              onChange={(event) => setLevelGroupId(event.target.value)}
              className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
            >
              <option value="">Выберите группу</option>
              {groups.map((group) => (
                <option key={group.guid} value={group.guid}>
                  {String(group.title || "Без названия")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="experience-level-title" className="mb-1.5 block text-sm font-medium text-gray-700">
              Название
            </label>
            <input
              id="experience-level-title"
              value={levelTitle}
              onChange={(event) => setLevelTitle(event.target.value)}
              placeholder="Введите название уровня опыта"
              autoFocus
              className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3">
          <Button variant="outline" onClick={closeLevelModal} className="min-w-[96px] px-3 py-2 text-sm">
            Отмена
          </Button>
          <Button onClick={handleLevelSubmit} disabled={isSavingLevel} className="min-w-[110px] px-3 py-2 text-sm">
            {isSavingLevel ? "Сохранение..." : "Сохранить"}
          </Button>
        </div>
      </Modal>

      {/* Group delete modal */}
      <Modal
        isOpen={isGroupDeleteOpen}
        onClose={closeDeleteGroup}
        showCloseButton={false}
        className="mx-4 w-full max-w-[360px] overflow-hidden rounded-2xl border border-gray-200 p-0 shadow-xl"
      >
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Удалить группу</h3>
            <button
              type="button"
              onClick={closeDeleteGroup}
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
            {groupToDelete
              ? `Вы уверены, что хотите удалить группу "${String(groupToDelete.title)}"?`
              : "Вы уверены, что хотите удалить эту группу?"}
          </p>
          {groupToDelete && (levelsByGroup.get(groupToDelete.guid) || []).length > 0 && (
            <p className="text-xs text-error-600">
              В группе есть уровни опыта. Сначала перенесите или удалите их.
            </p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={closeDeleteGroup} className="w-full justify-center px-3 py-2 text-sm">
              Отмена
            </Button>
            <Button
              onClick={confirmDeleteGroup}
              disabled={deleteGroupMutation.isLoading}
              className="w-full justify-center bg-error-600 px-3 py-2 text-sm hover:bg-error-700"
            >
              {deleteGroupMutation.isLoading ? "Удаление..." : "Удалить"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Level delete modal */}
      <Modal
        isOpen={isLevelDeleteOpen}
        onClose={closeDeleteLevel}
        showCloseButton={false}
        className="mx-4 w-full max-w-[340px] overflow-hidden rounded-2xl border border-gray-200 p-0 shadow-xl"
      >
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Удалить уровень опыта</h3>
            <button
              type="button"
              onClick={closeDeleteLevel}
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
            {levelToDelete
              ? `Вы уверены, что хотите удалить "${String(levelToDelete.title)}"?`
              : "Вы уверены, что хотите удалить этот уровень опыта?"}
          </p>

          <div className="flex gap-2">
            <Button variant="outline" onClick={closeDeleteLevel} className="w-full justify-center px-3 py-2 text-sm">
              Отмена
            </Button>
            <Button
              onClick={confirmDeleteLevel}
              disabled={deleteLevelMutation.isLoading}
              className="w-full justify-center bg-error-600 px-3 py-2 text-sm hover:bg-error-700"
            >
              {deleteLevelMutation.isLoading ? "Удаление..." : "Удалить"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
