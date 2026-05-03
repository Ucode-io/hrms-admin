import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { observer } from "mobx-react-lite";
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import Select, { type StylesConfig } from "react-select";
import { toast } from "sonner";
import PageMeta from "../../components/common/PageMeta";
import ExpandableSearchInput from "../../components/form/ExpandableSearchInput";
import { Modal } from "../../components/ui/modal";
import { Dropdown } from "../../components/ui/dropdown/Dropdown";
import { DropdownItem } from "../../components/ui/dropdown/DropdownItem";
import companyStore from "../../store/company.store";
import settingsDirectoryService from "../../api/services/settingsDirectory.service";
import RemoteSingleSelect, { type RemoteSelectOption } from "../../components/autocomplete/RemoteSingleSelect";
import reportsService, {
  type KpiFilterOption,
  type KpiPeriodType,
  type KpiTableBucket,
  type KpiTableGroup,
  type KpiTableItem,
} from "../../api/services/reports.service";

type KpiPeriodMode = KpiPeriodType;

type WeeklyMetric = {
  guid: string;
  plan: number;
  actual: number;
  percent: number;
};

type KpiRecord = {
  id: string;
  departmentsId: string | null;
  department: string;
  name: string;
  description: string;
  source: string;
  valueSymbol: string;
  valueSymbolPosition: "prefix" | "suffix";
  goalType: KpiPeriodMode;
  startDate: string;
  endDate: string;
  planValue: number;
  actualValue: number;
  percentTotal: number;
  values: KpiTableBucket[];
  weeklyMetrics: WeeklyMetric[];
};

type CreateKpiDraft = {
  departmentId: string;
  departmentTitle: string;
  source: string;
  valueSymbol: string;
  valueSymbolPosition: "prefix" | "suffix";
  name: string;
  description: string;
  goalType: KpiPeriodMode;
  startDate: string;
  endDate: string;
  planValue: string;
};

type EditingDailyCell = {
  itemId: string;
  dayIndex: number;
  draftValue: string;
};

type FilterOption = {
  value: string;
  label: string;
};

const KPI_PERIOD_TABS: { key: KpiPeriodMode; label: string }[] = [
  { key: "monthly", label: "Месячный KPI" },
  { key: "weekly", label: "Недельный KPI" },
];

const pad = (value: number): string => String(value).padStart(2, "0");

const toIsoDate = (value: Date): string => {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};

const formatPeriodLabel = (cursorDate: Date, mode: KpiPeriodMode): string => {
  if (mode === "monthly") {
    const formatted = new Intl.DateTimeFormat("ru-RU", {
      month: "long",
      year: "numeric",
    }).format(cursorDate);

    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  const day = cursorDate.getDay();
  const mondayShift = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(cursorDate);
  weekStart.setDate(cursorDate.getDate() + mondayShift);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const startLabel = `${pad(weekStart.getDate())}.${pad(weekStart.getMonth() + 1)}`;
  const endLabel = `${pad(weekEnd.getDate())}.${pad(weekEnd.getMonth() + 1)}`;

  return `${startLabel} - ${endLabel} ${weekEnd.getFullYear()}`;
};

const calcPercent = (actual: number, plan: number): number => {
  if (!Number.isFinite(actual) || !Number.isFinite(plan) || plan <= 0) return 0;
  return Math.round((actual / plan) * 100);
};

const getPercentBadgeClass = (percent: number): string => {
  if (percent >= 100) return "bg-emerald-100 text-emerald-700";
  if (percent >= 80) return "bg-blue-100 text-blue-700";
  if (percent >= 60) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
};

const getWeekStart = (value: Date): Date => {
  const day = value.getDay();
  const mondayShift = day === 0 ? -6 : 1 - day;
  const start = new Date(value);
  start.setDate(value.getDate() + mondayShift);
  return start;
};

const WEEK_DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const roundToTwo = (value: number): number => Math.round(value * 100) / 100;

const formatMetricValue = (value: number): string => {
  if (!Number.isFinite(value)) return "0";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(/\.00$/, "");
};

const formatValueWithSymbol = (
  value: number,
  symbol: string,
  position: "prefix" | "suffix"
): string => {
  const formatted = formatMetricValue(value);
  const normalizedSymbol = symbol.trim();
  if (!normalizedSymbol) return formatted;
  return position === "prefix"
    ? `${normalizedSymbol}${formatted}`
    : `${formatted}${normalizedSymbol}`;
};

const formatDisplayDate = (value: string): string => {
  if (!value) return value;
  const normalized = value.slice(0, 10);
  const [year, month, day] = normalized.split("-");
  if (!year || !month || !day) return value;
  return `${day}.${month}.${year}`;
};

const normalizeDateInputValue = (value: string): string => {
  if (!value) return "";
  const normalized = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }
  return "";
};

const toDatePickerValue = (value: string): Date | null => {
  const normalized = normalizeDateInputValue(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const formatShortDate = (value: Date): string => {
  return `${pad(value.getDate())}.${pad(value.getMonth() + 1)}`;
};

const getDefaultDraft = (goalType: KpiPeriodMode): CreateKpiDraft => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end =
    goalType === "monthly"
      ? new Date(now.getFullYear(), now.getMonth() + 1, 0)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate() + 6);

  return {
    departmentId: "",
    departmentTitle: "",
    source: "Вручную",
    valueSymbol: "",
    valueSymbolPosition: "suffix",
    name: "",
    description: "",
    goalType,
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
    planValue: "",
  };
};

const getPeriodRange = (cursorDate: Date, mode: KpiPeriodMode): { from: string; to: string } => {
  if (mode === "monthly") {
    const start = new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1);
    const end = new Date(cursorDate.getFullYear(), cursorDate.getMonth() + 1, 0);
    return { from: toIsoDate(start), to: toIsoDate(end) };
  }

  const start = getWeekStart(cursorDate);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { from: toIsoDate(start), to: toIsoDate(end) };
};

