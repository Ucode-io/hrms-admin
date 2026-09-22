// Сетка «сотрудники × даты».
//
// Строка «Открытые» идёт первой в каждой секции: незакрытая потребность должна
// стоять рядом с теми, кем её можно закрыть, а не отдельным списком в углу.
//
// Дня без смены не бывает: где смены нет, там выходной — и он нарисован, а не
// оставлен пустым. Именно так видно, кого забыли поставить.

import { Fragment } from "react";
import { ChevronDown, Plus, RefreshCw } from "lucide-react";
import {
  KIND_META,
  avatarColor,
  formatDayHeader,
  formatShiftTime,
  fromIsoDate,
  getInitials,
  isToday,
  shiftKind,
} from "../constants";
import type { Shift } from "../../../api/services/shift.service";
import type { CellKind, ItemBy, ShiftEmployee, ShiftGroup } from "../types";

interface GridViewProps {
  dates: string[];
  groups: ShiftGroup[];
  /** `${employeeId}|${iso}` → смена. Одна на пару — это гарантирует индекс в БД. */
  shiftByCell: Map<string, Shift>;
  isMonthScale: boolean;
  /** Строка секции: человек или свёрнутая в сводку должность. */
  itemBy: ItemBy;
  /** Нерабочие даты периода → подпись («Выходной» или название праздника). */
  offDayByDate: Map<string, string>;
  collapsedGroups: Set<string>;
  showGroupHeaders: boolean;
  autofillingId: string | null;
  onToggleGroup: (key: string) => void;
  onCellClick: (employeeId: string | null, date: string, shift: Shift | null) => void;
  onOpenShiftsClick: (date: string, shifts: Shift[]) => void;
  onAutofill: (employee: ShiftEmployee) => void;
  onBreakdownClick: (label: string, employees: ShiftEmployee[], date: string) => void;
}

const headCellClass =
  "sticky top-0 z-10 bg-gray-50 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400";

/** Подсветка нерабочей колонки. Пустая строка — обычный рабочий день. */
const offColumnClass = "bg-rose-50/70 dark:bg-rose-500/[0.07]";

const KIND_BAR_ORDER: CellKind[] = ["day", "night", "remote", "off"];

