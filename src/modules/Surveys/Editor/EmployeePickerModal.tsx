import { useEffect, useMemo, useState } from "react";

import { Search, X } from "lucide-react";
import Select from "react-select";
import Button from "../../../components/ui/button/Button";
import { Modal } from "../../../components/ui/modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import Pagination from "../../../components/pagination";
import {
  type Employee,
  fetchEmployeesList,
  useEmployeesQuery,
} from "../../../api/services/employee.service";
import { useDepartmentsSettingsQuery } from "../../../api/services/department.service";
import { resolveEmployeeFullName } from "../../../components/autocomplete/EmployeesInfiniteMultiSelect";
import { getDepartmentSelectStyles } from "../../Settings/Departments/utils";

type Option = {
  value: string;
  label: string;
};

interface EmployeePickerModalProps {
  isOpen: boolean;
  /** Already selected employee ids (the modal edits a copy until "Добавить"). */
  value: string[];
  onClose: () => void;
  /** Called with the full new selection (ids) and labels for the new ones. */
  onApply: (ids: string[], labels: Option[]) => void;
}

const PAGE_SIZE = 10;

export default function EmployeePickerModal({ isOpen,
  value,
  onClose,
  onApply,
}: EmployeePickerModalProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [selected, setSelected] = useState<Map<string, string>>(new Map());

  // Re-seed local selection each time the modal opens.
  useEffect(() => {
    if (!isOpen) return;
    setSelected(new Map(value.map((id) => [id, ""])));
    setSearchValue("");
    setDebouncedSearch("");
    setDepartmentId("");
    setCurrentPage(1);
  }, [isOpen, value]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
      setCurrentPage(1);
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [searchValue]);

  const { data: departmentsData } = useDepartmentsSettingsQuery({
    params: { limit: 200, offset: 0 },
  });

  const departmentOptions = useMemo<Option[]>(() => {
    const departments = departmentsData?.response || [];
    const options: Option[] = [{ value: "", label: "Все департаменты" }];
    for (const dep of [...departments].sort((a, b) =>
      String(a.title || "").localeCompare(String(b.title || ""), "ru")
    )) {
      options.push({ value: dep.guid, label: String(dep.title || "Без названия") });
    }
    return options;
  }, [departmentsData?.response]);

  const selectedDepartmentOption =
    departmentOptions.find((option) => option.value === departmentId) || departmentOptions[0];

  const { data, isLoading, isFetching } = useEmployeesQuery({
    limit: PAGE_SIZE,
    offset: (currentPage - 1) * PAGE_SIZE,
    status: "active",
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(departmentId ? { departments_id: [departmentId] } : {}),
    enabled: isOpen,
  });

  const employees: Employee[] = data?.response || [];
  const totalCount = Number(data?.count || 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const toggleEmployee = (employee: Employee) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(employee.guid)) {
        next.delete(employee.guid);
      } else {
        next.set(employee.guid, resolveEmployeeFullName(employee));
      }
      return next;
    });
  };

  const pageAllSelected =
    employees.length > 0 && employees.every((employee) => selected.has(employee.guid));

  const togglePage = () => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (pageAllSelected) {
        for (const employee of employees) next.delete(employee.guid);
      } else {
        for (const employee of employees) next.set(employee.guid, resolveEmployeeFullName(employee));
      }
      return next;
    });
  };

  const [isSelectingAll, setIsSelectingAll] = useState(false);

  // Select EVERY employee matching the current search/department filter (all
  // pages) — this is how a whole department is added at once.
  const selectAllFiltered = async () => {
    setIsSelectingAll(true);
    try {
      const limit = 200;
      const maxRequests = 50;
      let offset = 0;
      const next = new Map(selected);

      for (let requestIndex = 0; requestIndex < maxRequests; requestIndex += 1) {
        const chunk = await fetchEmployeesList({
          limit,
          offset,
          status: "active",
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(departmentId ? { departments_id: [departmentId] } : {}),
        });

        for (const employee of chunk.response) {
          next.set(employee.guid, resolveEmployeeFullName(employee));
        }

        offset += chunk.response.length;
        if (chunk.response.length < limit || (chunk.count > 0 && offset >= chunk.count)) {
          break;
        }
      }

      setSelected(next);
    } finally {
      setIsSelectingAll(false);
    }
  };

  const handleApply = () => {
    const ids = Array.from(selected.keys());
    const labels: Option[] = [];
    for (const [id, label] of selected) {
      if (label) labels.push({ value: id, label });
    }
    onApply(ids, labels);
    onClose();
  };

  const menuPortalTarget = typeof document !== "undefined" ? document.body : undefined;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={false}
      className="mx-4 w-full max-w-[760px] overflow-hidden rounded-2xl border border-gray-200 shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3.5">
        <h3 className="text-lg font-semibold text-gray-900">Выбор сотрудников</h3>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          aria-label="Закрыть"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3">
        <label className="relative block min-w-[220px] flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Поиск сотрудника..."
            className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
          />
        </label>

        <div className="min-w-[220px]">
          <Select
            options={departmentOptions}
            value={selectedDepartmentOption}
            onChange={(option) => {
              setDepartmentId(option?.value || "");
              setCurrentPage(1);
            }}
            isSearchable
            styles={getDepartmentSelectStyles()}
            menuPortalTarget={menuPortalTarget}
            menuPosition="fixed"
            classNamePrefix="employee-picker-department-select"
            noOptionsMessage={() => "Ничего не найдено"}
          />
        </div>
      </div>

      <div className="max-h-[46vh] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 border-b border-gray-100 bg-white">
            <TableRow>
              <TableCell isHeader className="w-12 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={pageAllSelected}
                  onChange={togglePage}
                  className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-brand-500"
                  aria-label="Выбрать всех на странице"
                />
              </TableCell>
              <TableCell isHeader className="px-4 py-2.5 text-left text-theme-xs font-medium text-gray-500">
                Сотрудник
              </TableCell>
              <TableCell isHeader className="px-4 py-2.5 text-left text-theme-xs font-medium text-gray-500">
                Департамент
              </TableCell>
              <TableCell isHeader className="px-4 py-2.5 text-left text-theme-xs font-medium text-gray-500">
                Должность
              </TableCell>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-gray-100">
            {isLoading || isFetching ? (
              Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={`picker-skeleton-${index}`}>
                  <TableCell className="px-4 py-3">
                    <div className="h-4 w-4 animate-pulse rounded bg-gray-200" />
                  </TableCell>
                  {Array.from({ length: 3 }).map((__, cellIndex) => (
                    <TableCell key={cellIndex} className="px-4 py-3">
                      <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                  Сотрудники не найдены
                </TableCell>
              </TableRow>
            ) : (
              employees.map((employee) => {
                const isChecked = selected.has(employee.guid);
                return (
                  <TableRow
                    key={employee.guid}
                    className="cursor-pointer transition-colors hover:bg-gray-50"
                    onClick={() => toggleEmployee(employee)}
                  >
                    <TableCell className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleEmployee(employee)}
                        onClick={(event) => event.stopPropagation()}
                        className="h-4 w-4 cursor-pointer rounded border-gray-300 accent-brand-500"
                        aria-label={`Выбрать ${resolveEmployeeFullName(employee)}`}
                      />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-800">
                      {resolveEmployeeFullName(employee)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-600">
                      {String(employee.departments_id_data?.title || "—")}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-gray-600">
                      {String(employee.positions_id_data?.title || "—")}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        limit={PAGE_SIZE}
        onPageChange={setCurrentPage}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            Выбрано: <span className="font-semibold text-gray-900">{selected.size}</span>
          </span>
          <button
            type="button"
            onClick={() => void selectAllFiltered()}
            disabled={isSelectingAll || totalCount === 0}
            className="text-sm font-medium text-brand-500 transition hover:text-brand-600 disabled:cursor-not-allowed disabled:text-gray-300"
          >
            {isSelectingAll ? "Выбираем..." : `Выбрать всех по фильтру (${totalCount})`}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose} className="min-w-[96px] px-3 py-2 text-sm">
            Отмена
          </Button>
          <Button onClick={handleApply} className="min-w-[110px] px-3 py-2 text-sm">
            Применить
          </Button>
        </div>
      </div>
    </Modal>
  );
}
