import { useMemo } from "react";
import { SlidersHorizontal } from "lucide-react";
import ExpandableSearchInput from "../../../components/form/ExpandableSearchInput";
import SearchableSelect, {
  type SelectOption,
} from "../../../components/ui/searchable-select";
import { SOURCE_META, SOURCE_ORDER } from "../constants";
import type {
  TimesheetDirectoryItem,
  TimesheetEmployee,
  TimesheetFilters,
  TimesheetSource,
} from "../types";

/** Поиск живёт в тулбаре и скрытым фильтром не считается. */
export const countActiveFilters = (filters: TimesheetFilters): number =>
  [
    filters.employeeId,
    filters.departmentId,
    filters.projectId,
    filters.taskId,
    filters.source,
  ].filter(Boolean).length;

export const EMPTY_FILTERS: TimesheetFilters = {
  search: "",
  employeeId: "",
  departmentId: "",
  projectId: "",
  taskId: "",
  source: "",
};

interface FiltersToolbarProps {
  filters: TimesheetFilters;
  brandColor: string;
  isOpen: boolean;
  onToggle: () => void;
  onChange: (filters: TimesheetFilters) => void;
}

export function FiltersToolbar({
  filters,
  brandColor,
  isOpen,
  onToggle,
  onChange,
}: FiltersToolbarProps) {
  const activeCount = countActiveFilters(filters);
  const isButtonActive = isOpen || activeCount > 0;

  return (
    <>
      <ExpandableSearchInput
        value={filters.search}
        onChange={(search) => onChange({ ...filters, search })}
        inputId="timesheet-search"
        placeholder="Сотрудник, проект, задача..."
        expandedWidth={300}
        collapsedSize={38}
        brandColor={brandColor}
      />

      <button
        type="button"
        onClick={onToggle}
        aria-label={`Фильтр${activeCount > 0 ? ` (${activeCount})` : ""}`}
        aria-expanded={isOpen}
        title={`Фильтр${activeCount > 0 ? ` (${activeCount})` : ""}`}
        className={`relative inline-flex h-[38px] w-[38px] items-center justify-center rounded-xl border transition ${
          isButtonActive
            ? "border-brand-200 bg-brand-50 text-brand-500"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        <SlidersHorizontal size={16} />
        {activeCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-semibold text-white">
            {activeCount}
          </span>
        )}
      </button>
    </>
  );
}

interface FiltersPanelProps {
  filters: TimesheetFilters;
  brandColor: string;
  employees: TimesheetEmployee[];
  projects: TimesheetDirectoryItem[];
  tasks: TimesheetDirectoryItem[];
  onChange: (filters: TimesheetFilters) => void;
}

export default function FiltersPanel({
  filters,
  brandColor,
  employees,
  projects,
  tasks,
  onChange,
}: FiltersPanelProps) {
  const employeeOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: "Все сотрудники" },
      ...employees.map((employee) => ({ value: employee.employeeId, label: employee.name })),
    ],
    [employees]
  );

  /** Департаменты собираются из сотрудников — отдельного справочника здесь нет. */
  const departmentOptions = useMemo<SelectOption[]>(() => {
    const seen = new Map<string, string>();
    employees.forEach((employee) => {
      if (employee.departmentId && employee.department) {
        seen.set(employee.departmentId, employee.department);
      }
    });
    return [
      { value: "", label: "Все департаменты" },
      ...[...seen.entries()]
        .sort((a, b) => a[1].localeCompare(b[1], "ru"))
        .map(([id, title]) => ({ value: id, label: title })),
    ];
  }, [employees]);

  const projectOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: "Все проекты" },
      ...projects.map((project) => ({ value: project.id, label: project.name })),
    ],
    [projects]
  );

  /** Задачи Time Doctor принадлежат проекту — при выбранном проекте показываем
   *  только его задачи, иначе список из 75 позиций бесполезен. */
  const taskOptions = useMemo<SelectOption[]>(() => {
    const scoped = filters.projectId
      ? tasks.filter((task) => task.projectId === filters.projectId)
      : tasks;
    return [
      { value: "", label: "Все задачи" },
      ...scoped.map((task) => ({ value: task.id, label: task.name })),
    ];
  }, [tasks, filters.projectId]);

  const sourceOptions = useMemo<SelectOption[]>(
    () => [
      { value: "", label: "Все источники" },
      ...SOURCE_ORDER.map((source) => ({ value: source, label: SOURCE_META[source].label })),
    ],
    []
  );

  const hasActive = countActiveFilters(filters) > 0;

  return (
    <div className="flex flex-wrap items-center gap-2 border border-gray-200 bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-2.5 dark:border-gray-800 dark:from-gray-900 dark:to-gray-900 lg:px-6">
      <div className="w-[220px]">
        <SearchableSelect
          options={employeeOptions}
          value={filters.employeeId}
          onChange={(employeeId) => onChange({ ...filters, employeeId })}
          placeholder="Все сотрудники"
          brandColor={brandColor}
        />
      </div>

      {departmentOptions.length > 1 && (
        <div className="w-[190px]">
          <SearchableSelect
            options={departmentOptions}
            value={filters.departmentId}
            onChange={(departmentId) => onChange({ ...filters, departmentId })}
            placeholder="Все департаменты"
            brandColor={brandColor}
          />
        </div>
      )}

      <div className="w-[190px]">
        <SearchableSelect
          options={projectOptions}
          // Смена проекта сбрасывает задачу: задача из другого проекта дала бы
          // заведомо пустую выборку.
          value={filters.projectId}
          onChange={(projectId) => onChange({ ...filters, projectId, taskId: "" })}
          placeholder="Все проекты"
          brandColor={brandColor}
        />
      </div>

      <div className="w-[190px]">
        <SearchableSelect
          options={taskOptions}
          value={filters.taskId}
          onChange={(taskId) => onChange({ ...filters, taskId })}
          placeholder="Все задачи"
          brandColor={brandColor}
        />
      </div>

      <div className="w-[190px]">
        <SearchableSelect
          options={sourceOptions}
          value={filters.source}
          onChange={(source) =>
            onChange({ ...filters, source: source as TimesheetSource | "" })
          }
          placeholder="Все источники"
          brandColor={brandColor}
        />
      </div>

      {hasActive && (
        <button
          type="button"
          onClick={() =>
            onChange({
              ...filters,
              employeeId: "",
              departmentId: "",
              projectId: "",
              taskId: "",
              source: "",
            })
          }
          className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-gray-500 transition hover:bg-white hover:text-gray-700"
        >
          Сбросить
        </button>
      )}
    </div>
  );
}
