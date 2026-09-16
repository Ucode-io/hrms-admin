// Сетка «сотрудники × даты».
//
// Строка «Открытые» идёт первой в каждой секции: незакрытая потребность должна
// стоять рядом с теми, кем её можно закрыть, а не отдельным списком в углу.
//
// Сотрудник без единой смены остаётся строкой с пустыми ячейками — это и есть
// главный вопрос к экрану: кого забыли поставить. Та же позиция, что у табеля.

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
  isWeekend,
  shiftKind,
} from "../constants";
import type { Shift } from "../../../api/services/shift.service";
import type { ShiftEmployee, ShiftGroup } from "../types";

interface GridViewProps {
  dates: string[];
  groups: ShiftGroup[];
  /** `${employeeId}|${iso}` → смена. Одна на пару — это гарантирует индекс в БД. */
  shiftByCell: Map<string, Shift>;
  isMonthScale: boolean;
  collapsedGroups: Set<string>;
  showGroupHeaders: boolean;
  autofillingId: string | null;
  onToggleGroup: (key: string) => void;
  onCellClick: (employeeId: string | null, date: string, shift: Shift | null) => void;
  onOpenShiftsClick: (date: string, shifts: Shift[]) => void;
  onAutofill: (employee: ShiftEmployee) => void;
}

const headCellClass =
  "sticky top-0 z-10 bg-gray-50 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400";

export default function GridView({
  dates,
  groups,
  shiftByCell,
  isMonthScale,
  collapsedGroups,
  showGroupHeaders,
  autofillingId,
  onToggleGroup,
  onCellClick,
  onOpenShiftsClick,
  onAutofill,
}: GridViewProps) {
  const columnCount = dates.length + 1;

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-400 dark:border-gray-700 dark:text-gray-500">
        Нет сотрудников и смен по заданным фильтрам
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th
              className={`${headCellClass} sticky left-0 z-20 min-w-[220px] text-left`}
            >
              Сотрудник
            </th>
            {dates.map((iso) => (
              <th
                key={iso}
                className={`${headCellClass} ${isMonthScale ? "min-w-[44px]" : "min-w-[104px]"} ${
                  isWeekend(iso) ? "text-rose-400 dark:text-rose-300" : ""
                } ${isToday(iso) ? "text-brand-500 dark:text-brand-400" : ""}`}
              >
                {isMonthScale ? fromIsoDate(iso).getDate() : formatDayHeader(iso)}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {groups.map((group) => {
            const isCollapsed = collapsedGroups.has(group.key);
            const hasOpenShifts = group.openByDate.size > 0;

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
                      if (openShifts.length === 0) {
                        return <td key={iso} className="px-1 py-1" />;
                      }
                      return (
                        <td key={iso} className="px-1 py-1">
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

                      {dates.map((iso) => {
                        const shift = shiftByCell.get(`${employee.id}|${iso}`) ?? null;

                        if (!shift) {
                          return (
                            <td key={iso} className="px-1 py-1">
                              <button
                                type="button"
                                onClick={() => onCellClick(employee.id, iso, null)}
                                title="Поставить смену"
                                className={`h-full min-h-[38px] w-full rounded-lg border border-dashed transition hover:border-brand-300 hover:bg-brand-50/50 dark:hover:bg-brand-500/10 ${
                                  isWeekend(iso)
                                    ? "border-gray-100 bg-gray-50/60 dark:border-gray-800 dark:bg-white/[0.02]"
                                    : "border-gray-100 dark:border-gray-800"
                                }`}
                              />
                            </td>
                          );
                        }

                        const kind = shiftKind(shift);
                        const meta = KIND_META[kind];
                        const time = formatShiftTime(shift);

                        return (
                          <td key={iso} className="px-1 py-1">
                            <button
                              type="button"
                              onClick={() => onCellClick(employee.id, iso, shift)}
                              title={`${employee.name} · ${formatDayHeader(iso)} · ${meta.label}${
                                time ? ` ${time}` : ""
                              }${shift.comment ? ` · ${shift.comment}` : ""}`}
                              className="min-h-[38px] w-full rounded-lg border px-1.5 py-1 text-center transition hover:brightness-95"
                              style={{
                                borderColor: meta.color,
                                backgroundColor: meta.soft,
                              }}
                            >
                              {isMonthScale ? (
                                <span
                                  className="mx-auto block h-2.5 w-2.5 rounded-sm"
                                  style={{ backgroundColor: meta.color }}
                                />
                              ) : (
                                <>
                                  <span
                                    className="block text-[11px] font-semibold"
                                    style={{ color: meta.color }}
                                  >
                                    {meta.label}
                                  </span>
                                  {time && (
                                    <span className="block text-[10px] text-gray-500">{time}</span>
                                  )}
                                </>
                              )}
                            </button>
                          </td>
                        );
                      })}
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
