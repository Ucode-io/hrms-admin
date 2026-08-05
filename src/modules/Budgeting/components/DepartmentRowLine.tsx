import { ChevronRight, X } from "lucide-react";
import AmountGroup from "./AmountGroup";
import {
  META_CELL,
  STATUS_CELL,
  STICKY_TITLE_CLASS,
  TITLE_CELL,
  type BudgetPeriod,
  type VisibleColumns,
  departmentYear,
} from "../constants";
import type { BudgetDepartment, BudgetMonth } from "../types";

interface DepartmentRowLineProps {
  department: BudgetDepartment;
  columns: VisibleColumns;
  periods: BudgetPeriod[];
  currentPeriod: number | null;
  valueOf: (period: BudgetPeriod) => BudgetMonth;
  showYearGroup: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onDelete: () => void;
}

/**
 * Заголовок отдела: суммы по нему считаются из строк и не правятся вручную.
 *
 * Свести бюджет можно только снизу вверх — иначе итог отдела и сумма его строк
 * разъезжаются, и непонятно, какой цифре верить.
 */
export default function DepartmentRowLine({
  department,
  columns,
  periods,
  currentPeriod,
  showYearGroup,
  valueOf,
  collapsed,
  onToggle,
  onDelete,
}: DepartmentRowLineProps) {
  const year = departmentYear(department);

  return (
    // Полоса отдела — как группа в KPI: заметный фон и цветная засечка слева.
    // В таблице на полсотни колонок граница между отделами должна ловиться
    // взглядом без чтения названий.
    <div className="group/dept flex items-stretch border-y border-slate-200 bg-slate-100/70">
      <div
        className={`flex items-center gap-1 py-2.5 pl-2 pr-3 ${TITLE_CELL} ${STICKY_TITLE_CLASS} bg-slate-100/70`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? `Развернуть ${department.name}` : `Свернуть ${department.name}`}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-white hover:text-slate-700"
        >
          <ChevronRight
            size={15}
            className={`transition-transform ${collapsed ? "" : "rotate-90"}`}
          />
        </button>

        <span className="h-4 w-1 shrink-0 rounded-full bg-brand-500" />

        {/* Название отдела не редактируется: отдел — из справочника компании,
            и правят его в настройках, а не в бюджете. */}
        <p className="min-w-0 flex-1 truncate px-1.5 text-[13.5px] font-bold text-slate-900">
          {department.name}
        </p>

        <span className="shrink-0 rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">
          {department.rows.length} стр.
        </span>

        {/* «Убрать», а не «удалить»: из бюджета уходят строки отдела, сам отдел
            остаётся в справочнике компании. */}
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Убрать отдел «${department.name}» из бюджета`}
          title="Убрать из бюджета"
          className="shrink-0 rounded-lg p-1.5 text-slate-400 opacity-0 transition group-hover/dept:opacity-100 hover:bg-error-50 hover:text-error-500"
        >
          <X size={14} />
        </button>
      </div>

      <div className={STATUS_CELL} />
      <div className={META_CELL} />
      <div className={META_CELL} />

      {periods.map((period, index) => (
        <AmountGroup
          key={period.key}
          month={valueOf(period)}
          columns={columns}
          label={`${period.label}, ${department.name}`}
          className={`border-l border-slate-200 ${
            index === currentPeriod ? "bg-slate-200/50" : ""
          }`}
          strong
        />
      ))}

      {showYearGroup && (
        <AmountGroup
          month={year}
          columns={columns}
          label={`год, ${department.name}`}
          className="border-l border-slate-200 bg-brand-50/40"
          strong
        />
      )}

      <div className="w-[44px] min-w-[44px]" />
    </div>
  );
}
