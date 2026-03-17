import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  ChevronDown,
  ChevronLeft,
  GripVertical,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Wand2,
  X,
} from "lucide-react";
import { Icon } from "@iconify/react";
import { toast } from "sonner";
import PageMeta from "../../../components/common/PageMeta";
import Button from "../../../components/ui/button/Button";
import { Modal } from "../../../components/ui/modal";
import { Dropdown } from "../../../components/ui/dropdown/Dropdown";
import { DropdownItem } from "../../../components/ui/dropdown/DropdownItem";
import Pagination from "../../../components/pagination";
import ColorPicker, {
  normalizeHexColor,
} from "../../../components/pickers/ColorPicker";
import IconPicker, {
  DEFAULT_ICON_OPTIONS,
  getIconOption,
  resolveIconValue,
} from "../../../components/pickers/IconPicker";
import {
  type SettingsDirectoryItem,
  useCreateSettingsDirectoryItem,
  useDeleteSettingsDirectoryItem,
  useSettingsDirectoryQuery,
  useUpdateSettingsDirectoryItem,
} from "../../../api/services/settingsDirectory.service";

const PAGE_SIZE = 20;
const DEFAULT_COLOR = "#3B82F6";
const DEFAULT_ICON = DEFAULT_ICON_OPTIONS[0].value;
const DEFAULT_TYPE = "paid";
const DEFAULT_PERIOD = "year";
const DEFAULT_VALUE = 1;

const TYPE_OPTIONS = [
  { value: "paid", label: "Оплачиваемый" },
  { value: "unpaid", label: "Неоплачиваемый" },
];

const PERIOD_OPTIONS = [
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "year", label: "Год" },
];

const resolveStringOrArrayValue = (value: unknown, fallback: string): string => {
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" && first ? first : fallback;
  }

  return typeof value === "string" && value ? value : fallback;
};

const resolveNumericValue = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

const getTypeBadgeClassName = (type: string): string => {
  if (type === "paid") {
    return "bg-[#D1FAE5] text-[#0F9F6E]";
  }
  if (type === "unpaid") {
    return "bg-[#FEE2E2] text-[#DC2626]";
  }
  return "bg-gray-100 text-gray-700";
};

const getTypeLabel = (type: string): string => {
  const found = TYPE_OPTIONS.find((option) => option.value === type);
  return found?.label || type || "—";
};

const getPeriodBadgeClassName = (period: string): string => {
  if (period === "week") {
    return "bg-[#F3E8FF] text-[#7C3AED]";
  }
  if (period === "year") {
    return "bg-[#DCFCE7] text-[#16A34A]";
  }
  if (period === "month") {
    return "bg-[#DBEAFE] text-[#1D4ED8]";
  }
  return "bg-gray-100 text-gray-700";
};

const getPeriodLabel = (period: string): string => {
  const found = PERIOD_OPTIONS.find((option) => option.value === period);
  return found?.label || period || "—";
};

export default function AbsencePoliciesSettingsPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [isUpsertModalOpen, setIsUpsertModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SettingsDirectoryItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<SettingsDirectoryItem | null>(null);
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState(DEFAULT_ICON);
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [policyType, setPolicyType] = useState(DEFAULT_TYPE);
  const [policyPeriod, setPolicyPeriod] = useState(DEFAULT_PERIOD);
  const [policyValue, setPolicyValue] = useState(String(DEFAULT_VALUE));
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

  const slug = "absence_policies";
  const { data, isLoading } = useSettingsDirectoryQuery({
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

  const resetForm = () => {
    setTitle("");
    setIcon(DEFAULT_ICON);
    setColor(DEFAULT_COLOR);
    setPolicyType(DEFAULT_TYPE);
    setPolicyPeriod(DEFAULT_PERIOD);
    setPolicyValue(String(DEFAULT_VALUE));
  };

  const openCreateModal = () => {
    setEditingItem(null);
    resetForm();
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  };

  const openEditModal = (item: SettingsDirectoryItem) => {
    setEditingItem(item);
    setTitle(String(item.title || ""));
    setIcon(resolveIconValue(String(item.icon || DEFAULT_ICON)));
    setColor(normalizeHexColor(String(item.color || DEFAULT_COLOR), DEFAULT_COLOR));
    setPolicyType(resolveStringOrArrayValue(item.type, DEFAULT_TYPE));
    setPolicyPeriod(resolveStringOrArrayValue(item.period, DEFAULT_PERIOD));
    setPolicyValue(String(resolveNumericValue(item.value, DEFAULT_VALUE)));
    setIsUpsertModalOpen(true);
    setOpenActionsFor(null);
  };

  const closeUpsertModal = () => {
    setIsUpsertModalOpen(false);
    setEditingItem(null);
    resetForm();
  };

  const handleSubmit = async () => {
    const preparedTitle = title.trim();
    const preparedIcon = resolveIconValue(icon);
    const preparedColor = normalizeHexColor(color, DEFAULT_COLOR);
    const preparedType = resolveStringOrArrayValue(policyType, DEFAULT_TYPE);
    const preparedPeriod = resolveStringOrArrayValue(policyPeriod, DEFAULT_PERIOD);
    const preparedValue = resolveNumericValue(policyValue, NaN);

    if (!preparedTitle) {
      toast.error("Название обязательно.");
      return;
    }

    if (!preparedIcon || !preparedIcon.includes(":")) {
      toast.error("Выберите иконку.");
      return;
    }

    if (!Number.isFinite(preparedValue) || preparedValue < 0) {
      toast.error("Значение должно быть числом 0 или больше.");
      return;
    }

    const payload = {
      title: preparedTitle,
      icon: preparedIcon,
      color: preparedColor,
      type: [preparedType],
      period: [preparedPeriod],
      value: preparedValue,
    };

    try {
      if (editingItem) {
        await updateMutation.mutateAsync({
          guid: editingItem.guid,
          data: {
            ...editingItem,
            ...payload,
          },
        });
        toast.success("Политика отсутствия обновлена.");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Политика отсутствия создана.");
      }

      closeUpsertModal();
    } catch (error) {
      console.error("Failed to save absence policy:", error);
      toast.error("Не удалось сохранить политику отсутствия.");
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
      toast.success("Политика отсутствия удалена.");
      closeDeleteModal();
    } catch (error) {
      console.error("Failed to delete absence policy:", error);
      toast.error("Не удалось удалить политику отсутствия.");
    }
  };

  const isSaving = createMutation.isLoading || updateMutation.isLoading;

  const toggleActionsMenu = (guid: string) => {
    setOpenActionsFor((prev) => (prev === guid ? null : guid));
  };

  return (
    <>
      <PageMeta title="Политики отсутствий | Настройки" description="Список политик отсутствий" />

      <div className="space-y-4">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-gray-700"
        >
          <ChevronLeft size={16} />
          Назад
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-gray-900">Политики отсутствий</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-11"
              startIcon={<Settings size={16} />}
              onClick={() => toast.info("Управление пожертвованиями на отпуск будет доступно позже.")}
            >
              Управление пожертвованиями на отпуск
            </Button>
            <Button
              variant="outline"
              className="h-11"
              startIcon={<Wand2 size={16} />}
              onClick={() => toast.info("Назначение будет доступно позже.")}
            >
              Назначение
            </Button>
            <Button className="h-11" startIcon={<Plus size={16} />} onClick={openCreateModal}>
              Добавить тип отпуска
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


          <div className="border-t border-gray-100 p-4">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={`absence-policies-skeleton-${index}`}
                    className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-4 w-4 animate-pulse rounded bg-gray-200" />
                      <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-200" />
                      <div className="space-y-2">
                        <div className="h-3.5 w-40 animate-pulse rounded bg-gray-200" />
                        <div className="h-3 w-32 animate-pulse rounded bg-gray-200" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-200" />
                      <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-200" />
                      <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-200" />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-gray-500">
                Политики отсутствий не найдены
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => {
                  const itemIcon = String(item.icon || "");
                  const itemColor = normalizeHexColor(
                    String(item.color || DEFAULT_COLOR),
                    DEFAULT_COLOR
                  );
                  const itemType = resolveStringOrArrayValue(item.type, "—");
                  const itemPeriod = resolveStringOrArrayValue(item.period, "—");
                  const itemValue = resolveNumericValue(item.value, 0);
                  const iconOption = getIconOption(itemIcon);
                  return (
                    <div
                      key={item.guid}
                      className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-3 py-2.5 transition-colors hover:bg-gray-50"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <button
                          type="button"
                          className="cursor-grab text-gray-300 hover:text-gray-400"
                          aria-label="Переместить"
                        >
                          <GripVertical size={16} />
                        </button>

                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                          <Icon icon={iconOption.value} width={16} height={16} color={itemColor} />
                        </span>

                        <div className="min-w-0">
                          <p className="truncate text-lg font-semibold text-gray-900">
                            {String(item.title || "Без названия")}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-lg px-2.5 py-1 text-sm font-medium ${getTypeBadgeClassName(itemType)}`}>
                              {getTypeLabel(itemType)}
                            </span>
                            <span className={`inline-flex rounded-lg px-2.5 py-1 text-sm font-medium ${getPeriodBadgeClassName(itemPeriod)}`}>
                              {getPeriodLabel(itemPeriod)}
                            </span>
                            <span className="inline-flex rounded-lg bg-gray-100 px-2.5 py-1 text-sm font-medium text-gray-700">
                              {itemValue}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                          onClick={() => toast.info("Детали будут доступны позже.")}
                          aria-label="Развернуть"
                        >
                          <ChevronDown size={18} />
                        </button>

                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-700 transition hover:bg-gray-100"
                          onClick={() => toast.info("Быстрое добавление будет доступно позже.")}
                          aria-label="Быстрое добавление"
                        >
                          <Plus size={18} />
                        </button>

                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => toggleActionsMenu(item.guid)}
                            className="dropdown-toggle inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-700 transition hover:bg-gray-100"
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
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
        className="mx-4 w-full max-w-[640px] overflow-hidden rounded-2xl border border-gray-200 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3.5">
          <h3 className="text-xl font-semibold text-gray-900">
            {editingItem ? "Изменить тип отпуска" : "Новый тип отпуска"}
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

        <div className="space-y-4 px-4 py-4">
          <div className="space-y-2">
            <label htmlFor="absence-policy-title" className="block text-sm font-medium text-gray-700">
              Название
            </label>
            <input
              id="absence-policy-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Введите название"
              autoFocus
              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
            />
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="space-y-2 md:w-[120px]">
              <label className="block text-sm font-medium text-gray-700">
                Иконка
              </label>
              <IconPicker
                value={icon}
                onChange={setIcon}
                iconColor={normalizeHexColor(color, DEFAULT_COLOR)}
                fullWidth={false}
              />
            </div>

            <div className="space-y-2 md:w-[260px]">
              <label className="block text-sm font-medium text-gray-700">
                Цвет
              </label>
              <ColorPicker
                value={color}
                onChange={setColor}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="absence-policy-type" className="block text-sm font-medium text-gray-700">
                Тип
              </label>
              <select
                id="absence-policy-type"
                value={policyType}
                onChange={(event) => setPolicyType(event.target.value)}
                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="absence-policy-period" className="block text-sm font-medium text-gray-700">
                Период
              </label>
              <select
                id="absence-policy-period"
                value={policyPeriod}
                onChange={(event) => setPolicyPeriod(event.target.value)}
                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
              >
                {PERIOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="absence-policy-value" className="block text-sm font-medium text-gray-700">
                Значение
              </label>
              <input
                id="absence-policy-value"
                type="number"
                min={0}
                step={1}
                value={policyValue}
                onChange={(event) => setPolicyValue(event.target.value)}
                placeholder="0"
                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
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
            <h3 className="text-base font-semibold text-gray-900">Удалить политику</h3>
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
              : "Вы уверены, что хотите удалить эту политику?"}
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
