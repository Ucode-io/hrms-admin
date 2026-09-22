import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import Select, { type StylesConfig } from "react-select";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../components/common/PageMeta";
import { Modal } from "../../../components/ui/modal";
import reportsService from "../../../api/services/reports.service";
import companyStore from "../../../store/company.store";
import { Dropdown } from "../../../components/ui/dropdown/Dropdown";
import { DropdownItem } from "../../../components/ui/dropdown/DropdownItem";
import EmployeesPaginationFooter from "../../Employees/List/components/EmployeesPaginationFooter";
import ExpandableSearchInput from "../../../components/form/ExpandableSearchInput";
import DateInput from "../../../components/form/DateInput";
import {
  useDeleteEmployeeCompensation,
  useCreateEmployeeCompensation,
  type EmployeeCompensation,
  useEmployeeSalaryCompensationsQuery,
  useUpdateEmployeeCompensation,
} from "../../../api/services/employeeCompensation.service";
import { COMPANY_ID, useSettingsDirectoryQuery } from "../../../api/services/settingsDirectory.service";
import EmployeeInfiniteSelect from "../../../components/autocomplete/EmployeeInfiniteSelect";
import { useTranslation } from "../../../i18n";

type OperationType = "income" | "deduction";
type PaginationItem = number | string;
type FilterOption = { value: string; label: string };

type CompensationRecord = {
  guid: string;
  employeeGuid: string;
  employeeName: string;
  date: string;
  amount: number;
  description: string;
  createdAt: string;
  compensationTypeId: string;
  compensationTypeTitle: string;
  operationType: OperationType;
};

type CompensationTypeItem = {
  guid: string;
  title?: string;
  slug?: string;
  operation_type?: string[] | string | null;
  [key: string]: unknown;
};

type EditDraft = {
  accrualDate: string;
  amount: string;
  description: string;
  compensationTypeId: string;
  operationType: OperationType;
};

type CreateDraft = {
  employeeGuid: string;
  employeeName: string;
  accrualDate: string;
  description: string;
  amountsByType: Record<string, string>;
};

const OPERATION_LABELS: Record<OperationType, string> = {
  income: "Начисление",
  deduction: "Удержание",
};

const OPERATION_TAG_STYLES: Record<OperationType, string> = {
  income: "border-emerald-200 bg-emerald-50 text-emerald-700",
  deduction: "border-rose-200 bg-rose-50 text-rose-700",
};
const COMPENSATION_TYPES_SLUG = "compensation_types";
const PAGE_SIZE = 20;
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  month: "long",
  year: "numeric",
});

const toIsoDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getMonthRange = (monthDate: Date): { from: string; to: string } => {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  return {
    from: toIsoDate(start),
    to: toIsoDate(end),
  };
};

const formatMonthLabel = (monthDate: Date): string => {
  const formatted = MONTH_LABEL_FORMATTER.format(monthDate);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

const toMonthKey = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const resolveOperationType = (value: unknown): OperationType => {
  if (Array.isArray(value)) {
    return value[0] === "deduction" || value[0] === "outcome" ? "deduction" : "income";
  }

  return value === "deduction" || value === "outcome" ? "deduction" : "income";
};

const toTime = (date: string) => {
  const ts = new Date(date).getTime();
  return Number.isNaN(ts) ? 0 : ts;
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatDateTime = (dateStr: string): string => {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatAmount = (value: number): string => {
  return `${new Intl.NumberFormat("ru-RU").format(value)} сум`;
};

const getDefaultEditDraft = (): EditDraft => ({
  accrualDate: toIsoDate(new Date()),
  amount: "",
  description: "",
  compensationTypeId: "",
  operationType: "income",
});

const getDefaultCreateDraft = (accrualDate = toIsoDate(new Date())): CreateDraft => ({
  employeeGuid: "",
  employeeName: "",
  accrualDate,
  description: "",
  amountsByType: {},
});

const base64ToBlob = (base64: string, mimeType: string): Blob => {
  const binaryString = window.atob(base64);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);

  for (let index = 0; index < length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType || "application/octet-stream" });
};

const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error("Не удалось прочитать файл."));
    };

    reader.onload = () => {
      const raw = typeof reader.result === "string" ? reader.result : "";
      const commaIndex = raw.indexOf(",");
      const base64 = commaIndex >= 0 ? raw.slice(commaIndex + 1) : raw;
      if (!base64) {
        reject(new Error("Файл не содержит данных."));
        return;
      }
      resolve(base64);
    };

    reader.readAsDataURL(file);
  });
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

const buildPaginationItems = (currentPage: number, totalPages: number): PaginationItem[] => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);

  if (currentPage <= 3) {
    pages.add(2);
    pages.add(3);
    pages.add(4);
  }

  if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
    pages.add(totalPages - 3);
  }

  const sortedPages = [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  const result: PaginationItem[] = [];

  for (let index = 0; index < sortedPages.length; index += 1) {
    const page = sortedPages[index];
    const prevPage = sortedPages[index - 1];

    if (prevPage && page - prevPage > 1) {
      result.push(`ellipsis-${prevPage}-${page}`);
    }

    result.push(page);
  }

  return result;
};

