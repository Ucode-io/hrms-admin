import { Trash2 } from "lucide-react";
import EditableText from "./EditableText";
import AmountGroup from "./AmountGroup";
import PositionPicker from "./PositionPicker";
import StatusPicker from "./StatusPicker";
import {
  META_CELL,
  STATUS_CELL,
  STICKY_TITLE_CLASS,
  TITLE_CELL,
  type BudgetPeriod,
  type VisibleColumns,
  initialsOf,
  parsePercent,
  positionTitle,
  rowFactTotal,
  rowPlanTotal,
} from "../constants";
import type { BudgetMonth, BudgetPosition, BudgetRow } from "../types";

interface BudgetRowLineProps {
  row: BudgetRow;
  positions: BudgetPosition[];
  columns: VisibleColumns;
  periods: BudgetPeriod[];
  currentPeriod: number | null;
  /** Сумму периода считает страница: в годовом виде она лежит в другом году. */
  valueOf: (period: BudgetPeriod) => BudgetMonth;
  /** Год справа прячется в годовом виде — он там совпал бы с единственным периодом. */
  showYearGroup: boolean;
  onChange: (patch: Partial<BudgetRow>) => void;
  onMonthChange: (index: number, field: "plan" | "fact", value: number) => void;
  onDelete: () => void;
}

/**
 * Строка бюджета: сотрудник или вакансия.
 *
 * Различий ровно два: имя и должность. У сотрудника они из его профиля и здесь
 * не правятся — бюджет не место, где меняют кадровые данные. У вакансии имя —
 * произвольная пометка («Найм во втором полугодии»), а должность выбирается из
 * того же справочника, что и у людей.
 */
export default function BudgetRowLine({ row,
  positions,
  columns,
  periods,
  currentPeriod,
  showYearGroup,
  valueOf,
  onChange,
  onMonthChange,
  onDelete,
}: BudgetRowLineProps) {
  const isVacancy = row.kind === "vacancy";
  const year = { plan: rowPlanTotal(row), fact: rowFactTotal(row) };
  const title = positionTitle(positions, row.positionId);

  return (
    <div className="group/row flex items-stretch border-t border-gray-100 bg-white hover:bg-slate-50">
      <div
        className={`flex items-center gap-2.5 py-2 pl-2 pr-3 ${TITLE_CELL} ${STICKY_TITLE_CLASS} bg-white group-hover/row:bg-slate-50`}
      >
        <span
          className={`ml-5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
            isVacancy
              ? "border border-dashed border-gray-300 text-gray-400"
              : "bg-brand-50 text-brand-600"
          }`}
        >
          {isVacancy ? "+" : initialsOf(row.name)}
        </span>

        <div className="min-w-0 flex-1">
          {isVacancy ? (
            <EditableText
              value={row.name}
              placeholder="Название вакансии"
              ariaLabel="Название вакансии"
              className="text-[13px] font-medium text-gray-800"
              onCommit={(value) => onChange({ name: value || "Вакансия" })}
            />
          ) : (
            <p className="truncate px-2 text-[13px] font-medium text-gray-800">{row.name}</p>
          )}

          {isVacancy ? (
            <PositionPicker
              value={row.positionId}
              positions={positions}
              onChange={(positionId) => onChange({ positionId })}
            />
          ) : (
            // Должность сотрудника — из его профиля: правят её в карточке
            // сотрудника, а не в бюджете.
            <p className="truncate px-2 text-[11px] text-gray-400" title={title}>
              {title || "Должность не указана"}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onDelete}
          aria-label={`Удалить строку «${row.name}»`}
          className="shrink-0 rounded-lg p-1.5 text-gray-300 opacity-0 transition group-hover/row:opacity-100 hover:bg-error-50 hover:text-error-500"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className={`${STATUS_CELL} flex items-center justify-center px-2`}>
        <StatusPicker value={row.status} onChange={(status) => onChange({ status })} />
      </div>

      <div className={`${META_CELL} flex items-center justify-center px-1.5`}>
        <EditableText
          value={String(row.taxPercent)}
          placeholder="0"
          ariaLabel="Налог, %"
          align="center"
          className="text-[12px] text-gray-600"
          onCommit={(value) => onChange({ taxPercent: parsePercent(value) })}
        />
      </div>

      <div className={`${META_CELL} flex items-center justify-center px-1.5`}>
        <EditableText
          value={String(row.bonusPercent)}
          placeholder="0"
          ariaLabel="Бонус, %"
          align="center"
          className="text-[12px] text-gray-600"
          onCommit={(value) => onChange({ bonusPercent: parsePercent(value) })}
        />
      </div>

      {periods.map((period, index) => {
        // Правится только месяц: в квартале и году непонятно, в какой из
        // входящих месяцев записать введённую сумму.
        const single = period.months?.length === 1;

        return (
          <AmountGroup
            key={period.key}
            month={valueOf(period)}
            columns={columns}
            editable={single}
            label={`${period.label}, ${row.name}`}
            onChange={
              single && period.months
                ? (field, value) => onMonthChange(period.months![0], field, value)
                : undefined
            }
            className={`border-l border-gray-100 ${
              index === currentPeriod ? "bg-slate-50/70" : ""
            }`}
          />
        );
      })}

      {showYearGroup && (
        <AmountGroup
          month={year}
          columns={columns}
          label={`год, ${row.name}`}
          className="border-l border-gray-200 bg-brand-50/20"
          strong
        />
      )}

      <div className="w-[44px] min-w-[44px]" />
    </div>
  );
}