const mapKpiItemFromApi = (item: KpiTableItem): KpiRecord => {
  const values = Array.isArray(item.values) ? [...item.values] : [];
  values.sort((a, b) => Number(a.bucket_index || 0) - Number(b.bucket_index || 0));

  const normalizedPeriodType = item.period_type === "weekly" ? "weekly" : "monthly";
  const targetCount = normalizedPeriodType === "weekly" ? 7 : 4;
  const valuesForDisplay = values.slice(0, targetCount);
  const metricsByIndex = new Map(
    valuesForDisplay.map((bucket) => [
      Number(bucket.bucket_index || 0),
      {
        guid: bucket.guid,
        plan: roundToTwo(Number(bucket.plan_value) || 0),
        actual: roundToTwo(Number(bucket.actual_value) || 0),
        percent: Number.isFinite(bucket.percent)
          ? Number(bucket.percent)
          : calcPercent(Number(bucket.actual_value) || 0, Number(bucket.plan_value) || 0),
      },
    ])
  );

  const weeklyMetrics: WeeklyMetric[] = Array.from({ length: targetCount }, (_, index) => {
    const metric = metricsByIndex.get(index + 1);
    if (metric) return metric;

    return {
      guid: "",
      plan: 0,
      actual: 0,
      percent: 0,
    };
  });

  return {
    id: item.guid,
    departmentsId: item.departments_id || null,
    department: item.department || "Без отдела",
    name: item.title || "Без названия",
    description: item.description || "",
    source: item.source || "Вручную",
    valueSymbol: typeof item.value_symbol === "string" ? item.value_symbol : "",
    valueSymbolPosition: item.value_symbol_position === "prefix" ? "prefix" : "suffix",
    goalType: normalizedPeriodType,
    startDate: normalizeDateInputValue(item.start_date),
    endDate: normalizeDateInputValue(item.end_date),
    planValue: roundToTwo(Number(item.plan_total) || 0),
    actualValue: roundToTwo(Number(item.actual_total) || 0),
    percentTotal: Number.isFinite(item.percent_total)
      ? Number(item.percent_total)
      : calcPercent(Number(item.actual_total) || 0, Number(item.plan_total) || 0),
    values: valuesForDisplay,
    weeklyMetrics,
  };
};