const resolveEmployeeName = (item: EmployeeCompensation): { guid: string; name: string } => {
  const source = item as Record<string, unknown>;
  const relationCandidates = [
    item.user_base_id_data,
    source.employee_data,
    source.employee_id_data,
    source.user_data,
    source.user_id_data,
  ];

  const relation = relationCandidates.find(
    (candidate): candidate is Record<string, unknown> =>
      Boolean(candidate) && typeof candidate === "object" && !Array.isArray(candidate)
  );

  const firstName = typeof relation?.first_name === "string" ? relation.first_name : "";
  const secondName = typeof relation?.second_name === "string" ? relation.second_name : "";
  const fullNameFromRelation = typeof relation?.full_name === "string" ? relation.full_name : "";
  const fullNameFromItem = typeof source.full_name === "string" ? source.full_name : "";
  const fullName = [secondName, firstName].filter(Boolean).join(" ").trim();

  return {
    guid:
      (typeof relation?.guid === "string" && relation.guid) ||
      (typeof item.user_base_id === "string" ? item.user_base_id : "") ||
      (typeof source.employee_id === "string" ? source.employee_id : "") ||
      (typeof source.user_id === "string" ? source.user_id : ""),
    name: fullName || fullNameFromRelation || fullNameFromItem || "—",
  };
};

