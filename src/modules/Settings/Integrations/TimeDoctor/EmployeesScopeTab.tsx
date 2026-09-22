import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Save, Search } from "lucide-react";
import { toast } from "sonner";
import Button from "../../../../components/ui/button/Button";
import Spinner from "../../../../components/ui/Spinner";
import {
  useTimeTrackingScopeQuery,
  useTimeTrackingScopeSaveMutation,
  type TimeTrackingScopeEmployee,
} from "../../../../api/services/timesheet.service";
import { useTranslation } from "../../../../i18n";

/**
 * Охват тайм-трекинга: у кого считается табель.
 *
 * Выбор поимённый — трекер стоит не у всех, и «весь отдел» почти всегда имеет
 * исключения. Но отмечать полсотни человек по одному незачем, поэтому строки
 * сгруппированы по отделам и у каждого отдела своя галочка «весь отдел».
 */

const NO_DEPARTMENT = "__none__";

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

const getInitials = (name: string): string =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

/** Цвет аватара — от имени, чтобы у сотрудника он не прыгал между загрузками. */
const AVATAR_COLORS = ["#6B8FE3", "#12B76A", "#F79009", "#7A5AF8", "#06B6D4", "#EC4899"];

const avatarColor = (name: string): string => {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) % 997;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

/** Чекбокс с третьим состоянием — для отдела, где отмечены не все. */
function TriCheckbox({
  checked,
  indeterminate,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <input
      type="checkbox"
      aria-label={ariaLabel}
      checked={checked}
      ref={(node) => {
        if (node) node.indeterminate = Boolean(indeterminate) && !checked;
      }}
      onChange={(event) => onChange(event.target.checked)}
      className="h-4 w-4 cursor-pointer accent-brand-500"
    />
  );
}