/** Строки-должности: люди секции, свёрнутые по должности из своей карточки. */
const positionRows = (employees: ShiftEmployee[]) => {
  const byPosition = new Map<string, ShiftEmployee[]>();
  employees.forEach((employee) => {
    const label = employee.position || "Без должности";
    const list = byPosition.get(label) ?? [];
    list.push(employee);
    byPosition.set(label, list);
  });
  return [...byPosition.entries()]
    .map(([label, list]) => ({ label, employees: list }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

export default function GridView({ dates,
  groups,
  shiftByCell,
  isMonthScale,
  itemBy,
  offDayByDate,
  collapsedGroups,
  showGroupHeaders,
  autofillingId,
  onToggleGroup,
  onCellClick,
  onOpenShiftsClick,
  onAutofill,
  onBreakdownClick,
}: GridViewProps) {
  const columnCount = dates.length + 1;

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-400 dark:border-gray-700 dark:text-gray-500">
        Нет сотрудников и смен по заданным фильтрам
      </div>
    );
  }

  /** Ячейка одного человека: смена или выходной. Кликается в обоих случаях. */
  const renderEmployeeCell = (employee: ShiftEmployee, iso: string) => {
    const shift = shiftByCell.get(`${employee.id}|${iso}`) ?? null;
    const kind: CellKind = shift ? shiftKind(shift) : "off";
    const meta = KIND_META[kind];
    const time = shift ? formatShiftTime(shift) : "";
    const dayOff = offDayByDate.get(iso);

    return (
      <td key={iso} className={`px-1 py-1 ${dayOff ? offColumnClass : ""}`}>
        <button
          type="button"
          onClick={() => onCellClick(employee.id, iso, shift)}
          title={`${employee.name} · ${formatDayHeader(iso)}${
            dayOff ? ` (${dayOff})` : ""
          } · ${meta.label}${time ? ` ${time}` : ""}${
            shift?.comment ? ` · ${shift.comment}` : ""
          }${shift ? "" : " · нажмите, чтобы поставить смену"}`}
          className={`min-h-[38px] w-full rounded-lg border px-1.5 py-1 text-center transition hover:brightness-95 ${
            shift ? "" : "border-dashed"
          }`}
          style={{ borderColor: meta.color, backgroundColor: meta.soft }}
        >
          {isMonthScale ? (
            <span
              className="mx-auto block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: meta.color }}
            />
          ) : (
            // Вид смены читается цветом — легенда над таблицей объясняет какой,
            // и дублировать её словом в каждой клетке незачем. Время важнее.
            <span className="block text-[11px] font-semibold" style={{ color: meta.color }}>
              {time || meta.label}
            </span>
          )}
        </button>
      </td>
    );
  };

  /** Ячейка строки-должности: сводка «работает / всего» и полоса по видам. */
  const renderAggregateCell = (
    label: string,
    members: ShiftEmployee[],
    iso: string
  ) => {
    const counts: Record<CellKind, number> = { day: 0, night: 0, remote: 0, off: 0 };
    members.forEach((employee) => {
      const shift = shiftByCell.get(`${employee.id}|${iso}`);
      counts[shift ? shiftKind(shift) : "off"] += 1;
    });
    const total = members.length;
    const working = total - counts.off;
    const dayOff = offDayByDate.get(iso);

    return (
      <td key={iso} className={`px-1 py-1 ${dayOff ? offColumnClass : ""}`}>
        <button
          type="button"
          onClick={() => onBreakdownClick(label, members, iso)}
          title={`${label} · ${formatDayHeader(iso)}${
            dayOff ? ` (${dayOff})` : ""
          } — работает ${working} из ${total}`}
          className="flex min-h-[38px] w-full flex-col items-center justify-center gap-1 rounded-lg bg-gray-50 px-1 py-1.5 transition hover:bg-gray-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
        >
          <span className="flex h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            {KIND_BAR_ORDER.map((kind) =>
              counts[kind] > 0 ? (
                <span
                  key={kind}
                  style={{
                    width: `${(counts[kind] / total) * 100}%`,
                    backgroundColor: KIND_META[kind].color,
                  }}
                />
              ) : null
            )}
          </span>
          {/* Полоса показывает состав, число — сколько людей работает. На месяце
              она единственная подпись в клетке, поэтому не прячется. */}
          <span
            className={`font-bold text-gray-700 dark:text-white/90 ${
              isMonthScale ? "text-[10px]" : "text-[11px]"
            }`}
          >
            {working}/{total}
          </span>
        </button>
      </td>
    );
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th
              className={`${headCellClass} sticky left-0 z-20 min-w-[220px] text-left`}
            >
              {itemBy === "position" ? "Должность" : "Сотрудник"}
            </th>
            {dates.map((iso) => {
              const dayOff = offDayByDate.get(iso);
              return (
                <th
                  key={iso}
                  title={dayOff}
                  className={`${headCellClass} ${
                    isMonthScale ? "min-w-[44px]" : "min-w-[104px]"
                  } ${dayOff ? `${offColumnClass} text-rose-500 dark:text-rose-300` : ""} ${
                    isToday(iso) ? "text-brand-500 dark:text-brand-400" : ""
                  }`}
                >
                  {isMonthScale ? fromIsoDate(iso).getDate() : formatDayHeader(iso)}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {groups.map((group) => {
            const isCollapsed = collapsedGroups.has(group.key);
            const hasOpenShifts = group.openByDate.size > 0;
            const rows = itemBy === "position" ? positionRows(group.employees) : null;

            return (
              <Fragment key={group.key}>
                {showGroupHeaders && (
                  <tr
                    onClick={() => onToggleGroup(group.key)}
                    className="cursor-pointer bg-gray-50/70 hover:bg-gray-100/70 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
                  >
                    <td colSpan={columnCount} className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <ChevronDown
                          size={14}
                          className={`text-gray-400 transition-transform ${
                            isCollapsed ? "-rotate-90" : ""
                          }`}
                        />
                        <span className="text-[13px] font-semibold text-gray-700 dark:text-white/90">
                          {group.label}
                        </span>
                        <span className="text-[12px] text-gray-400 dark:text-gray-500">
                          {group.employees.length} чел.
                        </span>
                      </div>
                    </td>
                  </tr>
                )}

                {!isCollapsed && hasOpenShifts && (
                  <tr className="border-t border-gray-100 dark:border-gray-800">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 dark:bg-gray-900">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-amber-300 text-amber-500">
                          <Plus size={14} />
                        </span>
                        <span className="text-[13px] font-semibold text-gray-700 dark:text-white/90">
                          Открытые
                        </span>
                      </div>
                    </td>
                    {dates.map((iso) => {
                      const openShifts = group.openByDate.get(iso) ?? [];
                      const dayOff = offDayByDate.get(iso);
                      if (openShifts.length === 0) {
                        return (
                          <td key={iso} className={`px-1 py-1 ${dayOff ? offColumnClass : ""}`} />
                        );
                      }
                      return (
                        <td key={iso} className={`px-1 py-1 ${dayOff ? offColumnClass : ""}`}>
                          <button
                            type="button"
                            onClick={() => onOpenShiftsClick(iso, openShifts)}
                            title={`Незакрытых слотов: ${openShifts.length}`}
                            className="w-full rounded-lg border border-dashed border-amber-300 bg-amber-50 px-1.5 py-1.5 text-center transition hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10"
                          >
                            <span className="block text-[12px] font-bold text-amber-700 dark:text-amber-400">
                              {openShifts.length}
                            </span>
                            {!isMonthScale && (
                              <span className="block text-[10px] text-amber-600 dark:text-amber-500">
                                {formatShiftTime(openShifts[0]) || "нужен человек"}
                              </span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                )}

                {!isCollapsed &&
                  rows?.map((row) => (
                    <tr
                      key={row.label}
                      className="border-t border-gray-100 hover:bg-gray-50/60 dark:border-gray-800 dark:hover:bg-white/[0.02]"
                    >
                      <td className="sticky left-0 z-10 bg-white px-3 py-2 dark:bg-gray-900">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                            style={{ backgroundColor: avatarColor(row.label) }}
                          >
                            {row.label.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-gray-800 dark:text-white/90">
                              {row.label}
                            </span>
                            <span className="block truncate text-[11px] text-gray-400 dark:text-gray-500">
                              {row.employees.length} чел.
                            </span>
                          </span>
                        </div>
                      </td>
                      {dates.map((iso) => renderAggregateCell(row.label, row.employees, iso))}
                    </tr>
                  ))}

                {!isCollapsed &&
                  !rows &&
                  group.employees.map((employee) => (
                    <tr
                      key={employee.id}
                      className="border-t border-gray-100 hover:bg-gray-50/60 dark:border-gray-800 dark:hover:bg-white/[0.02]"
                    >
                      <td className="sticky left-0 z-10 bg-white px-3 py-2 dark:bg-gray-900">
                        <div className="flex items-center gap-2.5">
                          {employee.photo ? (
                            <img
                              src={employee.photo}
                              alt=""
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <span
                              className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white"
                              style={{ backgroundColor: avatarColor(employee.id) }}
                            >
                              {getInitials(employee.name)}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-gray-800 dark:text-white/90">
                              {employee.name}
                            </span>
                            <span className="block truncate text-[11px] text-gray-400 dark:text-gray-500">
                              {employee.position || "—"}
                            </span>
                          </span>
                          {/* Разворачивает недельный шаблон самого сотрудника,
                              а не выдуманный 5/2: часы, обед и выходные берутся
                              из его work_schedule. */}
                          <button
                            type="button"
                            onClick={() => onAutofill(employee)}
                            disabled={autofillingId === employee.id}
                            title="Заполнить период по графику сотрудника"
                            className="rounded-lg border border-gray-200 p-1.5 text-gray-400 transition hover:bg-gray-50 hover:text-brand-500 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-white/5"
                          >
                            <RefreshCw
                              size={13}
                              className={autofillingId === employee.id ? "animate-spin" : ""}
                            />
                          </button>
                        </div>
                      </td>

                      {dates.map((iso) => renderEmployeeCell(employee, iso))}
                    </tr>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
