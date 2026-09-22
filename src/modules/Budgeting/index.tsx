import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, Check, ChevronLeft, ChevronRight, Columns3, Info } from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../components/common/PageMeta";
import ExpandableSearchInput from "../../components/form/ExpandableSearchInput";
import Button from "../../components/ui/button/Button";
import { Dropdown } from "../../components/ui/dropdown/Dropdown";
import { Modal } from "../../components/ui/modal";
import companyStore from "../../store/company.store";
import BudgetHead from "./components/BudgetHead";
import BudgetRowLine from "./components/BudgetRowLine";
import DepartmentRowLine from "./components/DepartmentRowLine";
import AddRowLine from "./components/AddRowLine";
import AddDepartmentLine from "./components/AddDepartmentLine";
import AmountGroup from "./components/AmountGroup";
import {
  ALL_MONTHS,
  COLUMN_LABELS,
  DEFAULT_COLUMNS,
  readStoredColumns,
  META_CELL,
  PERIOD_VIEWS,
  STATUS_CELL,
  STICKY_TITLE_CLASS,
  TITLE_CELL,
  type BudgetPeriod,
  type PeriodView,
  type VisibleColumns,
  currentPeriodIndex,
  emptyMonths,
  matchesSearch,
  periodsOf,
  sumMonths,
  totalsYear,
  writeStoredColumns,
} from "./constants";
import {
  EMPTY_SNAPSHOT,
  useBudgetQuery,
  useClearBudgetDepartment,
  useDeleteBudgetRow,
  useSaveBudgetAmount,
  useSaveBudgetRow,
} from "../../api/services/budget.service";
import type { BudgetDepartment, BudgetEmployeeOption, BudgetMonth, BudgetRow } from "./types";
import { useTranslation } from "../../i18n";

const CURRENT_YEAR = 2026;

/**
 * Сколько лет вокруг текущего показывает годовой вид. Он существует ради
 * сравнения, поэтому в нём всегда есть с чем сравнивать — даже когда бюджет
 * заполнен только за один год.
 */
const YEAR_WINDOW = 2;

type PendingDelete =
  | { kind: "department"; departmentId: string; title: string }
  | { kind: "row"; departmentId: string; rowId: string; title: string };


/**
 * Бюджет на год: отделы, внутри них строки сотрудников и вакансий, по каждой —
 * 12 месяцев с планом и фактом.
 *
 * **Этап 1: API нет.** Данные лежат в состоянии страницы и пропадают после
 * перезагрузки — это витрина раскладки, а не рабочий бюджет.
 *
 * Итоги отдела и года считаются из строк и не правятся: свести бюджет можно
 * только снизу вверх, иначе итог и сумма слагаемых разъезжаются.
 */