function FinanceSalaryPage() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [operationFilter, setOperationFilter] = useState("");
  const [compensationTypeFilter, setCompensationTypeFilter] = useState("");
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isImportingExcel, setIsImportingExcel] = useState(false);
  const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CompensationRecord | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<CompensationRecord | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>(getDefaultEditDraft());
  const [editError, setEditError] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateDraft>(() =>
    getDefaultCreateDraft(toIsoDate(new Date()))
  );
  const [createError, setCreateError] = useState("");
  const lastKnownTotalCountRef = useRef(0);
  const lastPenaltySyncMonthRef = useRef("");
  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const templateMenuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const selectPortalTarget = typeof document !== "undefined" ? document.body : null;
  const createMutation = useCreateEmployeeCompensation("all");
  const updateMutation = useUpdateEmployeeCompensation("all");
  const deleteMutation = useDeleteEmployeeCompensation("all");

  const { data: compensationTypesData } = useSettingsDirectoryQuery({
    slug: COMPENSATION_TYPES_SLUG,
    params: {
      limit: 1000,
      offset: 0,
    },
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
      setCurrentPage(1);
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchValue]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMonth]);

  useEffect(() => {
    setCurrentPage(1);
  }, [employeeFilter, operationFilter, compensationTypeFilter]);

  const monthRange = useMemo(() => getMonthRange(selectedMonth), [selectedMonth]);
  const monthKey = useMemo(() => toMonthKey(selectedMonth), [selectedMonth]);
  const monthLabel = useMemo(() => formatMonthLabel(selectedMonth), [selectedMonth]);

  const { data, isLoading, isFetching, isError, refetch } = useEmployeeSalaryCompensationsQuery({
    limit: PAGE_SIZE,
    offset: (currentPage - 1) * PAGE_SIZE,
    search: debouncedSearch,
    dateFrom: monthRange.from,
    dateTo: monthRange.to,
    userBaseId: employeeFilter || undefined,
    operationType:
      operationFilter === "income" || operationFilter === "deduction"
        ? operationFilter
        : undefined,
    compensationTypeId: compensationTypeFilter || undefined,
  });

  useEffect(() => {
    if (lastPenaltySyncMonthRef.current === monthKey) return;
    lastPenaltySyncMonthRef.current = monthKey;
    let active = true;
    void reportsService.syncAttendancePenalties(monthKey)
      .then(() => { if (active) void refetch(); })
      .catch(() => { if (active) toast.error("Не удалось обновить автоматические штрафы."); });
    return () => { active = false; };
  }, [monthKey, refetch]);

  const records = useMemo<CompensationRecord[]>(() => {
    const rows = (data?.response || []).map((item) => {
      const amountRaw = item.amount;
      const parsedAmount =
        typeof amountRaw === "number"
          ? amountRaw
          : typeof amountRaw === "string"
            ? Number(amountRaw)
            : 0;
      const employee = resolveEmployeeName(item);

      return {
        guid: item.guid,
        employeeGuid: employee.guid,
        employeeName: employee.name,
        date: typeof item.date === "string" ? item.date : "",
        amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
        description: typeof item.description === "string" ? item.description : "",
        createdAt: typeof item.created_at === "string" ? item.created_at : "",
        compensationTypeId:
          typeof item.compensation_types_id === "string" ? item.compensation_types_id : "",
        compensationTypeTitle:
          item.compensation_types_id_data &&
          typeof item.compensation_types_id_data.title === "string"
            ? item.compensation_types_id_data.title
            : "",
        operationType: resolveOperationType(item.operation_type),
      };
    });

    return rows.sort((a, b) => toTime(b.date) - toTime(a.date));
  }, [data?.response]);

  if (typeof data?.count === "number" && Number.isFinite(data.count)) {
    lastKnownTotalCountRef.current = data.count;
  }

  const totalCount = data?.count ?? lastKnownTotalCountRef.current;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const isPageLoading = isLoading || isFetching;
  const isMutatingRecord =
    createMutation.isLoading || updateMutation.isLoading || deleteMutation.isLoading;
  const companyGuid =
    companyStore.company?.guid && typeof companyStore.company.guid === "string"
      ? companyStore.company.guid
      : "";
  const compensationTypeOptions = useMemo(
    () => (compensationTypesData?.response || []) as CompensationTypeItem[],
    [compensationTypesData?.response]
  );
  const autoPenaltyTypeIds = useMemo(
    () => new Set(compensationTypeOptions.filter((item) => item.slug === "attendance_penalty").map((item) => item.guid)),
    [compensationTypeOptions]
  );
  const filteredCompensationTypeOptions = useMemo(
    () =>
      compensationTypeOptions.filter(
        (item) => item.slug !== "attendance_penalty" && resolveOperationType(item.operation_type) === editDraft.operationType
      ),
    [compensationTypeOptions, editDraft.operationType]
  );
  const operationFilterOptions: FilterOption[] = useMemo(
    () => [
      { value: "income", label: "Начисление" },
      { value: "deduction", label: "Удержание" },
    ],
    []
  );
  const compensationTypeFilterOptions = useMemo<FilterOption[]>(
    () =>
      compensationTypeOptions
        .filter((item) => typeof item.guid === "string" && typeof item.title === "string")
        .map((item) => ({
          value: item.guid,
          label: item.title || "Без названия",
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "ru")),
    [compensationTypeOptions]
  );
  const createCompensationTypeItems = useMemo(
    () =>
      compensationTypeOptions
        .filter((item) => typeof item.guid === "string" && item.slug !== "attendance_penalty")
        .map((item) => ({
          guid: item.guid as string,
          title: typeof item.title === "string" && item.title.trim() ? item.title : "Без названия",
          operationType: resolveOperationType(item.operation_type),
        }))
        .sort((a, b) => {
          if (a.operationType !== b.operationType) {
            return a.operationType === "income" ? -1 : 1;
          }
          return a.title.localeCompare(b.title, "ru");
        }),
    [compensationTypeOptions]
  );
  const knownEmployeeNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const record of records) {
      const guid = (record.employeeGuid || "").trim();
      const name = (record.employeeName || "").trim();
      if (!guid || !name || map.has(guid)) continue;
      map.set(guid, name);
    }
    return map;
  }, [records]);
  const activeFiltersCount = [employeeFilter, operationFilter, compensationTypeFilter].filter(Boolean).length;
  const isFilterButtonActive = isFiltersOpen || activeFiltersCount > 0;
  const filterSelectStyles = useMemo(
    () => ({
      control: (base: any, state: any) => ({
        ...base,
        minHeight: 40,
        borderRadius: 12,
        backgroundColor: state.hasValue ? "var(--color-brand-50)" : "#fff",
        borderColor: state.hasValue ? "var(--color-brand-200)" : state.isFocused ? "#cbd5e1" : "#e2e8f0",
        boxShadow: "none",
        "&:hover": {
          borderColor: state.hasValue ? "#93c5fd" : "#cbd5e1",
        },
      }),
      valueContainer: (base: any) => ({
        ...base,
        padding: "0 10px",
      }),
      indicatorsContainer: (base: any, state: any) => ({
        ...base,
        color: state.hasValue ? "var(--company-color)" : "#64748b",
      }),
      dropdownIndicator: (base: any, state: any) => ({
        ...base,
        color: state.hasValue ? "var(--company-color)" : "#64748b",
        padding: 6,
        "&:hover": {
          color: state.hasValue ? "var(--color-brand-700)" : "#475569",
        },
      }),
      clearIndicator: (base: any) => ({
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
      placeholder: (base: any) => ({
        ...base,
        color: "#94a3b8",
        fontSize: 14,
      }),
      input: (base: any) => ({
        ...base,
        color: "#1e293b",
        fontSize: 14,
        margin: 0,
        padding: 0,
      }),
      singleValue: (base: any, state: any) => ({
        ...base,
        color: state.hasValue ? "var(--company-color)" : "#334155",
        fontSize: 14,
        fontWeight: state.hasValue ? 600 : 500,
      }),
      menu: (base: any) => ({
        ...base,
        borderRadius: 10,
        overflow: "hidden",
        zIndex: 9999,
      }),
      menuPortal: (base: any) => ({
        ...base,
        zIndex: 9999,
      }),
      option: (base: any, state: any) => ({
        ...base,
        backgroundColor: state.isSelected ? "var(--color-brand-100)" : state.isFocused ? "#f8fafc" : "#fff",
        color: state.isSelected ? "var(--color-brand-700)" : "#1e293b",
        fontSize: 14,
        padding: "8px 12px",
      }),
      noOptionsMessage: (base: any) => ({
        ...base,
        color: "#64748b",
        fontSize: 13,
      }),
    }),
    []
  );
  const createEmployeeSelectStyles = useMemo<StylesConfig<FilterOption, false>>(
    () => ({
      control: (base, state) => ({
        ...base,
        minHeight: 40,
        borderRadius: 12,
        borderColor: state.isFocused ? "#cbd5e1" : "#e2e8f0",
        boxShadow: "none",
        "&:hover": {
          borderColor: "#cbd5e1",
        },
      }),
      valueContainer: (base) => ({
        ...base,
        padding: "0 10px",
        fontSize: 14,
      }),
      input: (base) => ({
        ...base,
        color: "#1e293b",
        fontSize: 14,
        margin: 0,
        padding: 0,
      }),
      singleValue: (base) => ({
        ...base,
        color: "#334155",
        fontSize: 14,
        fontWeight: 500,
      }),
      placeholder: (base) => ({
        ...base,
        color: "#94a3b8",
        fontSize: 14,
      }),
      indicatorsContainer: (base) => ({
        ...base,
        color: "#64748b",
      }),
      dropdownIndicator: (base) => ({
        ...base,
        color: "#64748b",
        padding: 6,
        "&:hover": {
          color: "#475569",
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
      option: (base, state) => ({
        ...base,
        backgroundColor: state.isSelected ? "var(--color-brand-100)" : state.isFocused ? "#f8fafc" : "#fff",
        color: state.isSelected ? "var(--color-brand-700)" : "#1e293b",
        fontSize: 14,
        padding: "8px 12px",
      }),
      menu: (base) => ({
        ...base,
        borderRadius: 10,
        overflow: "hidden",
        zIndex: 100000,
      }),
      menuPortal: (base) => ({
        ...base,
        zIndex: 100000,
      }),
      noOptionsMessage: (base) => ({
        ...base,
        color: "#64748b",
        fontSize: 13,
      }),
    }),
    []
  );
  const paginationItems = useMemo(
    () => buildPaginationItems(currentPage, totalPages),
    [currentPage, totalPages]
  );
  const visibleFrom = totalCount > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const visibleTo = totalCount > 0 ? Math.min(currentPage * PAGE_SIZE, totalCount) : 0;
  const visibleRangeLabel =
    totalCount > 0
      ? `Отображение ${visibleFrom} - ${visibleTo} из ${totalCount}`
      : "Нет данных";
  const showStickyPagination = !isPageLoading && !isError && totalCount > 0;

  const closeEditModal = () => {
    if (isMutatingRecord) return;
    setEditingRecord(null);
    setEditDraft(getDefaultEditDraft());
    setEditError("");
  };

  const closeCreateModal = () => {
    if (isMutatingRecord) return;
    setIsCreateModalOpen(false);
    setCreateError("");
    setCreateDraft(getDefaultCreateDraft(monthRange.from));
  };

  const closeDeleteModal = () => {
    if (isMutatingRecord) return;
    setRecordToDelete(null);
  };

  const openEditModal = (record: CompensationRecord) => {
    setEditingRecord(record);
    setEditDraft({
      accrualDate: record.date || toIsoDate(new Date()),
      amount: String(record.amount || ""),
      description: record.description || "",
      compensationTypeId: record.compensationTypeId || "",
      operationType: record.operationType,
    });
    setEditError("");
  };

  const openCreateModal = () => {
    setCreateError("");
    setCreateDraft(getDefaultCreateDraft(monthRange.from));
    setIsCreateModalOpen(true);
  };

  useEffect(() => {
    if (!editDraft.compensationTypeId) return;
    const hasType = filteredCompensationTypeOptions.some(
      (item) => item.guid === editDraft.compensationTypeId
    );
    if (!hasType) {
      setEditDraft((prev) => ({
        ...prev,
        compensationTypeId: "",
      }));
    }
  }, [editDraft.compensationTypeId, filteredCompensationTypeOptions]);

  const handleSaveEdit = async () => {
    if (!editingRecord) return;

    if (!editDraft.accrualDate) {
      setEditError("Укажите дату начисления.");
      return;
    }

    const parsedAmount = Number(editDraft.amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setEditError("Укажите корректную сумму (0 или больше).");
      return;
    }

    if (!editDraft.compensationTypeId) {
      setEditError("Выберите тип компенсации.");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        guid: editingRecord.guid,
        user_base_id: editingRecord.employeeGuid || null,
        companies_id: companyGuid || COMPANY_ID,
        date: editDraft.accrualDate,
        amount: parsedAmount,
        description: editDraft.description.trim() || null,
        compensation_types_id: editDraft.compensationTypeId,
        operation_type: [editDraft.operationType],
      });

      toast.success("Запись обновлена.");
      closeEditModal();
      await refetch();
    } catch (error) {
      console.error("Finance salary update error:", error);
      setEditError("Не удалось обновить запись.");
    }
  };

  const handleDeleteRecord = async () => {
    if (!recordToDelete) return;
    try {
      await deleteMutation.mutateAsync(recordToDelete.guid);
      toast.success("Запись удалена.");
      closeDeleteModal();
      await refetch();
    } catch (error) {
      console.error("Finance salary delete error:", error);
      toast.error(getErrorMessage(error, "Не удалось удалить запись."));
    }
  };

  const handleCreateMultiple = async () => {
    if (!createDraft.employeeGuid) {
      setCreateError("Выберите сотрудника.");
      return;
    }

    if (!createDraft.accrualDate) {
      setCreateError("Укажите дату начисления.");
      return;
    }

    const rowsToCreate = createCompensationTypeItems
      .map((typeItem) => {
        const rawValue = (createDraft.amountsByType[typeItem.guid] || "").trim();
        if (!rawValue) return null;
        const parsedAmount = Number(rawValue);
        if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
          throw new Error(`Некорректная сумма для "${typeItem.title}".`);
        }
        return {
          amount: parsedAmount,
          compensationTypeId: typeItem.guid,
          operationType: typeItem.operationType,
        };
      })
      .filter((item): item is { amount: number; compensationTypeId: string; operationType: OperationType } =>
        Boolean(item)
      );

    if (rowsToCreate.length === 0) {
      setCreateError("Укажите сумму хотя бы для одной операции.");
      return;
    }

    try {
      setCreateError("");
      await Promise.all(
        rowsToCreate.map((row) =>
          createMutation.mutateAsync({
            user_base_id: createDraft.employeeGuid,
            companies_id: companyGuid || COMPANY_ID,
            date: createDraft.accrualDate,
            amount: row.amount,
            description: createDraft.description.trim() || null,
            compensation_types_id: row.compensationTypeId,
            operation_type: [row.operationType],
          })
        )
      );

      toast.success(`Добавлено ${rowsToCreate.length} операций.`);
      closeCreateModal();
      setCurrentPage(1);
      await refetch();
    } catch (error) {
      console.error("Finance salary create multiple error:", error);
      setCreateError(getErrorMessage(error, "Не удалось добавить операции."));
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      setIsDownloadingTemplate(true);

      const response = await reportsService.getSalaryExcelTemplate({
        month: monthKey,
        ...(companyGuid ? { companies_id: companyGuid } : {}),
      });

      const payload = response.result;
      if (!payload.file_base64) {
        throw new Error("Шаблон не содержит файла.");
      }

      const blob = base64ToBlob(payload.file_base64, payload.mime_type);
      const fileName = payload.file_name || `salary-template-${monthKey}.xlsx`;
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Шаблон Excel скачан.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось скачать шаблон Excel."));
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleOpenUpload = () => {
    if (isImportingExcel) return;
    excelInputRef.current?.click();
  };

  const handleUploadExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    const fileName = file.name.toLowerCase();
    const isExcel =
      fileName.endsWith(".xlsx") ||
      fileName.endsWith(".xlsm") ||
      fileName.endsWith(".xls");

    if (!isExcel) {
      toast.error("Загрузите файл Excel в формате .xlsx, .xlsm или .xls.");
      return;
    }

    try {
      setIsImportingExcel(true);
      const fileBase64 = await readFileAsBase64(file);

      const response = await reportsService.importSalaryExcel({
        month: monthKey,
        file_base64: fileBase64,
        ...(companyGuid ? { companies_id: companyGuid } : {}),
      });

      const insertedCount = Number(response.result?.inserted_count || 0);
      if (insertedCount > 0) {
        toast.success(`Импорт завершен: добавлено ${insertedCount} строк.`);
      } else {
        toast.info("Импорт завершен: новых строк не добавлено.");
      }

      setCurrentPage(1);
      await refetch();
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось загрузить Excel."));
    } finally {
      setIsImportingExcel(false);
    }
  };

  return (
    <>
      <PageMeta title="Зарплата сотрудников | HRMS" description="Список начислений и удержаний сотрудников" />

      <div className="-mx-3 md:-mx-4 -mt-3 md:-mt-4">
        <div
          className="px-4 lg:px-6 py-2"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "10px",
            flexWrap: "wrap",
            backgroundColor: "#fff",
            border: "1px solid #e2e8f0",
            borderTop: "none",
          }}
        >
          <div className="flex items-center gap-2 ml-auto">
            <ExpandableSearchInput
              value={searchValue}
              onChange={setSearchValue}
              inputId="salary-search"
              placeholder="Поиск..."
              expandedWidth={320}
              collapsedSize={40}
              brandColor={companyStore.mainColor}
            />

            <button
              type="button"
              onClick={() => setIsFiltersOpen((open) => !open)}
              aria-label={`Фильтр${activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}`}
              title={`Фильтр${activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ""}`}
              className={`relative inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                isFilterButtonActive
                  ? "border-brand-200 bg-brand-50 text-brand-500"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal size={16} />
              {activeFiltersCount > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white">
                  {activeFiltersCount}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-500 px-3 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              <Plus size={16} />
              Добавить
            </button>

            <button
              ref={templateMenuAnchorRef}
              type="button"
              className={`dropdown-toggle inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 ${isTemplateMenuOpen ? "border-slate-300 bg-slate-50" : ""}`}
              onClick={() => setIsTemplateMenuOpen((open) => !open)}
              aria-label="Действия с шаблоном"
            >
              <MoreHorizontal size={16} />
            </button>
            <Dropdown
              isOpen={isTemplateMenuOpen}
              onClose={() => setIsTemplateMenuOpen(false)}
              usePortal
              anchorEl={templateMenuAnchorRef.current}
              className="w-[220px] p-1"
            >
              <DropdownItem
                onClick={() => {
                  if (isDownloadingTemplate || isImportingExcel) return;
                  void handleDownloadTemplate();
                }}
                onItemClick={() => setIsTemplateMenuOpen(false)}
                className={`flex items-center gap-2 rounded-lg ${isDownloadingTemplate ? "opacity-60" : ""}`}
              >
                <Download size={16} />
                {isDownloadingTemplate ? "Скачивание..." : "Скачать шаблон"}
              </DropdownItem>
              <DropdownItem
                onClick={() => {
                  if (isImportingExcel || isDownloadingTemplate) return;
                  handleOpenUpload();
                }}
                onItemClick={() => setIsTemplateMenuOpen(false)}
                className={`flex items-center gap-2 rounded-lg ${isImportingExcel ? "opacity-60" : ""}`}
              >
                <Upload size={16} />
                {isImportingExcel ? "Загрузка..." : "Загрузить Excel"}
              </DropdownItem>
            </Dropdown>

            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xlsm,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              onChange={(event) => {
                void handleUploadExcel(event);
              }}
            />
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
            <div style={{ minWidth: "180px", maxWidth: "260px", flex: "0 1 260px" }}>
              <EmployeeInfiniteSelect
                value={employeeFilter}
                onChange={(value) => setEmployeeFilter(value)}
                fallbackLabel={
                  employeeFilter ? knownEmployeeNameMap.get(employeeFilter) || undefined : undefined
                }
                placeholder="Сотрудник"
                styles={filterSelectStyles as StylesConfig<FilterOption, false>}
                menuPortalTarget={selectPortalTarget || undefined}
              />
            </div>

            <div style={{ minWidth: "170px", maxWidth: "230px", flex: "0 1 230px" }}>
              <Select
                inputId="salary-filter-operation"
                value={operationFilterOptions.find((option) => option.value === operationFilter) || null}
                onChange={(option: any) => setOperationFilter(option?.value || "")}
                options={operationFilterOptions}
                placeholder="Операция"
                isSearchable
                isClearable
                styles={filterSelectStyles}
                menuPortalTarget={selectPortalTarget}
                menuPosition="fixed"
                noOptionsMessage={() => "Ничего не найдено"}
              />
            </div>

            <div style={{ minWidth: "200px", maxWidth: "260px", flex: "0 1 260px" }}>
              <Select
                inputId="salary-filter-compensation-type"
                value={
                  compensationTypeFilterOptions.find((option) => option.value === compensationTypeFilter) || null
                }
                onChange={(option: any) => setCompensationTypeFilter(option?.value || "")}
                options={compensationTypeFilterOptions}
                placeholder="Тип компенсации"
                isSearchable
                isClearable
                styles={filterSelectStyles}
                menuPortalTarget={selectPortalTarget}
                menuPosition="fixed"
                noOptionsMessage={() => "Ничего не найдено"}
              />
            </div>

            {activeFiltersCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setEmployeeFilter("");
                  setOperationFilter("");
                  setCompensationTypeFilter("");
                }}
                className="ml-auto inline-flex h-10 items-center rounded-xl border border-brand-200 bg-brand-50 px-3 text-sm font-medium text-brand-500 transition hover:bg-brand-100"
              >
                Сбросить
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="px-4 lg:px-6 py-5" style={showStickyPagination ? { paddingBottom: "92px" } : undefined}>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-end border-b border-slate-100 px-4 py-3">
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
                  onClick={() =>
                    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                  }
                  className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-transparent text-slate-600 transition hover:bg-white hover:border-slate-200"
                  aria-label="Предыдущий месяц"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="min-w-[170px] px-3 text-center text-[13px] font-semibold text-slate-700">
                  {monthLabel}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                  }
                  className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-transparent text-slate-600 transition hover:bg-white hover:border-slate-200"
                  aria-label="Следующий месяц"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div className="px-4 py-4">
              {isPageLoading ? (
                <div className="py-8 flex items-center justify-center">
                  <div className="w-7 h-7 rounded-full border-2 border-slate-200 animate-spin border-t-slate-500" />
                </div>
              ) : isError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-[13px] text-rose-600">
                  Не удалось загрузить записи по зарплате.
                  <button
                    type="button"
                    onClick={() => {
                      void refetch();
                    }}
                    className="ml-2 inline-flex h-8 items-center rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white transition hover:bg-rose-700"
                  >
                    Повторить
                  </button>
                </div>
              ) : records.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
                  <p className="m-0 text-[13px] text-slate-500">
                    Записи не найдены
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="py-2 pr-4 text-[12px] font-semibold text-slate-500">Сотрудник</th>
                        <th className="py-2 pr-4 text-[12px] font-semibold text-slate-500">Дата начисления</th>
                        <th className="py-2 pr-4 text-[12px] font-semibold text-slate-500">Тип компенсации</th>
                        <th className="py-2 pr-4 text-[12px] font-semibold text-slate-500">Операция</th>
                        <th className="py-2 pr-4 text-[12px] font-semibold text-slate-500">Сумма</th>
                        <th className="py-2 pr-4 text-[12px] font-semibold text-slate-500">Описание</th>
                        <th className="py-2 pr-4 text-[12px] font-semibold text-slate-500">Создано</th>
                        <th className="py-2 text-right text-[12px] font-semibold text-slate-500">Действия</th>
                      </tr>
                    </thead>
                  <tbody>
                    {records.map((record) => (
                      <tr key={record.guid} className="border-b border-slate-100 align-top">
                        <td className="py-3 pr-4 text-[13px] text-slate-800">
                          {record.employeeGuid ? (
                            <Link
                              to={`/employees/${record.employeeGuid}`}
                              className="font-medium text-slate-800 transition hover:text-brand-500"
                            >
                              {record.employeeName}
                            </Link>
                          ) : (
                            record.employeeName
                          )}
                        </td>
                        <td className="py-3 pr-4 text-[13px] text-slate-800">
                          {formatDate(record.date)}
                        </td>
                        <td className="py-3 pr-4 text-[13px] text-slate-700">
                          {record.compensationTypeTitle || "—"}
                        </td>
                        <td className="py-3 pr-4 text-[13px] text-slate-700">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[12px] font-semibold ${OPERATION_TAG_STYLES[record.operationType]}`}
                          >
                            {OPERATION_LABELS[record.operationType]}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-[13px] font-semibold text-slate-900">
                          {formatAmount(record.amount)}
                        </td>
                        <td className="py-3 pr-4 text-[13px] text-slate-700">
                          {record.description || "—"}
                        </td>
                        <td className="py-3 pr-4 text-[13px] text-slate-700">
                          {formatDateTime(record.createdAt)}
                        </td>
                        <td className="py-3 text-right">
                          {autoPenaltyTypeIds.has(record.compensationTypeId) || record.description.startsWith("Автоматический штраф:") ? (
                            <span className="text-xs text-slate-500">Автоматически</span>
                          ) : <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(record)}
                              disabled={isMutatingRecord}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label="Редактировать запись"
                              title="Редактировать"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setRecordToDelete(record)}
                              disabled={isMutatingRecord}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label="Удалить запись"
                              title="Удалить"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </div>
        </div>
      </div>

      {showStickyPagination ? (
        <EmployeesPaginationFooter
          visibleRangeLabel={visibleRangeLabel}
          paginationItems={paginationItems}
          currentPage={currentPage}
          totalPages={totalPages}
          brandColor={companyStore.mainColor}
          onPrevious={() => setCurrentPage((page) => Math.max(1, page - 1))}
          onNext={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
          onPageChange={(page) => setCurrentPage(page)}
        />
      ) : null}

      <Modal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        className="mx-4 w-full max-w-3xl p-5 sm:p-6"
        showCloseButton={false}
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Добавить операции</h3>
              <p className="mt-1 text-sm text-slate-500">
                Выберите сотрудника и заполните суммы только для нужных операций.
              </p>
            </div>
            <button
              type="button"
              onClick={closeCreateModal}
              disabled={isMutatingRecord}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500">Сотрудник</span>
              <EmployeeInfiniteSelect
                value={createDraft.employeeGuid}
                onChange={(value) =>
                  setCreateDraft((prev) => ({
                    ...prev,
                    employeeGuid: value,
                    employeeName: value ? knownEmployeeNameMap.get(value) || "" : "",
                  }))
                }
                fallbackLabel={
                  createDraft.employeeName ||
                  (createDraft.employeeGuid ? knownEmployeeNameMap.get(createDraft.employeeGuid) : "") ||
                  undefined
                }
                placeholder="Выберите сотрудника"
                styles={createEmployeeSelectStyles}
                menuPortalTarget={selectPortalTarget || undefined}
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500">Дата начисления</span>
              <DateInput
                value={createDraft.accrualDate}
                onChange={(next) => setCreateDraft((prev) => ({ ...prev, accrualDate: next }))}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 pr-9 text-sm text-slate-700 outline-none transition focus:border-slate-300"
              />
            </label>
          </div>

          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-500">Описание (опционально)</span>
            <input
              type="text"
              value={createDraft.description}
              onChange={(event) =>
                setCreateDraft((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-slate-300"
              placeholder="Общее описание для созданных операций"
            />
          </label>

          <div className="rounded-xl border border-slate-200">
            <div className="max-h-[320px] overflow-y-auto p-3">
              <div className="space-y-2">
                {createCompensationTypeItems.map((typeItem) => (
                  <div
                    key={typeItem.guid}
                    className="grid grid-cols-1 items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/50 p-2 sm:grid-cols-[minmax(0,1fr)_180px]"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${OPERATION_TAG_STYLES[typeItem.operationType]}`}
                      >
                        {OPERATION_LABELS[typeItem.operationType]}
                      </span>
                      <span className="text-sm font-medium text-slate-700">{typeItem.title}</span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={createDraft.amountsByType[typeItem.guid] || ""}
                      onChange={(event) =>
                        setCreateDraft((prev) => ({
                          ...prev,
                          amountsByType: {
                            ...prev.amountsByType,
                            [typeItem.guid]: event.target.value,
                          },
                        }))
                      }
                      className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {createError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {createError}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeCreateModal}
              disabled={isMutatingRecord}
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => {
                void handleCreateMultiple();
              }}
              disabled={isMutatingRecord}
              className="inline-flex h-10 items-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createMutation.isLoading ? "Сохранение..." : "Добавить"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(editingRecord)}
        onClose={closeEditModal}
        className="mx-4 w-full max-w-xl p-5 sm:p-6"
        showCloseButton={false}
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Редактировать запись</h3>
              <p className="mt-1 text-sm text-slate-500">{editingRecord?.employeeName || "Сотрудник"}</p>
            </div>
            <button
              type="button"
              onClick={closeEditModal}
              disabled={isMutatingRecord}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500">Дата начисления</span>
              <DateInput
                value={editDraft.accrualDate}
                onChange={(next) => setEditDraft((prev) => ({ ...prev, accrualDate: next }))}
                className="h-10 w-full rounded-xl border border-slate-200 px-3 pr-9 text-sm text-slate-700 outline-none transition focus:border-slate-300"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500">Сумма</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={editDraft.amount}
                onChange={(event) =>
                  setEditDraft((prev) => ({
                    ...prev,
                    amount: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                placeholder="0"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500">Операция</span>
              <select
                value={editDraft.operationType}
                onChange={(event) =>
                  setEditDraft((prev) => ({
                    ...prev,
                    operationType: event.target.value === "deduction" ? "deduction" : "income",
                    compensationTypeId: "",
                  }))
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-300"
              >
                <option value="income">Начисление</option>
                <option value="deduction">Удержание</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500">Тип компенсации</span>
              <select
                value={editDraft.compensationTypeId}
                onChange={(event) =>
                  setEditDraft((prev) => ({
                    ...prev,
                    compensationTypeId: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-300"
              >
                <option value="">Выберите тип</option>
                {filteredCompensationTypeOptions.map((item) => (
                  <option key={item.guid} value={item.guid}>
                    {item.title || "Без названия"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-500">Описание</span>
            <textarea
              value={editDraft.description}
              onChange={(event) =>
                setEditDraft((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              rows={3}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-slate-300"
              placeholder="Описание..."
            />
          </label>

          {editError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {editError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeEditModal}
              disabled={isMutatingRecord}
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => {
                void handleSaveEdit();
              }}
              disabled={isMutatingRecord}
              className="inline-flex h-10 items-center rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isMutatingRecord ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(recordToDelete)}
        onClose={closeDeleteModal}
        className="mx-4 w-full max-w-md p-5 sm:p-6"
        showCloseButton={false}
      >
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-900">Удалить запись?</h3>
            <p className="text-sm text-slate-500">
              Это действие нельзя отменить.
            </p>
            {recordToDelete && (
              <p className="text-sm font-medium text-slate-700">
                {recordToDelete.employeeName} • {recordToDelete.compensationTypeTitle || "Компенсация"} •{" "}
                {formatAmount(recordToDelete.amount)}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeDeleteModal}
              disabled={isMutatingRecord}
              className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => {
                void handleDeleteRecord();
              }}
              disabled={isMutatingRecord}
              className="inline-flex h-10 items-center rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isMutatingRecord ? "Удаление..." : "Удалить"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default FinanceSalaryPage;
