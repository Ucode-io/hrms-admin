import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, HandCoins, Search } from "lucide-react";
import PageMeta from "../../../components/common/PageMeta";
import Pagination from "../../../components/pagination";
import {
  type EmployeeCompensation,
  useEmployeeSalaryCompensationsQuery,
} from "../../../api/services/employeeCompensation.service";

type OperationType = "income" | "deduction";

type CompensationRecord = {
  guid: string;
  employeeGuid: string;
  employeeName: string;
  date: string;
  amount: number;
  description: string;
  createdAt: string;
  compensationTypeTitle: string;
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
const PAGE_SIZE = 20;

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
  const lastKnownTotalCountRef = useRef(0);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
      setCurrentPage(1);
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [searchValue]);

  const { data, isLoading, isFetching, isError, refetch } = useEmployeeSalaryCompensationsQuery({
    limit: PAGE_SIZE,
    offset: (currentPage - 1) * PAGE_SIZE,
    search: debouncedSearch,
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
    </>
  );
}

export default FinanceSalaryPage;