function KpiPage() {
  const [periodMode, setPeriodMode] = useState<KpiPeriodMode>("monthly");
  const [cursorDate, setCursorDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [kpiItems, setKpiItems] = useState<KpiRecord[]>([]);
  const [kpiGroups, setKpiGroups] = useState<KpiTableGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFilters, setIsLoadingFilters] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [isCreateSaving, setIsCreateSaving] = useState(false);
  const [editingKpiId, setEditingKpiId] = useState<string | null>(null);
  const [actionMenuItemId, setActionMenuItemId] = useState<string | null>(null);
  const [actionMenuAnchorEl, setActionMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [kpiToDelete, setKpiToDelete] = useState<KpiRecord | null>(null);
  const [editingDailyCell, setEditingDailyCell] = useState<EditingDailyCell | null>(null);
  const [draft, setDraft] = useState<CreateKpiDraft>(() => getDefaultDraft("monthly"));
  const [departmentFilterOptions, setDepartmentFilterOptions] = useState<FilterOption[]>([]);
  const [sourceFilterOptions, setSourceFilterOptions] = useState<FilterOption[]>([]);
  const selectPortalTarget = typeof document !== "undefined" ? document.body : undefined;
  const filterSelectPortalTarget = typeof document !== "undefined" ? document.body : null;
  const selectedDepartmentFallbackOption = useMemo<RemoteSelectOption | null>(() => {
    if (!draft.departmentId || !draft.departmentTitle) return null;
    return { value: draft.departmentId, label: draft.departmentTitle };
  }, [draft.departmentId, draft.departmentTitle]);
  const valueSymbolPositionOptions = useMemo<FilterOption[]>(
    () => [
      { value: "suffix", label: "После значения" },
      { value: "prefix", label: "Перед значением" },
    ],
    []
  );
  const selectedValueSymbolPositionOption = useMemo<FilterOption | null>(
    () =>
      valueSymbolPositionOptions.find((option) => option.value === draft.valueSymbolPosition) ||
      valueSymbolPositionOptions[0] ||
      null,
    [valueSymbolPositionOptions, draft.valueSymbolPosition]
  );
  const filterSelectStyles = useMemo<StylesConfig<FilterOption, false>>(
    () => ({
      control: (base, state) => ({
        ...base,
        minHeight: 40,
        borderRadius: 12,
        backgroundColor: state.hasValue ? "#eff6ff" : "#fff",
        borderColor: state.hasValue ? "#bfdbfe" : state.isFocused ? "#cbd5e1" : "#e2e8f0",
        boxShadow: "none",
        "&:hover": {
          borderColor: state.hasValue ? "#93c5fd" : "#cbd5e1",
        },
      }),
      valueContainer: (base) => ({
        ...base,
        padding: "0 10px",
      }),
      indicatorsContainer: (base, state) => ({
        ...base,
        color: state.hasValue ? "#2563eb" : "#64748b",
      }),
      dropdownIndicator: (base, state) => ({
        ...base,
        color: state.hasValue ? "#2563eb" : "#64748b",
        padding: 6,
        "&:hover": {
          color: state.hasValue ? "#1d4ed8" : "#475569",
        },
      }),
      clearIndicator: (base) => ({
        ...base,
        color: "#64748b",
        padding: 6,
        "&:hover": {
          color: "#475569",
        },
      }),
      indicatorSeparator: () => ({
        display: "none",
      }),
      placeholder: (base) => ({
        ...base,
        color: "#94a3b8",
        fontSize: 14,
      }),
      input: (base) => ({
        ...base,
        color: "#1e293b",
        fontSize: 14,
        margin: 0,
        padding: 0,
      }),
      singleValue: (base, state) => ({
        ...base,
        color: state.hasValue ? "#2563eb" : "#334155",
        fontSize: 14,
        fontWeight: state.hasValue ? 600 : 500,
      }),
      menu: (base) => ({
        ...base,
        borderRadius: 10,
        overflow: "hidden",
        zIndex: 100100,
      }),
      menuPortal: (base) => ({
        ...base,
        zIndex: 100100,
      }),
      option: (base, state) => ({
        ...base,
        backgroundColor: state.isSelected ? "#dbeafe" : state.isFocused ? "#f8fafc" : "#fff",
        color: state.isSelected ? "#1d4ed8" : "#1e293b",
        fontSize: 14,
        padding: "8px 12px",
      }),
      noOptionsMessage: (base) => ({
        ...base,
        color: "#64748b",
        fontSize: 13,
      }),
    }),
    []
  );

  const loadDepartmentOptions = useCallback(
    async ({ search, limit, offset }: { search: string; limit: number; offset: number }) => {
      const res = await settingsDirectoryService.getList("departments", {
        search: search || undefined,
        limit,
        offset,
      });

      const options = (res.response || [])
        .map((item) => ({
          value: typeof item.guid === "string" ? item.guid : "",
          label: typeof item.title === "string" ? item.title : "",
        }))
        .filter((item) => item.value && item.label);

      return {
        count: res.count,
        options,
      };
    },
    []
  );

  useEffect(() => {
    if (!draft.departmentId) return;
    let isCancelled = false;

    void (async () => {
      try {
        const record = await settingsDirectoryService.getByGuid("departments", draft.departmentId);
        const title = typeof record?.title === "string" ? record.title : "";
        if (isCancelled || !title) return;
        setDraft((prev) =>
          prev.departmentId === draft.departmentId && prev.departmentTitle !== title
            ? { ...prev, departmentTitle: title }
            : prev
        );
      } catch {
        // ignore: keep fallback title from selection or use id on save
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [draft.departmentId]);

  const periodRange = useMemo(() => getPeriodRange(cursorDate, periodMode), [cursorDate, periodMode]);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingFilters(true);

    void (async () => {
      try {
        const response = await reportsService.getKpi({ period_type: periodMode });
        if (cancelled) return;

        const departments = Array.isArray(response.result?.filters?.departments)
          ? response.result.filters.departments
          : [];
        const sources = Array.isArray(response.result?.filters?.sources)
          ? response.result.filters.sources
          : [];

        setDepartmentFilterOptions(
          departments
            .map((option: KpiFilterOption) => ({
              value: String(option.value || ""),
              label: String(option.label || ""),
            }))
            .filter((option) => option.value && option.label)
        );
        setSourceFilterOptions(
          sources
            .map((option: KpiFilterOption) => ({
              value: String(option.value || ""),
              label: String(option.label || ""),
            }))
            .filter((option) => option.value && option.label)
        );
      } catch (error) {
        if (!cancelled) {
          toast.error("Не удалось загрузить фильтры KPI");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingFilters(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [periodMode]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    void (async () => {
      try {
        const response = await reportsService.getKpiTable({
          period_type: periodMode,
          date_from: periodRange.from,
          date_to: periodRange.to,
          search: searchQuery.trim() || undefined,
          department_id: departmentFilter || undefined,
          sources: sourceFilter ? [sourceFilter] : undefined,
        });

        if (cancelled) return;

        const items = (response.result?.items || []).map(mapKpiItemFromApi);
        const groups = response.result?.groups || [];
        setKpiItems(items);
        setKpiGroups(groups);
      } catch (error) {
        if (!cancelled) {
          setKpiItems([]);
          setKpiGroups([]);
          toast.error("Не удалось загрузить KPI");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [periodMode, periodRange.from, periodRange.to, searchQuery, departmentFilter, sourceFilter, reloadToken]);

  const currentPeriodLabel = useMemo(
    () => formatPeriodLabel(cursorDate, periodMode),
    [cursorDate, periodMode]
  );
  const weeklyDayColumns = useMemo(() => {
    const start = getWeekStart(cursorDate);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return {
        key: `day-${index}`,
        label: `${WEEK_DAY_LABELS[index]} ${pad(day.getDate())}.${pad(day.getMonth() + 1)}`,
      };
    });
  }, [cursorDate]);
  const monthlyWeekColumns = useMemo(() => {
    const year = cursorDate.getFullYear();
    const month = cursorDate.getMonth();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    return Array.from({ length: 4 }, (_, index) => {
      const start = new Date(monthStart);
      start.setDate(monthStart.getDate() + index * 7);

      const end = new Date(start);
      if (index === 3) {
        end.setTime(monthEnd.getTime());
      } else {
        end.setDate(start.getDate() + 6);
        if (end > monthEnd) {
          end.setTime(monthEnd.getTime());
        }
      }

      return {
        key: `month-week-${index + 1}`,
        label: `${formatShortDate(start)} - ${formatShortDate(end)}`,
      };
    });
  }, [cursorDate]);

  const selectedDepartmentFilterOption = useMemo<FilterOption | null>(
    () => departmentFilterOptions.find((option) => option.value === departmentFilter) || null,
    [departmentFilterOptions, departmentFilter]
  );
  const selectedSourceFilterOption = useMemo<FilterOption | null>(
    () => sourceFilterOptions.find((option) => option.value === sourceFilter) || null,
    [sourceFilterOptions, sourceFilter]
  );
  const activeFiltersCount = useMemo(
    () => [departmentFilter, sourceFilter].filter(Boolean).length,
    [departmentFilter, sourceFilter]
  );
  const isFilterButtonActive = isFiltersOpen || activeFiltersCount > 0;

  const groupedItems = useMemo(() => {
    const groups = new Map<string, KpiRecord[]>();

    if (kpiGroups.length > 0) {
      for (const group of kpiGroups) {
        groups.set(group.department || "Без отдела", []);
      }
    }

    for (const item of kpiItems) {
      if (!groups.has(item.department)) {
        groups.set(item.department, []);
      }
      groups.get(item.department)?.push(item);
    }

    return [...groups.entries()];
  }, [kpiItems, kpiGroups]);

  const rowIndexById = useMemo(() => {
    const map = new Map<string, number>();
    let counter = 1;

    for (const [, items] of groupedItems) {
      for (const item of items) {
        map.set(item.id, counter);
        counter += 1;
      }
    }

    return map;
  }, [groupedItems]);

  const actionMenuItem = useMemo(
    () => kpiItems.find((item) => item.id === actionMenuItemId) ?? null,
    [kpiItems, actionMenuItemId]
  );

  const handleMovePeriod = (direction: "prev" | "next") => {
    setCursorDate((prev) => {
      const nextDate = new Date(prev);
      if (periodMode === "monthly") {
        nextDate.setMonth(prev.getMonth() + (direction === "prev" ? -1 : 1));
      } else {
        nextDate.setDate(prev.getDate() + (direction === "prev" ? -7 : 7));
      }
      return nextDate;
    });
  };

  const openCreateModal = () => {
    setCreateError("");
    setEditingKpiId(null);
    setDraft(getDefaultDraft(periodMode));
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setCreateError("");
    setEditingKpiId(null);
  };

  const openEditModal = (item: KpiRecord) => {
    setCreateError("");
    setEditingKpiId(item.id);
    setDraft({
      departmentId: item.departmentsId || "",
      departmentTitle: item.department,
      source: item.source || "Вручную",
      valueSymbol: item.valueSymbol || "",
      valueSymbolPosition: item.valueSymbolPosition || "suffix",
      name: item.name,
      description: item.description,
      goalType: item.goalType,
      startDate: normalizeDateInputValue(item.startDate),
      endDate: normalizeDateInputValue(item.endDate),
      planValue: String(item.planValue),
    });
    setIsCreateModalOpen(true);
  };

  const closeActionMenu = () => {
    setActionMenuItemId(null);
    setActionMenuAnchorEl(null);
  };

  const openActionMenu = (event: MouseEvent<HTMLButtonElement>, itemId: string) => {
    const isSameItem = actionMenuItemId === itemId;
    if (isSameItem) {
      closeActionMenu();
      return;
    }
    setActionMenuItemId(itemId);
    setActionMenuAnchorEl(event.currentTarget);
  };

  const closeDeleteModal = () => {
    setKpiToDelete(null);
  };

  const handleDeleteKpi = async () => {
    if (!kpiToDelete) return;
    try {
      await reportsService.deleteKpi({ guid: kpiToDelete.id });
      toast.success("KPI удален");
      setReloadToken((prev) => prev + 1);
    } catch (error) {
      toast.error("Не удалось удалить KPI");
    }
    closeDeleteModal();
  };

  const handleDailyActualChange = (itemId: string, valueGuid: string, nextDayActual: number) => {
    setKpiItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;

        const nextMetrics = item.weeklyMetrics.map((metric) =>
          metric.guid === valueGuid
            ? {
                ...metric,
                actual: nextDayActual,
                percent: calcPercent(nextDayActual, metric.plan),
              }
            : metric
        );
        const nextValues = item.values.map((value) =>
          value.guid === valueGuid
            ? {
                ...value,
                actual_value: nextDayActual,
                percent: calcPercent(nextDayActual, value.plan_value),
              }
            : value
        );
        const nextActualValue = roundToTwo(nextMetrics.reduce((sum, current) => sum + current.actual, 0));

        return {
          ...item,
          actualValue: nextActualValue,
          percentTotal: calcPercent(nextActualValue, item.planValue),
          values: nextValues,
          weeklyMetrics: nextMetrics,
        };
      })
    );
  };

  const openDailyCellEdit = (itemId: string, dayIndex: number, currentValue: number) => {
    setEditingDailyCell({
      itemId,
      dayIndex,
      draftValue: formatMetricValue(currentValue),
    });
  };

  const commitDailyCellEdit = (itemId: string, dayIndex: number, rawValue: string) => {
    const item = kpiItems.find((entry) => entry.id === itemId);
    if (!item) return;
    const metric = item.weeklyMetrics[dayIndex];
    if (!metric?.guid) return;

    const normalizedRaw = rawValue.trim().replace(",", ".");
    const parsedValue = Number(normalizedRaw);
    const nextDayActual = !Number.isFinite(parsedValue) || parsedValue < 0 ? 0 : roundToTwo(parsedValue);
    handleDailyActualChange(itemId, metric.guid, nextDayActual);

    void (async () => {
      try {
        const response = await reportsService.updateKpiValue({
          kpi_value_guid: metric.guid,
          actual_value: nextDayActual,
        });
        const totals = response.result?.totals;
        if (!totals) return;

        setKpiItems((prev) =>
          prev.map((entry) =>
            entry.id === itemId
              ? {
                  ...entry,
                  actualValue: roundToTwo(Number(totals.actual_total) || 0),
                  percentTotal: Number.isFinite(totals.percent_total)
                    ? Number(totals.percent_total)
                    : calcPercent(Number(totals.actual_total) || 0, entry.planValue),
                }
              : entry
          )
        );
      } catch (error) {
        toast.error("Не удалось сохранить фактическое значение");
        setReloadToken((prev) => prev + 1);
      }
    })();
  };

  const handleDailyCellKeyDown = (event: KeyboardEvent<HTMLInputElement>, itemId: string, dayIndex: number) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitDailyCellEdit(itemId, dayIndex, event.currentTarget.value);
      setEditingDailyCell(null);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setEditingDailyCell(null);
    }
  };

  const handleSaveKpi = async () => {
    if (isCreateSaving) return;
    const name = draft.name.trim();
    const departmentId = draft.departmentId.trim();
    const planValue = Number(draft.planValue);

    if (!departmentId) {
      setCreateError("Выберите отдел");
      return;
    }

    if (!name) {
      setCreateError("Введите название KPI");
      return;
    }

    if (!draft.startDate || !draft.endDate) {
      setCreateError("Укажите период KPI");
      return;
    }

    if (!Number.isFinite(planValue) || planValue <= 0) {
      setCreateError("Плановое значение должно быть больше 0");
      return;
    }

    setCreateError("");
    setIsCreateSaving(true);

    try {
      const editableItem = editingKpiId ? kpiItems.find((item) => item.id === editingKpiId) : null;
      const valuesPayload = editableItem
        ? editableItem.values.map((value) => ({
            bucket_type: value.bucket_type,
            bucket_start: value.bucket_start,
            bucket_end: value.bucket_end,
            plan_value: value.plan_value,
            actual_value: value.actual_value,
            bucket_index: value.bucket_index,
          }))
        : undefined;

      await reportsService.saveKpi({
        guid: editingKpiId || undefined,
        companies_id: companyStore.company?.guid,
        departments_id: departmentId,
        title: name,
        description: draft.description.trim(),
        source: draft.source.trim() || "Вручную",
        value_symbol: draft.valueSymbol.trim() || undefined,
        value_symbol_position: draft.valueSymbolPosition,
        period_type: draft.goalType,
        start_date: draft.startDate,
        end_date: draft.endDate,
        plan_total: planValue,
        buckets: valuesPayload,
      });

      setIsCreateModalOpen(false);
      setCreateError("");
      setEditingKpiId(null);
      toast.success(editingKpiId ? "KPI обновлен" : "KPI добавлен");
      setReloadToken((prev) => prev + 1);
      setDraft(getDefaultDraft(periodMode));
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Не удалось сохранить KPI");
    } finally {
      setIsCreateSaving(false);
    }
  };

  return (
    <>
      <PageMeta title="KPI | HRMS" description="Управление KPI по отделам" />

      <div className="-mx-3 md:-mx-4 -mt-3 md:-mt-4">
        <div
          className="px-4 lg:px-6 py-2"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            flexWrap: "wrap",
            backgroundColor: "#fff",
            border: "1px solid #e2e8f0",
            borderTop: "none",
            borderBottom: isFiltersOpen ? "none" : "1px solid #e2e8f0",
          }}
        >
          <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
            {KPI_PERIOD_TABS.map((tab) => {
              const isActive = periodMode === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setPeriodMode(tab.key)}
                  className={`h-9 rounded-xl px-4 text-sm font-semibold transition ${
                    isActive
                      ? "bg-white text-brand-500 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex min-w-0 items-center justify-end gap-2 flex-wrap">
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "3px",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                backgroundColor: "#f8fafc",
                height: "38px",
              }}
            >
              <button
                type="button"
                onClick={() => handleMovePeriod("prev")}
                className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-transparent text-slate-600 transition hover:bg-white hover:border-slate-200"
                aria-label={periodMode === "monthly" ? "Предыдущий месяц" : "Предыдущая неделя"}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="min-w-[170px] px-3 text-center text-[13px] font-semibold text-slate-700">
                {currentPeriodLabel}
              </span>
              <button
                type="button"
                onClick={() => handleMovePeriod("next")}
                className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-transparent text-slate-600 transition hover:bg-white hover:border-slate-200"
                aria-label={periodMode === "monthly" ? "Следующий месяц" : "Следующая неделя"}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <ExpandableSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              inputId="kpi-search"
              placeholder="Поиск KPI..."
              expandedWidth={300}
              collapsedSize={40}
              brandColor={companyStore.mainColor}
            />

            <button
              type="button"
              onClick={() => setIsFiltersOpen((open) => !open)}
              className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition ${
                isFilterButtonActive
                  ? "border-blue-200 bg-blue-50 text-blue-600"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal size={16} />
              Фильтр{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              <Plus size={16} />
              Добавить KPI
            </button>
          </div>
        </div>

        {isFiltersOpen ? (
          <div
            className="px-4 lg:px-6 py-2"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
              justifyContent: "flex-start",
              background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
              border: "1px solid #e2e8f0",
              borderTop: "1px solid #dbe4ee",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
            }}
          >
            <div style={{ minWidth: "220px", maxWidth: "280px", flex: "0 1 280px" }}>
              <Select
                options={departmentFilterOptions}
                value={selectedDepartmentFilterOption}
                onChange={(option) => setDepartmentFilter(option?.value || "")}
                placeholder="Все отделы"
                isClearable
                isDisabled={isLoadingFilters}
                styles={filterSelectStyles}
                menuPortalTarget={filterSelectPortalTarget}
                menuPosition="fixed"
              />
            </div>

            <div style={{ minWidth: "220px", maxWidth: "280px", flex: "0 1 280px" }}>
              <Select
                options={sourceFilterOptions}
                value={selectedSourceFilterOption}
                onChange={(option) => setSourceFilter(option?.value || "")}
                placeholder="Все типы"
                isClearable
                isDisabled={isLoadingFilters}
                styles={filterSelectStyles}
                menuPortalTarget={filterSelectPortalTarget}
                menuPosition="fixed"
              />
            </div>

            {(departmentFilter || sourceFilter) ? (
              <button
                type="button"
                onClick={() => {
                  setDepartmentFilter("");
                  setSourceFilter("");
                }}
                className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Сбросить
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="px-4 lg:px-6 py-5">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="px-4 py-4">
            {isLoading ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
                <p className="m-0 text-[13px] text-slate-500">Загрузка KPI...</p>
              </div>
            ) : kpiItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
                <p className="m-0 text-[13px] text-slate-500">KPI не найдены</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table
                  className={`${periodMode === "weekly" ? "min-w-[2600px]" : "min-w-[1800px]"} text-center [&_th]:align-middle [&_td]:align-middle [&_th]:text-center [&_td]:text-center [&_th]:border-r [&_th]:border-slate-100 [&_td]:border-r [&_td]:border-slate-100 [&_th:last-child]:border-r-0 [&_td:last-child]:border-r-0`}
                >
                  <thead>
                    {periodMode === "monthly" ? (
                      <>
                        <tr className="border-b border-slate-200">
                          <th
                            rowSpan={2}
                            className="sticky left-0 z-30 w-12 min-w-[52px] !border-r-0 bg-white py-1.5 pl-3 pr-3 text-[12px] font-semibold text-slate-500 shadow-[inset_-1px_0_0_#f1f5f9]"
                          >
                            #
                          </th>
                          <th
                            rowSpan={2}
                            className="sticky left-[52px] z-30 min-w-[240px] !border-r-0 bg-white py-1.5 !pl-4 pr-3 !text-left text-[12px] font-semibold text-slate-500 shadow-[inset_-1px_0_0_#f1f5f9]"
                          >
                            KPI / Название
                          </th>
                          <th
                            rowSpan={2}
                            className="py-2 pr-3 text-[12px] font-semibold text-slate-500"
                          >
                            Источник
                          </th>
                          <th
                            rowSpan={2}
                            className="py-2 pr-3 text-[12px] font-semibold text-slate-500"
                          >
                            Тип
                          </th>
                          <th
                            rowSpan={2}
                            className="py-2 pr-3 text-[12px] font-semibold text-slate-500"
                          >
                            Период
                          </th>
                          {monthlyWeekColumns.map((weekColumn) => (
                            <th
                              key={weekColumn.key}
                              colSpan={3}
                              className="px-2 py-2 text-center text-[12px] font-semibold text-slate-500"
                            >
                              {weekColumn.label}
                            </th>
                          ))}
                          <th
                            colSpan={3}
                            className="border-l-2 border-blue-100 bg-blue-50/60 px-2 py-2 text-center text-[12px] font-semibold text-slate-600"
                          >
                            Итого
                          </th>
                        </tr>
                        <tr className="border-b border-slate-200">
                          {["week-1", "week-2", "week-3", "week-4"].map((weekKey) => (
                            <Fragment key={`${weekKey}-sub`}>
                              <th className="px-1 py-1 text-center text-[12px] font-semibold text-slate-500">
                                План
                              </th>
                              <th className="px-1 py-1 text-center text-[12px] font-semibold text-slate-500">
                                Факт
                              </th>
                              <th className="px-1 py-1 text-center text-[12px] font-semibold text-slate-500">
                                %
                              </th>
                            </Fragment>
                          ))}
                          <th className="border-l-2 border-blue-100 bg-blue-50/60 px-1 py-1 text-center text-[12px] font-semibold text-slate-600">
                            План
                          </th>
                          <th className="bg-blue-50/60 px-1 py-1 text-center text-[12px] font-semibold text-slate-600">
                            Факт
                          </th>
                          <th className="bg-blue-50/60 px-1 py-1 text-center text-[12px] font-semibold text-slate-600">
                            %
                          </th>
                        </tr>
                      </>
                    ) : (
                      <>
                        <tr className="border-b border-slate-200">
                          <th
                            rowSpan={2}
                            className="sticky left-0 z-30 w-12 min-w-[52px] !border-r-0 bg-white py-1.5 pl-3 pr-3 text-center text-[12px] font-semibold text-slate-500 shadow-[inset_-1px_0_0_#f1f5f9]"
                          >
                            #
                          </th>
                          <th
                            rowSpan={2}
                            className="sticky left-[52px] z-30 min-w-[240px] !border-r-0 bg-white py-1.5 !pl-4 pr-3 !text-left text-[12px] font-semibold text-slate-500 shadow-[inset_-1px_0_0_#f1f5f9]"
                          >
                            KPI / Название
                          </th>
                          <th
                            rowSpan={2}
                            className="py-2 pr-3 text-[12px] font-semibold text-slate-500"
                          >
                            Источник
                          </th>
                          <th
                            rowSpan={2}
                            className="py-2 pr-3 text-[12px] font-semibold text-slate-500"
                          >
                            Тип
                          </th>
                          <th
                            rowSpan={2}
                            className="py-2 pr-3 text-[12px] font-semibold text-slate-500"
                          >
                            Период
                          </th>
                          {weeklyDayColumns.map((dayColumn) => (
                            <th
                              key={dayColumn.key}
                              colSpan={3}
                              className="px-2 py-2 text-center text-[12px] font-semibold text-slate-500"
                            >
                              {dayColumn.label}
                            </th>
                          ))}
                          <th
                            colSpan={3}
                            className="border-l-2 border-blue-100 bg-blue-50/60 px-2 py-2 text-center text-[12px] font-semibold text-slate-600"
                          >
                            Итого
                          </th>
                        </tr>
                        <tr className="border-b border-slate-200">
                          {weeklyDayColumns.map((dayColumn) => (
                            <Fragment key={`${dayColumn.key}-sub`}>
                              <th className="px-1 py-1 text-center text-[12px] font-semibold text-slate-500">
                                План
                              </th>
                              <th className="px-1 py-1 text-center text-[12px] font-semibold text-slate-500">
                                Факт
                              </th>
                              <th className="px-1 py-1 text-center text-[12px] font-semibold text-slate-500">
                                %
                              </th>
                            </Fragment>
                          ))}
                          <th className="border-l-2 border-blue-100 bg-blue-50/60 px-1 py-1 text-center text-[12px] font-semibold text-slate-600">
                            План
                          </th>
                          <th className="bg-blue-50/60 px-1 py-1 text-center text-[12px] font-semibold text-slate-600">
                            Факт
                          </th>
                          <th className="bg-blue-50/60 px-1 py-1 text-center text-[12px] font-semibold text-slate-600">
                            %
                          </th>
                        </tr>
                      </>
                    )}
                  </thead>
                  <tbody>
                    {groupedItems.map(([department, items]) => {
                      return (
                        <Fragment key={`group-${department}`}>
                          <tr key={`group-${department}`} className="border-b border-slate-100 bg-slate-50/70">
                            <td className="sticky left-0 z-20 w-12 min-w-[52px] !border-r-0 bg-slate-50/70 py-1.5 pl-3 pr-3 shadow-[inset_-1px_0_0_#f1f5f9]" />
                            <td className="sticky left-[52px] z-20 min-w-[240px] !border-r-0 bg-slate-50/70 py-1.5 !pl-4 pr-3 !text-left shadow-[inset_-1px_0_0_#f1f5f9]">
                              <div className="text-[13px] font-semibold text-brand-500">
                                {department}
                              </div>
                            </td>
                            <td colSpan={periodMode === "monthly" ? 18 : 27} className="py-1.5 pr-3">
                            </td>
                          </tr>

                          {items.map((item) => {
                            const totalActualValue = item.actualValue;
                            const totalPercent = item.percentTotal;
                            const dailyMetrics = item.weeklyMetrics;
                            return (
                              <tr key={item.id} className="group border-b border-slate-100">
                                <td className="sticky left-0 z-10 w-12 min-w-[52px] !border-r-0 bg-white py-1.5 pl-3 pr-3 text-[13px] text-slate-500 shadow-[inset_-1px_0_0_#f1f5f9]">
                                  {rowIndexById.get(item.id) ?? "—"}
                                </td>
                                <td className="sticky left-[52px] z-10 min-w-[240px] !border-r-0 bg-white py-1.5 !pl-4 pr-3 !text-left shadow-[inset_-1px_0_0_#f1f5f9]">
                                  <div className="flex items-center justify-start gap-1.5">
                                    <span className="text-[13px] font-semibold text-slate-900">{item.name}</span>
                                    <button
                                      type="button"
                                      className={`dropdown-toggle inline-flex h-6 w-6 items-center justify-center rounded-md border transition ${
                                        actionMenuItemId === item.id
                                          ? "border-slate-300 bg-slate-50 text-slate-600 opacity-100"
                                          : "border-transparent text-slate-400 opacity-0 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-600 group-hover:opacity-100 focus:opacity-100"
                                      }`}
                                      onClick={(event) => openActionMenu(event, item.id)}
                                      aria-label={`Действия для ${item.name}`}
                                    >
                                      <MoreHorizontal size={14} />
                                    </button>
                                  </div>
                                </td>
                                <td className="py-1.5 pr-3 text-[13px] text-slate-700">{item.source}</td>
                                <td className="py-1.5 pr-3 text-[13px] text-slate-700">
                                  <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-sm font-semibold text-blue-600">
                                    {item.goalType === "monthly" ? "Мес. цель" : "Нед. цель"}
                                  </span>
                                </td>
                                <td className="py-1.5 pr-3 text-[13px] text-slate-600">
                                  {formatDisplayDate(item.startDate)} <br />
                                  {formatDisplayDate(item.endDate)}
                                </td>
                                {periodMode === "monthly" ? (
                                  <>
                                    {item.weeklyMetrics.map((week, weekIndex) => {
                                      const weekPercent = week.percent;
                                      return (
                                        <Fragment key={`${item.id}-week-${weekIndex}`}>
                                          <td className="px-1 py-1.5 text-center text-[13px] text-slate-500">
                                            {formatValueWithSymbol(
                                              week.plan,
                                              item.valueSymbol,
                                              item.valueSymbolPosition
                                            )}
                                          </td>
                                          <td className="px-1 py-1.5 text-center text-[13px] font-semibold text-slate-800">
                                            {formatValueWithSymbol(
                                              week.actual,
                                              item.valueSymbol,
                                              item.valueSymbolPosition
                                            )}
                                          </td>
                                          <td className="px-1 py-1.5 text-center">
                                            <span
                                              className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold ${getPercentBadgeClass(
                                                weekPercent
                                              )}`}
                                            >
                                              {weekPercent}%
                                            </span>
                                          </td>
                                        </Fragment>
                                      );
                                    })}
                                    <td className="border-l-2 border-blue-100 bg-blue-50/50 px-1 py-1.5 text-center text-[13px] font-medium text-slate-700">
                                      {formatValueWithSymbol(
                                        item.planValue,
                                        item.valueSymbol,
                                        item.valueSymbolPosition
                                      )}
                                    </td>
                                    <td className="bg-blue-50/50 px-1 py-1.5 text-center text-[13px] font-semibold text-slate-900">
                                      {formatValueWithSymbol(
                                        item.actualValue,
                                        item.valueSymbol,
                                        item.valueSymbolPosition
                                      )}
                                    </td>
                                    <td className="bg-blue-50/50 px-1 py-1.5 text-center">
                                      <span
                                        className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold ${getPercentBadgeClass(
                                          totalPercent
                                        )}`}
                                      >
                                        {totalPercent}%
                                      </span>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    {dailyMetrics.map((dayMetric, dayIndex) => (
                                      <Fragment key={`${item.id}-day-${dayIndex}`}>
                                        <td className="px-1 py-1.5 text-center text-[13px] text-slate-500">
                                          {formatValueWithSymbol(
                                            dayMetric.plan,
                                            item.valueSymbol,
                                            item.valueSymbolPosition
                                          )}
                                        </td>
                                        <td className="px-1 py-1.5 text-center">
                                          {!dayMetric.guid ? (
                                            <span className="text-[12px] text-slate-300">—</span>
                                          ) : editingDailyCell?.itemId === item.id &&
                                          editingDailyCell.dayIndex === dayIndex ? (
                                            <input
                                              type="number"
                                              min={0}
                                              step="0.01"
                                              autoFocus
                                              value={editingDailyCell.draftValue}
                                              onChange={(event) =>
                                                setEditingDailyCell((prev) =>
                                                  prev &&
                                                  prev.itemId === item.id &&
                                                  prev.dayIndex === dayIndex
                                                    ? { ...prev, draftValue: event.target.value }
                                                    : prev
                                                )
                                              }
                                              onBlur={(event) => {
                                                commitDailyCellEdit(item.id, dayIndex, event.target.value);
                                                setEditingDailyCell(null);
                                              }}
                                              onKeyDown={(event) =>
                                                handleDailyCellKeyDown(event, item.id, dayIndex)
                                              }
                                              className="h-7 w-[72px] rounded-md border border-slate-200 px-2 text-center text-[12px] font-semibold text-slate-800 outline-none transition focus:border-slate-300"
                                            />
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                openDailyCellEdit(item.id, dayIndex, dayMetric.actual)
                                              }
                                              className="inline-flex h-7 w-[72px] items-center justify-center rounded-md border border-transparent px-2 text-center text-[12px] font-semibold text-slate-800 transition hover:border-slate-200 hover:bg-slate-50"
                                            >
                                              {formatValueWithSymbol(
                                                dayMetric.actual,
                                                item.valueSymbol,
                                                item.valueSymbolPosition
                                              )}
                                            </button>
                                          )}
                                        </td>
                                        <td className="px-1 py-1.5 text-center">
                                          <span
                                            className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold ${getPercentBadgeClass(
                                              dayMetric.percent
                                            )}`}
                                          >
                                            {dayMetric.percent}%
                                          </span>
                                        </td>
                                      </Fragment>
                                    ))}
                                    <td className="border-l-2 border-blue-100 bg-blue-50/50 px-1 py-1.5 text-center text-[13px] font-medium text-slate-700">
                                      {formatValueWithSymbol(
                                        item.planValue,
                                        item.valueSymbol,
                                        item.valueSymbolPosition
                                      )}
                                    </td>
                                    <td className="bg-blue-50/50 px-1 py-1.5 text-center text-[13px] font-semibold text-slate-900">
                                      {formatValueWithSymbol(
                                        totalActualValue,
                                        item.valueSymbol,
                                        item.valueSymbolPosition
                                      )}
                                    </td>
                                    <td className="bg-blue-50/50 px-1 py-1.5 text-center">
                                      <span
                                        className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-semibold ${getPercentBadgeClass(
                                          totalPercent
                                        )}`}
                                      >
                                        {totalPercent}%
                                      </span>
                                    </td>
                                  </>
                                )}
                              </tr>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        className="mx-4 w-full max-w-4xl p-5 sm:p-6"
        showCloseButton={false}
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {editingKpiId ? "Редактировать KPI" : "Добавить KPI"}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {editingKpiId
                  ? "Обновите поля KPI и сохраните изменения."
                  : "Заполните поля и сохраните KPI."}
              </p>
            </div>
            <button
              type="button"
              onClick={closeCreateModal}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
              aria-label="Закрыть модальное окно"
            >
              <X size={18} />
            </button>
          </div>

          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-xs font-medium text-slate-500">Отдел *</span>
                  <RemoteSingleSelect
                    value={draft.departmentId}
                    onChange={(value) =>
                      setDraft((prev) => ({
                        ...prev,
                        departmentId: value,
                        departmentTitle: "",
                      }))
                    }
                    loadOptions={loadDepartmentOptions}
                    fallbackOption={selectedDepartmentFallbackOption}
                    placeholder="Выберите отдел"
                    classNamePrefix="kpi-department-select"
                    menuPortalTarget={selectPortalTarget}
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-medium text-slate-500">Источник</span>
                  <input
                    type="text"
                    value={draft.source}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        source: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                    placeholder="Вручную"
                  />
                </label>

              </div>

              <label className="block space-y-2">
                <span className="text-xs font-medium text-slate-500">Название KPI *</span>
              <input
                type="text"
                value={draft.name}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                placeholder="Например: Задачи выполнено"
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-slate-300"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-medium text-slate-500">Описание</span>
              <textarea
                value={draft.description}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                placeholder="Краткое описание метрики..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-300"
              />
            </label>

            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-500">Тип KPI *</div>
              <div className="flex flex-wrap gap-4">
                {KPI_PERIOD_TABS.map((tab) => {
                  const isActive = draft.goalType === tab.key;
                  return (
                    <button
                      key={`goal-type-${tab.key}`}
                      type="button"
                      onClick={() =>
                        setDraft((prev) => {
                          const defaults = getDefaultDraft(tab.key);
                          return {
                            ...prev,
                            goalType: tab.key,
                            startDate: defaults.startDate,
                            endDate: defaults.endDate,
                          };
                        })
                      }
                      className={`inline-flex h-10 items-center rounded-xl border px-4 text-sm font-semibold transition ${
                        isActive
                          ? "border-brand-500 bg-brand-50 text-brand-500"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-xs font-medium text-slate-500">Начало периода *</span>
                <DatePicker
                  selected={toDatePickerValue(draft.startDate)}
                  onChange={(date: Date | null) =>
                    setDraft((prev) => ({
                      ...prev,
                      startDate: date ? toIsoDate(date) : "",
                    }))
                  }
                  dateFormat="dd.MM.yyyy"
                  placeholderText="Выберите дату"
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                  popperClassName="kpi-datepicker-popper"
                  popperProps={{ strategy: "fixed" }}
                  portalId="root"
                  withPortal
                  showPopperArrow={false}
                  calendarStartDay={1}
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-medium text-slate-500">Конец периода *</span>
                <DatePicker
                  selected={toDatePickerValue(draft.endDate)}
                  onChange={(date: Date | null) =>
                    setDraft((prev) => ({
                      ...prev,
                      endDate: date ? toIsoDate(date) : "",
                    }))
                  }
                  dateFormat="dd.MM.yyyy"
                  placeholderText="Выберите дату"
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                  popperClassName="kpi-datepicker-popper"
                  popperProps={{ strategy: "fixed" }}
                  portalId="root"
                  withPortal
                  showPopperArrow={false}
                  calendarStartDay={1}
                />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-xs font-medium text-slate-500">Плановое значение *</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={draft.planValue}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    planValue: event.target.value,
                  }))
                }
                placeholder="100"
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-slate-300"
              />
            </label>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-xs font-medium text-slate-500">Символ/текст возле значения</span>
                <input
                  type="text"
                  value={draft.valueSymbol}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      valueSymbol: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                  placeholder="Например: $, %, сум"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-medium text-slate-500">Позиция символа</span>
                <Select
                  options={valueSymbolPositionOptions}
                  value={selectedValueSymbolPositionOption}
                  onChange={(option) =>
                    setDraft((prev) => ({
                      ...prev,
                      valueSymbolPosition: option?.value === "prefix" ? "prefix" : "suffix",
                    }))
                  }
                  styles={filterSelectStyles}
                  menuPortalTarget={typeof window !== "undefined" ? window.document.body : null}
                  menuPosition="fixed"
                  isSearchable={false}
                />
              </label>
            </div>

            {createError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                {createError}
              </div>
            ) : null}
          </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-5">
            <button
              type="button"
              onClick={closeCreateModal}
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => {
                void handleSaveKpi();
              }}
              disabled={isCreateSaving}
              className="inline-flex h-10 items-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCreateSaving
                ? "Сохранение..."
                : editingKpiId
                  ? "Сохранить изменения"
                  : "Сохранить KPI"}
            </button>
          </div>
        </div>
      </Modal>

      <Dropdown
        isOpen={Boolean(actionMenuItemId && actionMenuAnchorEl)}
        onClose={closeActionMenu}
        usePortal
        anchorEl={actionMenuAnchorEl}
        className="w-[160px] p-1"
      >
        <DropdownItem
          onClick={() => {
            if (!actionMenuItem) return;
            openEditModal(actionMenuItem);
          }}
          onItemClick={closeActionMenu}
          className="flex items-center gap-2 rounded-lg text-slate-700"
        >
          <Pencil size={14} />
          Редактировать
        </DropdownItem>
        <DropdownItem
          onClick={() => {
            if (!actionMenuItem) return;
            setKpiToDelete(actionMenuItem);
          }}
          onItemClick={closeActionMenu}
          className="flex items-center gap-2 rounded-lg text-rose-600 hover:bg-rose-50 hover:text-rose-700"
        >
          <Trash2 size={14} />
          Удалить
        </DropdownItem>
      </Dropdown>

      <Modal
        isOpen={Boolean(kpiToDelete)}
        onClose={closeDeleteModal}
        className="mx-4 w-full max-w-md p-5 sm:p-6"
        showCloseButton={false}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-900">Удалить KPI?</h3>
            <p className="text-sm text-slate-500">Это действие нельзя отменить.</p>
            {kpiToDelete ? (
              <p className="text-sm font-medium text-slate-700">{kpiToDelete.name}</p>
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeDeleteModal}
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleDeleteKpi}
              className="inline-flex h-10 items-center rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700"
            >
              Удалить
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default observer(KpiPage);
