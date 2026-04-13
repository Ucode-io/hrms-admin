import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  HandCoins,
  Pencil,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../components/common/PageMeta";
import Pagination from "../../../components/pagination";
import { Modal } from "../../../components/ui/modal";
import reportsService from "../../../api/services/reports.service";
import companyStore from "../../../store/company.store";
import {
  useDeleteEmployeeCompensation,
  type EmployeeCompensation,
  useEmployeeSalaryCompensationsQuery,
  useUpdateEmployeeCompensation,
} from "../../../api/services/employeeCompensation.service";
import { COMPANY_ID, useSettingsDirectoryQuery } from "../../../api/services/settingsDirectory.service";

type OperationType = "income" | "deduction";

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
  const [currentPage, setCurrentPage] = useState(1);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isImportingExcel, setIsImportingExcel] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CompensationRecord | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<CompensationRecord | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>(getDefaultEditDraft());
  const [editError, setEditError] = useState("");
  const lastKnownTotalCountRef = useRef(0);
  const excelInputRef = useRef<HTMLInputElement | null>(null);
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

  const monthRange = useMemo(() => getMonthRange(selectedMonth), [selectedMonth]);
  const monthKey = useMemo(() => toMonthKey(selectedMonth), [selectedMonth]);
  const monthLabel = useMemo(() => formatMonthLabel(selectedMonth), [selectedMonth]);

  const { data, isLoading, isFetching, isError, refetch } = useEmployeeSalaryCompensationsQuery({
    limit: PAGE_SIZE,
    offset: (currentPage - 1) * PAGE_SIZE,
    search: debouncedSearch,
    dateFrom: monthRange.from,
    dateTo: monthRange.to,
  });

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
  const isMutatingRecord = updateMutation.isLoading || deleteMutation.isLoading;
  const companyGuid =
    companyStore.company?.guid && typeof companyStore.company.guid === "string"
      ? companyStore.company.guid
      : "";
  const compensationTypeOptions = useMemo(
    () => (compensationTypesData?.response || []) as CompensationTypeItem[],
    [compensationTypesData?.response]
  );
  const filteredCompensationTypeOptions = useMemo(
    () =>
      compensationTypeOptions.filter(
        (item) => resolveOperationType(item.operation_type) === editDraft.operationType
      ),
    [compensationTypeOptions, editDraft.operationType]
  );

  const closeEditModal = () => {
    if (isMutatingRecord) return;
    setEditingRecord(null);
    setEditDraft(getDefaultEditDraft());
    setEditError("");
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

      <div className="space-y-4">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-6 py-4">
            <Link
              to="/dashboard"
              className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-slate-700"
            >
              <ArrowLeft size={14} />
              Назад
            </Link>

            <div className="flex items-center gap-2">
              <HandCoins className="h-4 w-4 text-slate-500" />
              <h1 className="m-0 text-[20px] font-semibold text-slate-900">Зарплата сотрудников</h1>
            </div>
            <p className="mt-1 text-[12px] text-slate-500">
              Таблица начислений и удержаний по всем сотрудникам
            </p>
          </div>

          <div className="border-b border-slate-100 px-6 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="relative block w-full md:max-w-sm">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Поиск..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-slate-300"
                />
              </label>

              <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                  }
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100"
                  aria-label="Предыдущий месяц"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="min-w-[150px] px-2 text-center text-sm font-semibold text-gray-700">
                  {monthLabel}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                  }
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 transition hover:bg-gray-100"
                  aria-label="Следующий месяц"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void handleDownloadTemplate();
                  }}
                  disabled={isDownloadingTemplate || isImportingExcel}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download size={16} />
                  {isDownloadingTemplate ? "Скачивание..." : "Скачать шаблон"}
                </button>
                <button
                  type="button"
                  onClick={handleOpenUpload}
                  disabled={isImportingExcel || isDownloadingTemplate}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-500 px-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Upload size={16} />
                  {isImportingExcel ? "Загрузка..." : "Загрузить Excel"}
                </button>
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
          </div>

          <div className="px-6 py-5">
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
                  Записей о зарплате пока нет
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
                          <div className="inline-flex items-center gap-1">
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
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!isPageLoading && !isError && totalCount > 0 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              limit={PAGE_SIZE}
              onPageChange={setCurrentPage}
            />
          )}
        </section>
      </div>

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
              <input
                type="date"
                value={editDraft.accrualDate}
                onChange={(event) =>
                  setEditDraft((prev) => ({
                    ...prev,
                    accrualDate: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none transition focus:border-slate-300"
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