export default function BudgetingPage() {
  const { t } = useTranslation();
  const [year, setYear] = useState(CURRENT_YEAR);
  const [periodView, setPeriodView] = useState<PeriodView>("month");
  const [columns, setColumns] = useState<VisibleColumns>(readStoredColumns);
  const [isColumnsOpen, setIsColumnsOpen] = useState(false);
  const columnsButtonRef = useRef<HTMLButtonElement>(null);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const isYearView = periodView === "year";

  useEffect(() => {
    writeStoredColumns(columns);
  }, [columns]);

  /**
   * Годы, за которые нужны суммы: помесячный и квартальный вид смотрят один
   * год, годовой — окно вокруг текущего. Запрашиваем ровно их, чтобы не тянуть
   * всю историю компании ради одной таблицы.
   */
  const years = useMemo(() => {
    if (!isYearView) return [year];

    const set = new Set<number>([year]);
    for (let offset = -YEAR_WINDOW; offset <= YEAR_WINDOW; offset += 1) {
      set.add(CURRENT_YEAR + offset);
    }
    return [...set].sort((first, second) => first - second);
  }, [isYearView, year]);

  const { data, isLoading, isError, error } = useBudgetQuery(year, years);
  const snapshot = data ?? EMPTY_SNAPSHOT;

  const clearDepartment = useClearBudgetDepartment(years);
  const saveRow = useSaveBudgetRow(years);
  const removeRow = useDeleteBudgetRow(years);
  const saveAmount = useSaveBudgetAmount(years);

  const notifyError = (fallback: string) => (mutationError: unknown) => {
    toast.error(
      mutationError instanceof Error && mutationError.message ? mutationError.message : fallback
    );
  };

  /** Суммы приходят плоско — индекс по строке и году собираем один раз. */
  const amountIndex = useMemo(() => {
    const map = new Map<string, BudgetMonth[]>();
    for (const amount of snapshot.amounts) {
      map.set(`${amount.rowId}|${amount.year}`, amount.months);
    }
    return map;
  }, [snapshot.amounts]);

  const monthsOf = useCallback(
    (rowId: string, target: number): BudgetMonth[] =>
      amountIndex.get(`${rowId}|${target}`) ?? emptyMonths(),
    [amountIndex]
  );

  /**
   * Отдел попадает в бюджет, когда в нём появляется хотя бы одна строка —
   * отдельной сущности «отдел бюджета» нет. Только что добавленный отдел
   * держим в состоянии, пока в него не внесли первую строку: иначе он исчезал
   * бы сразу после выбора.
   */
  const [openedDepartmentIds, setOpenedDepartmentIds] = useState<string[]>([]);

  /**
   * Плоский ответ сервера → дерево «отдел → строки» с суммами выбранного года.
   * Компоненты таблицы работают именно с ним и не знают про формат API.
   */
  const departments = useMemo<BudgetDepartment[]>(() => {
    const used = new Set(
      snapshot.rows.map((row) => row.departmentId).filter((id): id is string => Boolean(id))
    );

    return snapshot.departments
      .filter(
        (department) => used.has(department.id) || openedDepartmentIds.includes(department.id)
      )
      .map((department) => ({
        id: department.id,
        name: department.title,
        rows: snapshot.rows
          .filter((row) => row.departmentId === department.id)
          .map((row) => ({ ...row, months: monthsOf(row.id, year) })),
      }));
  }, [monthsOf, openedDepartmentIds, snapshot.departments, snapshot.rows, year]);

  /** Отделы, которых в бюджете ещё нет — из них выбирают, что добавить. */
  const freeDepartments = useMemo(() => {
    const shown = new Set(departments.map((department) => department.id));
    return snapshot.departments.filter((department) => !shown.has(department.id));
  }, [departments, snapshot.departments]);

  const positions = snapshot.positions;

  const usedEmployeeIds = useMemo(
    () =>
      new Set(
        snapshot.rows.map((row) => row.employeeId).filter((id): id is string => Boolean(id))
      ),
    [snapshot.rows]
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return departments;

    return departments
      .map((department) => {
        if (department.name.toLowerCase().includes(needle)) return department;
        return {
          ...department,
          rows: department.rows.filter((row) => matchesSearch(row, positions, needle)),
        };
      })
      .filter(
        (department) =>
          department.rows.length > 0 || department.name.toLowerCase().includes(needle)
      );
  }, [departments, positions, search]);

  const periods = useMemo(() => periodsOf(periodView, year, years), [periodView, year, years]);
  const showYearGroup = !isYearView;
  const currentPeriod = currentPeriodIndex(periods);

  const rowValue = useCallback(
    (row: BudgetRow, period: BudgetPeriod): BudgetMonth =>
      period.months
        ? sumMonths(row.months, period.months)
        : sumMonths(monthsOf(row.id, period.year), ALL_MONTHS),
    [monthsOf]
  );

  const departmentValue = useCallback(
    (department: BudgetDepartment, period: BudgetPeriod): BudgetMonth =>
      department.rows.reduce(
        (sum, row) => {
          const value = rowValue(row, period);
          return { plan: sum.plan + value.plan, fact: sum.fact + value.fact };
        },
        { plan: 0, fact: 0 }
      ),
    [rowValue]
  );

  const totalValue = useCallback(
    (period: BudgetPeriod): BudgetMonth =>
      departments.reduce(
        (sum, department) => {
          const value = departmentValue(department, period);
          return { plan: sum.plan + value.plan, fact: sum.fact + value.fact };
        },
        { plan: 0, fact: 0 }
      ),
    [departmentValue, departments]
  );

  const year_ = totalsYear(departments);
  const activeColumns = COLUMN_LABELS.filter((item) => columns[item.key]).length;

  const toggleDepartment = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const addDepartment = (departmentId: string) =>
    setOpenedDepartmentIds((prev) =>
      prev.includes(departmentId) ? prev : [...prev, departmentId]
    );

  /** Полный набор полей строки: сервер сохраняет её целиком, а не патчем. */
  const rowDraft = (row: BudgetRow, departmentId: string, patch: Partial<BudgetRow> = {}) => {
    const next = { ...row, ...patch };
    return {
      guid: next.id,
      departmentId,
      kind: next.kind,
      employeeId: next.employeeId,
      title: next.kind === "vacancy" ? next.name : undefined,
      positionId: next.positionId,
      status: next.status,
      taxPercent: next.taxPercent,
      bonusPercent: next.bonusPercent,
      displayName: next.name,
    };
  };

  const patchRow = (departmentId: string, row: BudgetRow, patch: Partial<BudgetRow>) =>
    saveRow.mutate(rowDraft(row, departmentId, patch), {
      onError: notifyError("Не удалось сохранить строку."),
    });

  const addEmployeeRow = (departmentId: string, employee: BudgetEmployeeOption) =>
    saveRow.mutate(
      {
        departmentId,
        kind: "employee",
        employeeId: employee.id,
        positionId: employee.positionId,
        status: "working",
        taxPercent: 0,
        bonusPercent: 0,
        displayName: employee.name,
        // Год нужен серверу, чтобы проставить оклад сотрудника на все месяцы.
        year,
      },
      { onError: notifyError("Не удалось добавить сотрудника.") }
    );

  const addVacancyRow = (departmentId: string) =>
    saveRow.mutate(
      {
        departmentId,
        kind: "vacancy",
        title: "Вакансия",
        positionId: null,
        status: "vacant",
        taxPercent: 0,
        bonusPercent: 0,
        displayName: "Вакансия",
      },
      { onError: notifyError("Не удалось добавить вакансию.") }
    );

  const setMonth = (rowId: string, index: number, field: "plan" | "fact", value: number) =>
    saveAmount.mutate(
      { rowId, year, monthIndex: index, field, value },
      { onError: notifyError("Не удалось сохранить сумму.") }
    );

  const confirmDelete = () => {
    if (!pendingDelete) return;

    if (pendingDelete.kind === "department") {
      setOpenedDepartmentIds((prev) => prev.filter((id) => id !== pendingDelete.departmentId));
      clearDepartment.mutate(pendingDelete.departmentId, {
        onError: notifyError("Не удалось убрать отдел из бюджета."),
      });
    } else {
      removeRow.mutate(pendingDelete.rowId, {
        onError: notifyError("Не удалось удалить строку."),
      });
    }

    setPendingDelete(null);
  };

  const brandColor = companyStore.mainColor || "#465fff";
  const allCollapsed = departments.length > 0 && collapsed.size === departments.length;

  return (
    <>
      <PageMeta
        title="Бюджетирование | HRMS"
        description="План и факт фонда оплаты труда по отделам и сотрудникам"
      />

      {/* Высота фиксирована, прокручивается только таблица: иначе на странице
          появляются два вертикальных скролла — свой у таблицы и общий у макета. */}
      <div className="-mx-3 -mt-3 flex h-[calc(100vh-76px)] flex-col overflow-hidden md:-mx-4 md:-mt-4 md:h-[calc(100vh-80px)]">
        {/* Тулбар во всю ширину — как в KPI и «Сотрудниках»: страница начинается
            с действий, заголовок несут хлебные крошки. */}
        <div className="z-30 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2 lg:px-6">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ExpandableSearchInput
              value={search}
              onChange={setSearch}
              inputId="budgeting-search"
              placeholder="Отдел, сотрудник или должность"
              expandedWidth={320}
              collapsedSize={38}
              brandColor={brandColor}
            />

            {/* Колонки — в выпадашке у своей кнопки: полоса под тулбаром
                принадлежит фильтрам, и занимать её настройкой вида нельзя. */}
            <div className="relative">
              <button
                ref={columnsButtonRef}
                type="button"
                onClick={() => setIsColumnsOpen((open) => !open)}
                aria-label={`Колонки${activeColumns ? ` (${activeColumns + 1})` : ""}`}
                title="Колонки периода"
                className={`dropdown-toggle relative inline-flex h-10 w-10 items-center justify-center rounded-[10px] border transition ${
                  isColumnsOpen || activeColumns > 0
                    ? "border-brand-200 bg-brand-50 text-brand-600"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Columns3 size={16} />
                {activeColumns > 0 && (
                  <span
                    className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white"
                    style={{ backgroundColor: brandColor }}
                  >
                    {activeColumns + 1}
                  </span>
                )}
              </button>

              <Dropdown
                isOpen={isColumnsOpen}
                onClose={() => setIsColumnsOpen(false)}
                usePortal
                anchorEl={columnsButtonRef.current}
                className="w-60 p-1.5"
              >
                <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Колонки периода
                </p>

                <span className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm text-slate-400">
                  План
                  <span className="text-[11px]">всегда</span>
                </span>

                {COLUMN_LABELS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setColumns((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 transition hover:bg-brand-50 hover:text-brand-600"
                  >
                    {item.label}
                    {columns[item.key] && <Check size={15} className="text-brand-500" />}
                  </button>
                ))}

                {activeColumns > 0 && (
                  <button
                    type="button"
                    onClick={() => setColumns(DEFAULT_COLUMNS)}
                    className="mt-1 w-full rounded-lg border-t border-slate-100 px-2 py-1.5 text-left text-sm text-slate-500 transition hover:bg-slate-50"
                  >
                    Оставить только план
                  </button>
                )}
              </Dropdown>
            </div>

            <button
              type="button"
              onClick={() =>
                setCollapsed(allCollapsed ? new Set() : new Set(departments.map((item) => item.id)))
              }
              className="inline-flex h-10 items-center rounded-[10px] border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {allCollapsed ? "Развернуть всё" : "Свернуть всё"}
            </button>

          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-white">
          {/* Ошибка обновления при уже загруженных данных — полоской, а не
              вместо таблицы: спрятать бюджет из-за одного неудачного запроса
              хуже, чем показать его с пометкой «данные могли устареть». */}
          {isError && departments.length > 0 && (
            <p className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-[12px] text-amber-800 lg:px-6">
              Не удалось обновить данные — на экране последняя загруженная версия.
            </p>
          )}
          <div className="z-20 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5 lg:px-6">
            <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
              {PERIOD_VIEWS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setPeriodView(item.key)}
                  className={`inline-flex h-[30px] items-center rounded-lg px-3 text-[13px] font-semibold transition ${
                    periodView === item.key
                      ? "border border-brand-100 bg-white text-brand-600 shadow-sm"
                      : "border border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* В годовом виде год не выбирают: колонками стоят все годы сразу. */}
            {!isYearView && (
              <div className="inline-flex h-[38px] items-center rounded-xl border border-slate-200 bg-slate-50 p-[3px]">
                <button
                  type="button"
                  onClick={() => setYear((prev) => prev - 1)}
                  aria-label="Предыдущий год"
                  className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-transparent text-slate-600 transition hover:border-slate-200 hover:bg-white"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="min-w-[86px] px-2 text-center text-[13px] font-semibold text-slate-700">
                  {year} г.
                </span>
                <button
                  type="button"
                  onClick={() => setYear((prev) => prev + 1)}
                  aria-label="Следующий год"
                  className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-transparent text-slate-600 transition hover:border-slate-200 hover:bg-white"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>


          {isLoading && departments.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-6 py-20 text-sm text-slate-500">
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200"
                style={{ borderTopColor: brandColor }}
              />
              Загружаем бюджет...
            </div>
          ) : isError && departments.length === 0 ? (
            <div className="px-6 py-16">
              <div className="mx-auto flex max-w-xl items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {error instanceof Error && error.message
                    ? error.message
                    : "Не удалось загрузить бюджет."}{" "}
                  Если таблицы бюджета ещё не заведены в u-code, страница заработает сразу после
                  их создания.
                </span>
              </div>
            </div>
          ) : departments.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <Building2 size={26} className="mx-auto mb-3 text-slate-300" />
              <p className="text-sm text-slate-500">
                В бюджете пока нет отделов — добавьте первый снизу таблицы
              </p>
              <div className="mt-3 flex justify-center">
                <AddDepartmentLine departments={freeDepartments} onPick={addDepartment} />
              </div>
            </div>
          ) : visible.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <p className="text-sm text-slate-500">По запросу «{search.trim()}» ничего нет</p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="min-w-max">
                <BudgetHead
                  periods={periods}
                  columns={columns}
                  currentPeriod={currentPeriod}
                  showYearGroup={showYearGroup}
                />

                {visible.map((department) => {
                  const isCollapsed = collapsed.has(department.id);

                  return (
                    <div key={department.id}>
                      <DepartmentRowLine
                        department={department}
                        columns={columns}
                        periods={periods}
                        currentPeriod={currentPeriod}
                        showYearGroup={showYearGroup}
                        valueOf={(period) => departmentValue(department, period)}
                        collapsed={isCollapsed}
                        onToggle={() => toggleDepartment(department.id)}
                        onDelete={() =>
                          setPendingDelete({
                            kind: "department",
                            departmentId: department.id,
                            title: department.name,
                          })
                        }
                      />

                      {!isCollapsed && (
                        <>
                          {department.rows.map((row) => (
                            <BudgetRowLine
                              key={row.id}
                              row={row}
                              positions={positions}
                              columns={columns}
                              periods={periods}
                              currentPeriod={currentPeriod}
                              showYearGroup={showYearGroup}
                              valueOf={(period) => rowValue(row, period)}
                              onChange={(patch) => patchRow(department.id, row, patch)}
                              onMonthChange={(index, field, value) =>
                                setMonth(row.id, index, field, value)
                              }
                              onDelete={() =>
                                setPendingDelete({
                                  kind: "row",
                                  departmentId: department.id,
                                  rowId: row.id,
                                  title: row.name,
                                })
                              }
                            />
                          ))}

                          {!search.trim() && (
                            <AddRowLine
                              usedEmployeeIds={usedEmployeeIds}
                              onPickEmployee={(employee) => addEmployeeRow(department.id, employee)}
                              onCreateVacancy={() => addVacancyRow(department.id)}
                            />
                          )}
                        </>
                      )}
                    </div>
                  );
                })}

                {/* Добавление отдела стоит там, где отдел появится — в конце
                    списка, а не кнопкой в тулбаре за пределами таблицы. */}
                {!search.trim() && (
                  <AddDepartmentLine departments={freeDepartments} onPick={addDepartment} />
                )}

                {/* Итог компании липнет к низу: к нему возвращаются после каждой
                    правки, а прокручивать за ним всю сетку незачем. */}
                <div className="sticky bottom-0 z-20 flex items-stretch border-t-2 border-brand-200 bg-brand-50">
                  <div
                    className={`flex items-center px-4 py-2.5 text-[13px] font-bold text-brand-700 ${TITLE_CELL} ${STICKY_TITLE_CLASS} bg-brand-50`}
                  >
                    Итого
                  </div>
                  <div className={STATUS_CELL} />
                  <div className={META_CELL} />
                  <div className={META_CELL} />

                  {periods.map((period, index) => (
                    <AmountGroup
                      key={period.key}
                      month={totalValue(period)}
                      columns={columns}
                      label={`${period.label}, итого`}
                      className={`border-l border-brand-100 ${
                        index === currentPeriod ? "bg-brand-100/50" : ""
                      }`}
                      strong
                    />
                  ))}

                  {showYearGroup && (
                    <AmountGroup
                      month={year_}
                      columns={columns}
                      label="год, итого"
                      className="border-l border-brand-200 bg-brand-100/40"
                      strong
                    />
                  )}

                  <div className="w-[44px] min-w-[44px]" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Удаление */}
      <Modal
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        showCloseButton={false}
        className="mx-4 w-full max-w-[420px] overflow-hidden rounded-2xl"
      >
        <div className="px-6 pb-2 pt-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {pendingDelete?.kind === "department" ? "Убрать отдел из бюджета?" : "Удалить строку?"}
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            {pendingDelete?.kind === "department"
              ? `Строки отдела «${pendingDelete.title}» и их суммы уйдут из бюджета. Сам отдел останется в справочнике компании.`
              : `Строка «${pendingDelete?.title}» и её суммы за все годы уйдут из бюджета.`}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <Button variant="outline" className="h-10" onClick={() => setPendingDelete(null)}>
            Отмена
          </Button>
          <Button className="h-10 !bg-error-500 hover:!bg-error-600" onClick={confirmDelete}>
            Удалить
          </Button>
        </div>
      </Modal>
    </>
  );
}
