import { useMemo, useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import ExpandableSearchInput from "../../../components/form/ExpandableSearchInput";
import type { TaskDirectories, TaskEmployee, TaskFilters } from "../types";
import Popover from "./ui/Popover";
import OptionPicker, { type PickerOption } from "./ui/OptionPicker";
import { ControlButton } from "./ui/controls";
import { EmployeeAvatar, PriorityIcon, StatusDot, TypeIcon } from "./badges";

/** Sentinel for the "no filter" row — an empty string can't be a picker value. */
const ALL = "__all__";

/** Поиск живёт в самом тулбаре и скрытым фильтром не считается. */
const countActiveFilters = (filters: TaskFilters): number =>
  [
    filters.statusId,
    filters.priorityId,
    filters.typeId,
    filters.assigneeId,
    filters.locationId,
    filters.tagId,
    filters.departmentId,
  ].filter(Boolean).length;

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: PickerOption[];
  allLabel: string;
  searchable?: boolean;
  width?: number;
}

function FilterSelect({
  value,
  onChange,
  options,
  allLabel,
  searchable,
  width = 240,
}: FilterSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      width={width}
      content={({ close }) => (
        <OptionPicker
          options={[{ value: ALL, label: allLabel }, ...options]}
          selected={value || ALL}
          onSelect={(next) => onChange(next === ALL ? "" : next)}
          searchable={searchable}
          searchPlaceholder="Поиск..."
          close={close}
        />
      )}
    >
      {({ ref, props }) => (
        <ControlButton
          ref={ref}
          variant="chip"
          open={open}
          active={Boolean(value)}
          muted={!value}
          className="max-w-[240px] bg-white"
          {...props}
        >
          {selected?.icon}
          <span className="min-w-0 flex-1 truncate text-left">{selected?.label ?? allLabel}</span>
          <ChevronDown size={14} className="shrink-0 text-gray-400" />
        </ControlButton>
      )}
    </Popover>
  );
}

interface FiltersToolbarProps {
  filters: TaskFilters;
  brandColor: string;
  isOpen: boolean;
  onToggle: () => void;
  onChange: (filters: TaskFilters) => void;
}

/** Search box + the button that reveals the filter row (same pattern as KPI). */
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
        inputId="tasks-search"
        placeholder="Поиск задач..."
        expandedWidth={300}
        collapsedSize={40}
        brandColor={brandColor}
      />

      <button
        type="button"
        onClick={onToggle}
        aria-label={`Фильтр${activeCount > 0 ? ` (${activeCount})` : ""}`}
        aria-expanded={isOpen}
        title={`Фильтр${activeCount > 0 ? ` (${activeCount})` : ""}`}
        className={`relative inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
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
  filters: TaskFilters;
  employees: TaskEmployee[];
  directories: TaskDirectories;
  /** Локации, встречающиеся в задачах: id → название. */
  locations: { id: string; title: string }[];
  onChange: (filters: TaskFilters) => void;
}

/** Раскрывающаяся строка фильтров под тулбаром. */
export default function FiltersPanel({
  filters,
  employees,
  directories,
  locations,
  onChange,
}: FiltersPanelProps) {
  const statusOptions = useMemo<PickerOption[]>(
    () =>
      directories.statuses.map((status) => ({
        value: status.id,
        label: status.title,
        icon: <StatusDot status={status} />,
      })),
    [directories.statuses]
  );

  const priorityOptions = useMemo<PickerOption[]>(
    () =>
      directories.priorities.map((priority) => ({
        value: priority.id,
        label: priority.title,
        icon: <PriorityIcon priority={priority} />,
      })),
    [directories.priorities]
  );

  const typeOptions = useMemo<PickerOption[]>(
    () =>
      directories.types.map((type) => ({
        value: type.id,
        label: type.title,
        icon: <TypeIcon type={type} />,
      })),
    [directories.types]
  );

  const tagOptions = useMemo<PickerOption[]>(
    () =>
      directories.tags.map((tag) => ({
        value: tag.id,
        label: tag.title,
        icon: (
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: tag.color || "#94a3b8" }}
          />
        ),
      })),
    [directories.tags]
  );

  /**
   * Департаменты собираются из сотрудников: у задачи своего поля нет, фильтр
   * считается по департаменту исполнителя.
   */
  const departmentOptions = useMemo<PickerOption[]>(() => {
    const seen = new Map<string, string>();
    employees.forEach((employee) => {
      if (employee.departmentId && employee.department) {
        seen.set(employee.departmentId, employee.department);
      }
    });
    return [...seen.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, title]) => ({ value: id, label: title }));
  }, [employees]);

  const employeeOptions = useMemo<PickerOption[]>(
    () =>
      employees.map((employee) => ({
        value: employee.id,
        label: employee.name,
        hint: employee.position,
        icon: <EmployeeAvatar employee={employee} size={24} />,
      })),
    [employees]
  );

  const locationOptions = useMemo<PickerOption[]>(
    () => locations.map((location) => ({ value: location.id, label: location.title })),
    [locations]
  );

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-4 py-2.5 lg:px-6"
      style={{
        background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
        border: "1px solid #e2e8f0",
        borderTop: "1px solid #dbe4ee",
      }}
    >
      <FilterSelect
        value={filters.statusId}
        onChange={(statusId) => onChange({ ...filters, statusId })}
        options={statusOptions}
        allLabel="Все статусы"
        width={220}
      />

      <FilterSelect
        value={filters.priorityId}
        onChange={(priorityId) => onChange({ ...filters, priorityId })}
        options={priorityOptions}
        allLabel="Все приоритеты"
        width={200}
      />

      <FilterSelect
        value={filters.typeId}
        onChange={(typeId) => onChange({ ...filters, typeId })}
        options={typeOptions}
        allLabel="Все типы"
        width={220}
      />

      <FilterSelect
        value={filters.assigneeId}
        onChange={(assigneeId) => onChange({ ...filters, assigneeId })}
        options={employeeOptions}
        allLabel="Все исполнители"
        searchable
        width={300}
      />

      {departmentOptions.length > 0 && (
        <FilterSelect
          value={filters.departmentId}
          onChange={(departmentId) => onChange({ ...filters, departmentId })}
          options={departmentOptions}
          allLabel="Все департаменты"
          searchable
          width={280}
        />
      )}

      {tagOptions.length > 0 && (
        <FilterSelect
          value={filters.tagId}
          onChange={(tagId) => onChange({ ...filters, tagId })}
          options={tagOptions}
          allLabel="Все теги"
          searchable
          width={240}
        />
      )}

      {locationOptions.length > 0 && (
        <FilterSelect
          value={filters.locationId}
          onChange={(locationId) => onChange({ ...filters, locationId })}
          options={locationOptions}
          allLabel="Все локации"
          searchable
          width={280}
        />
      )}

      {countActiveFilters(filters) > 0 && (
        <button
          type="button"
          onClick={() =>
            onChange({
              ...filters,
              statusId: "",
              priorityId: "",
              typeId: "",
              assigneeId: "",
              locationId: "",
              tagId: "",
              departmentId: "",
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
