import {
  DIFF_CELL,
  META_CELL,
  MONEY_CELL,
  STATUS_CELL,
  STICKY_TITLE_CLASS,
  TITLE_CELL,
  type BudgetPeriod,
  type VisibleColumns,
  groupWidthPx,
} from "../constants";

interface BudgetHeadProps {
  periods: BudgetPeriod[];
  columns: VisibleColumns;
  /** Индекс текущего периода, если открыт текущий год — иначе null. */
  currentPeriod: number | null;
  /** Колонка «Год» справа: в годовом виде она дублировала бы единственный период. */
  showYearGroup: boolean;
}

/**
 * Отступ подписи равен отступу значения в строке (`AmountGroup`): у ячейки
 * суммы он складывается из обёртки и самого значения, и подпись с меньшим
 * отступом висела правее цифр.
 */
const SUB_LABEL =
  "border border-transparent px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-gray-400";

/**
 * Двухэтажная шапка: месяц сверху, колонки месяца под ним.
 *
 * Верхний этаж — единственное место, где видно границу месяца: колонки внутри
 * него одинаковые, и без общего заголовка их не разделить взглядом. Когда
 * включён только план, нижний этаж всё равно нужен: иначе непонятно, план это
 * или факт.
 */
export default function BudgetHead({
  periods,
  columns,
  currentPeriod,
  showYearGroup,
}: BudgetHeadProps) {
  const groupStyle = { width: groupWidthPx(columns), minWidth: groupWidthPx(columns) };

  const subCells = (key: string) => (
    <div className="flex" key={key}>
      <div className={`${MONEY_CELL} ${SUB_LABEL} text-right`}>План</div>
      {columns.fact && <div className={`${MONEY_CELL} ${SUB_LABEL} text-right`}>Факт</div>}
      {columns.diff && <div className={`${DIFF_CELL} ${SUB_LABEL} text-right`}>Разница</div>}
      {columns.percent && <div className={`${DIFF_CELL} ${SUB_LABEL} text-right`}>%</div>}
    </div>
  );

  return (
    <div className="sticky top-0 z-30 bg-white">
      {/* Этаж месяцев */}
      <div className="flex items-stretch border-b border-gray-100">
        <div
          className={`flex items-end px-4 pb-1.5 pt-3 text-[11px] font-medium uppercase tracking-wide text-gray-400 ${TITLE_CELL} ${STICKY_TITLE_CLASS} bg-white`}
        >
          Отдел / строка
        </div>
        {[
          { label: "Статус", width: STATUS_CELL },
          { label: "Налог %", width: META_CELL },
          { label: "Бонус %", width: META_CELL },
        ].map((item) => (
          <div
            key={item.label}
            className={`${item.width} px-2 pb-1.5 pt-3 text-center text-[11px] font-medium uppercase tracking-wide text-gray-400`}
          >
            {item.label}
          </div>
        ))}

        {periods.map((period, index) => (
          <div
            key={period.key}
            style={groupStyle}
            className={`border-l border-gray-100 px-2 pb-1.5 pt-3 text-center text-[11px] font-semibold uppercase tracking-wide ${
              index === currentPeriod ? "bg-slate-50 text-brand-600" : "text-gray-500"
            }`}
          >
            {period.label}
          </div>
        ))}

        {showYearGroup && (
          <div
            style={groupStyle}
            className="border-l border-gray-200 bg-brand-50/40 px-2 pb-1.5 pt-3 text-center text-[11px] font-semibold uppercase tracking-wide text-brand-600"
          >
            Год
          </div>
        )}

        <div className="w-[44px] min-w-[44px]" />
      </div>

      {/* Этаж колонок месяца */}
      <div className="flex items-stretch border-b border-gray-200 bg-slate-50">
        <div className={`${TITLE_CELL} ${STICKY_TITLE_CLASS} bg-slate-50`} />
        <div className={STATUS_CELL} />
        <div className={META_CELL} />
        <div className={META_CELL} />
        {periods.map((period, index) => (
          <div
            key={period.key}
            className={`flex border-l border-gray-100 ${
              index === currentPeriod ? "bg-slate-100/70" : ""
            }`}
          >
            {subCells(period.key)}
          </div>
        ))}
        {showYearGroup && (
          <div className="flex border-l border-gray-200 bg-brand-50/40">{subCells("year")}</div>
        )}
        <div className="w-[44px] min-w-[44px]" />
      </div>
    </div>
  );
}