export default function EmployeesScopeTab() {
  const { t } = useTranslation();
  const scopeQuery = useTimeTrackingScopeQuery();
  const saveMutation = useTimeTrackingScopeSaveMutation();

  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Снимок с сервера — с ним сравнивается текущий выбор, чтобы «Сохранить»
  // загоралась только при реальных изменениях.
  const [savedIds, setSavedIds] = useState<string[]>([]);

  const employees = useMemo<TimeTrackingScopeEmployee[]>(
    () => scopeQuery.data?.employees ?? [],
    [scopeQuery.data]
  );
  const departments = scopeQuery.data?.departments ?? [];
  const configured = scopeQuery.data?.configured ?? false;

  useEffect(() => {
    const enabled = employees.filter((item) => item.isEnabled).map((item) => item.employeeId);
    setSelected(new Set(enabled));
    setSavedIds(enabled);
  }, [employees]);

  const isDirty = useMemo(() => {
    if (selected.size !== savedIds.length) return true;
    return savedIds.some((id) => !selected.has(id));
  }, [savedIds, selected]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return employees.filter((employee) => {
      if (departmentId && (employee.departmentId ?? NO_DEPARTMENT) !== departmentId) return false;
      if (!needle) return true;
      return `${employee.name} ${employee.position} ${employee.email}`
        .toLowerCase()
        .includes(needle);
    });
  }, [departmentId, employees, search]);

  /** Группы отделов в порядке, в котором сотрудники пришли с сервера (по ФИО). */
  const groups = useMemo(() => {
    const byDepartment = new Map<string, { title: string; items: TimeTrackingScopeEmployee[] }>();
    for (const employee of visible) {
      const key = employee.departmentId ?? NO_DEPARTMENT;
      if (!byDepartment.has(key)) {
        byDepartment.set(key, {
          title: employee.department || t("settings_integrations.employees.no_department"),
          items: [],
        });
      }
      byDepartment.get(key)!.items.push(employee);
    }
    return [...byDepartment.entries()].sort((a, b) => a[1].title.localeCompare(b[1].title, "ru"));
  }, [visible]);

  const toggleOne = (employeeId: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(employeeId);
      else next.delete(employeeId);
      return next;
    });
  };

  const toggleMany = (ids: string[], checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const handleSave = async () => {
    try {
      await saveMutation.mutateAsync([...selected]);
      setSavedIds([...selected]);
      toast.success(
        selected.size > 0
          ? t("settings_integrations.employees.tracking_enabled_count", { count: selected.size })
          : t("settings_integrations.employees.tracking_disabled_all")
      );
    } catch (error) {
      toast.error(getErrorMessage(error, t("settings_integrations.employees.error_save_list")));
    }
  };

  const handleReset = () => setSelected(new Set(savedIds));

  if (scopeQuery.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (scopeQuery.isError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
        <p className="text-sm font-medium text-rose-700">
          {getErrorMessage(scopeQuery.error, t("settings_integrations.employees.error_load_list"))}
        </p>
        <Button variant="outline" className="mt-3 h-10" onClick={() => void scopeQuery.refetch()}>
          {t("settings_integrations.employees.btn_retry")}
        </Button>
      </div>
    );
  }

  const visibleIds = visible.map((employee) => employee.employeeId);
  const visibleSelectedCount = visibleIds.filter((id) => selected.has(id)).length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{t("settings_integrations.employees.title")}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {t("settings_integrations.employees.description")}
            </p>
          </div>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-600">
            {t("settings_integrations.employees.enabled_of_total", { count: selected.size, total: employees.length })}
          </span>
        </div>

        {!configured ? (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-sm text-amber-700">
              {t("settings_integrations.employees.not_configured_notice")}
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="relative w-full sm:w-72">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("settings_integrations.employees.search_placeholder")}
              className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-brand-300"
            />
          </label>

          <select
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-brand-300"
          >
            <option value="">{t("settings_integrations.employees.filter_all_departments")}</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.title}
              </option>
            ))}
            <option value={NO_DEPARTMENT}>{t("settings_integrations.employees.filter_no_department")}</option>
          </select>

          <button
            type="button"
            onClick={() => toggleMany(visibleIds, true)}
            disabled={visibleIds.length === 0 || visibleSelectedCount === visibleIds.length}
            className="inline-flex h-10 items-center rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("settings_integrations.employees.btn_select_all")}
            {search || departmentId ? t("settings_integrations.employees.btn_select_all_found_suffix") : ""}
          </button>
          <button
            type="button"
            onClick={() => toggleMany(visibleIds, false)}
            disabled={visibleSelectedCount === 0}
            className="inline-flex h-10 items-center rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("settings_integrations.employees.btn_deselect")}
          </button>

          <div className="ml-auto flex items-center gap-2">
            {isDirty ? (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-medium text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
              >
                {t("settings_integrations.employees.btn_reset")}
              </button>
            ) : null}
            <Button
              onClick={() => void handleSave()}
              disabled={!isDirty || saveMutation.isLoading}
              startIcon={<Save className="h-4 w-4" />}
              className="h-10"
            >
              {saveMutation.isLoading ? t("settings_integrations.employees.btn_saving") : t("settings_integrations.employees.btn_save")}
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {groups.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-500">
            {t("settings_integrations.employees.empty_list")}
          </p>
        ) : (
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-gray-50">
                <th className="w-10 border-b border-gray-200 px-4 py-2.5" />
                <th className="border-b border-gray-200 px-4 py-2.5 text-left text-sm font-semibold text-gray-700">
                  {t("settings_integrations.employees.column_employee")}
                </th>
                <th className="border-b border-gray-200 px-4 py-2.5 text-left text-sm font-semibold text-gray-700">
                  {t("settings_integrations.employees.column_position")}
                </th>
                <th className="border-b border-gray-200 px-4 py-2.5 text-left text-sm font-semibold text-gray-700">
                  Time Doctor
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map(([key, group]) => {
                const ids = group.items.map((employee) => employee.employeeId);
                const selectedCount = ids.filter((id) => selected.has(id)).length;

                return [
                  <tr key={`group-${key}`} className="bg-gray-50/70">
                    <td className="border-b border-gray-100 px-4 py-2">
                      <TriCheckbox
                        ariaLabel={t("settings_integrations.employees.department_checkbox_aria", { title: group.title })}
                        checked={selectedCount === ids.length && ids.length > 0}
                        indeterminate={selectedCount > 0}
                        onChange={(checked) => toggleMany(ids, checked)}
                      />
                    </td>
                    <td
                      colSpan={3}
                      className="border-b border-gray-100 px-4 py-2 text-sm font-semibold text-gray-700"
                    >
                      {group.title}
                      <span className="ml-2 text-xs font-normal text-gray-400">
                        {t("settings_integrations.employees.department_selected_count", { selected: selectedCount, total: ids.length })}
                      </span>
                    </td>
                  </tr>,
                  ...group.items.map((employee) => (
                    <tr key={employee.employeeId} className="hover:bg-gray-50">
                      <td className="border-b border-gray-100 px-4 py-2.5">
                        <TriCheckbox
                          ariaLabel={employee.name}
                          checked={selected.has(employee.employeeId)}
                          onChange={(checked) => toggleOne(employee.employeeId, checked)}
                        />
                      </td>
                      <td className="border-b border-gray-100 px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                            style={{ backgroundColor: avatarColor(employee.name) }}
                          >
                            {getInitials(employee.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-800">
                              {employee.name}
                            </p>
                            {employee.email ? (
                              <p className="truncate text-xs text-gray-400">{employee.email}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="border-b border-gray-100 px-4 py-2.5 text-sm text-gray-600">
                        {employee.position || "—"}
                      </td>
                      <td className="border-b border-gray-100 px-4 py-2.5">
                        {employee.hasMapping ? (
                          <span className="text-xs font-medium text-emerald-600">{t("settings_integrations.employees.status_connected")}</span>
                        ) : (
                          <span
                            className="text-xs font-medium text-amber-600"
                            title={t("settings_integrations.employees.status_not_in_td_tooltip")}
                          >
                            {t("settings_integrations.employees.status_not_in_td")}
                          </span>
                        )}
                      </td>
                    </tr>
                  )),
                ];
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
