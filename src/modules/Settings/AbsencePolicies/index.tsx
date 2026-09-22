import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ChevronDown,
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
import { useTranslation } from "../../../i18n";

const PAGE_SIZE = 20;
const DEFAULT_COLOR = "#3B82F6";
const DEFAULT_ICON = DEFAULT_ICON_OPTIONS[0].value;
const DEFAULT_TYPE = "paid";
const DEFAULT_PERIOD = "year";
const DEFAULT_VALUE = 1;
const DEFAULT_MIN_MONTHS = 0;

const TYPE_OPTIONS = [
  { value: "paid", labelKey: "settings_misc.absence_policies.type_paid" },
  { value: "unpaid", labelKey: "settings_misc.absence_policies.type_unpaid" },
] as const;

const PERIOD_OPTIONS = [
  { value: "week", labelKey: "settings_misc.absence_policies.period_week" },
  { value: "month", labelKey: "settings_misc.absence_policies.period_month" },
  { value: "year", labelKey: "settings_misc.absence_policies.period_year" },
] as const;

type TranslateFn = ReturnType<typeof useTranslation>["t"];

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

const getTypeLabel = (type: string, t: TranslateFn): string => {
  const found = TYPE_OPTIONS.find((option) => option.value === type);
  return found ? t(found.labelKey) : type || "—";
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

const getPeriodLabel = (period: string, t: TranslateFn): string => {
  const found = PERIOD_OPTIONS.find((option) => option.value === period);
  return found ? t(found.labelKey) : period || "—";
};

export default function AbsencePoliciesSettingsPage() {
  const { t } = useTranslation();
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
  const [minMonths, setMinMonths] = useState(String(DEFAULT_MIN_MONTHS));
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
    setMinMonths(String(DEFAULT_MIN_MONTHS));
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
    setMinMonths(String(resolveNumericValue(item.min_months, DEFAULT_MIN_MONTHS)));
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
    const preparedMinMonths = resolveNumericValue(minMonths, NaN);

    if (!preparedTitle) {
      toast.error(t("settings_misc.absence_policies.error_title_required"));
      return;
    }

    if (!preparedIcon || !preparedIcon.includes(":")) {
      toast.error(t("settings_misc.absence_policies.error_icon_required"));
      return;
    }

    if (!Number.isFinite(preparedValue) || preparedValue < 0) {
      toast.error(t("settings_misc.absence_policies.error_value_invalid"));
      return;
    }

    if (!Number.isFinite(preparedMinMonths) || preparedMinMonths < 0) {
      toast.error(t("settings_misc.absence_policies.error_min_months_invalid"));
      return;
    }

    const payload = {
      title: preparedTitle,
      icon: preparedIcon,
      color: preparedColor,
      type: [preparedType],
      period: [preparedPeriod],
      value: preparedValue,
      min_months: Math.round(preparedMinMonths),
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
        toast.success(t("settings_misc.absence_policies.updated_toast"));
      } else {
        await createMutation.mutateAsync(payload);
        toast.success(t("settings_misc.absence_policies.created_toast"));
      }

      closeUpsertModal();
    } catch (error) {
      console.error("Failed to save absence policy:", error);
      toast.error(t("settings_misc.absence_policies.save_error_toast"));
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
      toast.success(t("settings_misc.absence_policies.deleted_toast"));
      closeDeleteModal();
    } catch (error) {
      console.error("Failed to delete absence policy:", error);
      toast.error(t("settings_misc.absence_policies.delete_error_toast"));
    }
  };

  const isSaving = createMutation.isLoading || updateMutation.isLoading;

  const toggleActionsMenu = (guid: string) => {
    setOpenActionsFor((prev) => (prev === guid ? null : guid));
  };

  return (
    <>
      <PageMeta
        title={t("settings_misc.absence_policies.page_meta_title")}
        description={t("settings_misc.absence_policies.page_meta_description")}
      />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-gray-900">{t("settings_misc.absence_policies.title")}</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-11"
              startIcon={<Settings size={16} />}
              onClick={() => toast.info(t("settings_misc.absence_policies.donations_toast"))}
            >
              {t("settings_misc.absence_policies.donations_button")}
            </Button>
            <Button
              variant="outline"
              className="h-11"
              startIcon={<Wand2 size={16} />}
              onClick={() => toast.info(t("settings_misc.absence_policies.assignment_toast"))}
            >
              {t("settings_misc.absence_policies.assignment_button")}
            </Button>
            <Button className="h-11" startIcon={<Plus size={16} />} onClick={openCreateModal}>
              {t("settings_misc.absence_policies.add_button")}
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
                placeholder={t("settings_misc.absence_policies.search_placeholder")}
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
                {t("settings_misc.absence_policies.empty_state")}
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
                  const itemMinMonths = resolveNumericValue(item.min_months, 0);
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
                          aria-label={t("settings_misc.absence_policies.move_aria")}
                        >
                          <GripVertical size={16} />
                        </button>

                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
                          <Icon icon={iconOption.value} width={16} height={16} color={itemColor} />
                        </span>

                        <div className="min-w-0">
                          <p className="truncate text-lg font-semibold text-gray-900">
                            {String(item.title || t("settings_misc.absence_policies.no_title"))}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className={`inline-flex rounded-lg px-2.5 py-1 text-sm font-medium ${getTypeBadgeClassName(itemType)}`}>
                              {getTypeLabel(itemType, t)}
                            </span>
                            <span className={`inline-flex rounded-lg px-2.5 py-1 text-sm font-medium ${getPeriodBadgeClassName(itemPeriod)}`}>
                              {getPeriodLabel(itemPeriod, t)}
                            </span>
                            <span className="inline-flex rounded-lg bg-gray-100 px-2.5 py-1 text-sm font-medium text-gray-700">
                              {itemValue}
                            </span>
                            {itemMinMonths > 0 ? (
                              <span className="inline-flex rounded-lg bg-[#FEF3C7] px-2.5 py-1 text-sm font-medium text-[#B45309]">
                                {t("settings_misc.absence_policies.min_months_badge", { months: itemMinMonths })}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                          onClick={() => toast.info(t("settings_misc.absence_policies.expand_toast"))}
                          aria-label={t("settings_misc.absence_policies.expand_aria")}
                        >
                          <ChevronDown size={18} />
                        </button>

                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-700 transition hover:bg-gray-100"
                          onClick={() => toast.info(t("settings_misc.absence_policies.quick_add_toast"))}
                          aria-label={t("settings_misc.absence_policies.quick_add_aria")}
                        >
                          <Plus size={18} />
                        </button>

                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => toggleActionsMenu(item.guid)}
                            className="dropdown-toggle inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-700 transition hover:bg-gray-100"
                            aria-label={t("settings_misc.absence_policies.actions_aria")}
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
                              {t("settings_misc.absence_policies.edit_action")}
                            </DropdownItem>
                            <DropdownItem
                              onClick={() => openDeleteModal(item)}
                              className="rounded-lg px-3 py-2 text-sm text-error-600 hover:bg-error-50 hover:text-error-700"
                            >
                              {t("settings_misc.absence_policies.delete_action")}
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
            {editingItem
              ? t("settings_misc.absence_policies.edit_modal_title")
              : t("settings_misc.absence_policies.create_modal_title")}
          </h3>
          <button
            type="button"
            onClick={closeUpsertModal}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label={t("settings_misc.absence_policies.close_aria")}
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div className="space-y-2">
            <label htmlFor="absence-policy-title" className="block text-sm font-medium text-gray-700">
              {t("settings_misc.absence_policies.name_label")}
            </label>
            <input
              id="absence-policy-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("settings_misc.absence_policies.name_placeholder")}
              autoFocus
              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
            />
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="space-y-2 md:w-[120px]">
              <label className="block text-sm font-medium text-gray-700">
                {t("settings_misc.absence_policies.icon_label")}
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
                {t("settings_misc.absence_policies.color_label")}
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
                {t("settings_misc.absence_policies.type_label")}
              </label>
              <select
                id="absence-policy-type"
                value={policyType}
                onChange={(event) => setPolicyType(event.target.value)}
                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="absence-policy-period" className="block text-sm font-medium text-gray-700">
                {t("settings_misc.absence_policies.period_label")}
              </label>
              <select
                id="absence-policy-period"
                value={policyPeriod}
                onChange={(event) => setPolicyPeriod(event.target.value)}
                className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
              >
                {PERIOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="absence-policy-value" className="block text-sm font-medium text-gray-700">
                {t("settings_misc.absence_policies.value_label")}
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

          <div className="space-y-2">
            <label htmlFor="absence-policy-min-months" className="block text-sm font-medium text-gray-700">
              {t("settings_misc.absence_policies.min_months_label")}
            </label>
            <input
              id="absence-policy-min-months"
              type="number"
              min={0}
              step={1}
              value={minMonths}
              onChange={(event) => setMinMonths(event.target.value)}
              placeholder="0"
              className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
            />
            <p className="text-xs text-gray-500">
              {t("settings_misc.absence_policies.min_months_hint")}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
          <Button
            variant="outline"
            onClick={closeUpsertModal}
            className="min-w-[96px] px-3 py-2 text-sm"
          >
            {t("settings_misc.absence_policies.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving} className="min-w-[110px] px-3 py-2 text-sm">
            {isSaving ? t("settings_misc.absence_policies.saving") : t("settings_misc.absence_policies.save")}
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
            <h3 className="text-base font-semibold text-gray-900">
              {t("settings_misc.absence_policies.delete_modal_title")}
            </h3>
            <button
              type="button"
              onClick={closeDeleteModal}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label={t("settings_misc.absence_policies.close_aria")}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4 text-center">
          <p className="text-sm text-gray-500">
            {t("settings_misc.absence_policies.delete_warning")}
          </p>
          <p className="text-sm text-gray-700">
            {itemToDelete
              ? t("settings_misc.absence_policies.delete_confirm_named", { title: String(itemToDelete.title) })
              : t("settings_misc.absence_policies.delete_confirm_generic")}
          </p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={closeDeleteModal}
              className="w-full justify-center px-3 py-2 text-sm"
            >
              {t("settings_misc.absence_policies.cancel")}
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleteMutation.isLoading}
              className="w-full justify-center bg-error-600 px-3 py-2 text-sm hover:bg-error-700"
            >
              {deleteMutation.isLoading ? t("settings_misc.absence_policies.deleting") : t("settings_misc.absence_policies.delete_action")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
