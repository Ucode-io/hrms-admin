import {
  DIFF_CELL,
  MONEY_CELL,
  type VisibleColumns,
  diffClassName,
  diffOf,
  formatPercent,
  formatTotal,
} from "../constants";
import MoneyCell from "./MoneyCell";
import type { BudgetMonth } from "../types";

interface AmountGroupProps {
  month: BudgetMonth;
  columns: VisibleColumns;
  /** Итог отдела и года не правится — он считается из строк. */
  editable?: boolean;
  label: string;
  onChange?: (field: "plan" | "fact", value: number) => void;
  className?: string;
  strong?: boolean;
}

/**
 * Одна группа колонок месяца: план и то из «факт / разница / %», что включено
 * переключателем.
 *
 * Общая и для строк, и для итогов: разница считается по одной формуле, и
 * разъехавшиеся правила округления в двух местах — верный способ получить
 * итог, который не сходится со слагаемыми.
 */
export default function AmountGroup({
  month,
  columns,
  editable = false,
  label,
  onChange,
  className = "",
  strong = false,
}: AmountGroupProps) {
  const { diff, percent } = diffOf(month);
  const valueClass = strong ? "font-semibold" : "";

  return (
    <div className={`flex items-center ${className}`}>
      <div className={`${MONEY_CELL} px-1`}>
        {editable && onChange ? (
          <MoneyCell
            value={month.plan}
            tone="plan"
            ariaLabel={`План, ${label}`}
            onCommit={(value) => onChange("plan", value)}
          />
        ) : (
          // Прозрачная рамка — как у редактируемой ячейки: без неё текст
          // нередактируемого значения стоял на пиксель правее.
          <p
            className={`border border-transparent px-1.5 text-right text-[12px] tabular-nums text-gray-700 ${valueClass}`}
          >
            {formatTotal(month.plan)}
          </p>
        )}
      </div>

      {columns.fact && (
        <div className={`${MONEY_CELL} px-1`}>
          {editable && onChange ? (
            <MoneyCell
              value={month.fact}
              tone="fact"
              ariaLabel={`Факт, ${label}`}
              onCommit={(value) => onChange("fact", value)}
            />
          ) : (
            <p
              className={`border border-transparent px-1.5 text-right text-[12px] tabular-nums text-brand-600 ${valueClass}`}
            >
              {formatTotal(month.fact)}
            </p>
          )}
        </div>
      )}

      {columns.diff && (
        <div className={`${DIFF_CELL} px-2.5`}>
          <p className={`border border-transparent text-right text-[12px] tabular-nums ${diffClassName(diff)}`}>
            {diff ? formatTotal(diff) : "—"}
          </p>
        </div>
      )}

      {columns.percent && (
        <div className={`${DIFF_CELL} px-2.5`}>
          <p className={`border border-transparent text-right text-[11.5px] tabular-nums ${diffClassName(diff)}`}>
            {formatPercent(percent)}
          </p>
        </div>
      )}
    </div>
  );
}
