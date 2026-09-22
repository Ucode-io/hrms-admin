import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, UserPlus } from "lucide-react";
import { Dropdown } from "../../../components/ui/dropdown/Dropdown";
import { type Employee, useEmployeesQuery } from "../../../api/services/employee.service";
import { STICKY_TITLE_CLASS, TITLE_CELL } from "../constants";
import type { BudgetEmployeeOption } from "../types";

interface AddRowLineProps {
  /** Уже добавленные в бюджет — показываем, но выбрать нельзя. */
  usedEmployeeIds: Set<string>;
  onPickEmployee: (employee: BudgetEmployeeOption) => void;
  onCreateVacancy: () => void;
}

const PAGE_LIMIT = 20;

/** `useEmployeesQuery` отдаёт ответ items API без типа — сужаем его здесь. */
type EmployeesPage = { count?: number; response?: Employee[] };

const text = (value: unknown): string => (typeof value === "string" ? value : "");

const employeeName = (employee: Employee): string => {
  const fullName = [text(employee.second_name), text(employee.first_name)]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || text(employee.email) || employee.guid;
};

/**
 * Приглашение добавить строку в конце блока отдела.
 *
 * Действие стоит там, где строка появится, а не кнопкой в панели сверху. Оба
 * типа строк — сотрудник и вакансия — живут в одном меню: выбор между ними и
 * есть главное решение при добавлении.
 *
 * Сотрудники грузятся тем же запросом, что и страница «Сотрудники»
 * (`useEmployeesQuery`): он отбирает людей по роли сотрудника и активному
 * статусу, поэтому в списке не появляются служебные записи `user_base` без
 * имени. Постранично и с поиском на сервере — весь штат тянуть в выпадашку
 * незачем.
 */
export default function AddRowLine({ usedEmployeeIds,
  onPickEmployee,
  onCreateVacancy,
}: AddRowLineProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [loaded, setLoaded] = useState<Employee[]>([]);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  // Новый поиск — это новая выборка: накопленные страницы прежнего запроса к
  // ней отношения не имеют.
  useEffect(() => {
    setPage(0);
    setLoaded([]);
  }, [debouncedSearch]);

  const { data: rawData, isFetching, isError } = useEmployeesQuery({
    limit: PAGE_LIMIT,
    offset: page * PAGE_LIMIT,
    status: "active",
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    enabled: isOpen,
  });

  const data = rawData as EmployeesPage | undefined;

  useEffect(() => {
    if (!data) return;

    setLoaded((prev) => {
      const chunk = (data.response ?? []).filter((employee) => Boolean(employee?.guid));
      if (page === 0) return chunk;

      const seen = new Set(prev.map((employee) => employee.guid));
      return [...prev, ...chunk.filter((employee) => !seen.has(employee.guid))];
    });
  }, [data, page]);

  const total = data?.count ?? 0;
  const hasMore = loaded.length < total;

  const options = useMemo(
    () =>
      loaded.map((employee) => ({
        id: employee.guid,
        name: employeeName(employee),
        position: text(employee.positions_id_data?.title),
      })),
    [loaded]
  );

  const close = () => {
    setSearch("");
    setIsOpen(false);
  };

  /** Подгружаем следующую страницу, когда список докрутили почти до конца. */
  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (!hasMore || isFetching) return;

    const element = event.currentTarget;
    if (element.scrollTop + element.clientHeight < element.scrollHeight - 80) return;

    setPage((prev) => prev + 1);
  };

  return (
    <div className="flex items-stretch border-t border-gray-100 bg-white">
      <div className={`py-1.5 pl-2 pr-3 ${TITLE_CELL} ${STICKY_TITLE_CLASS} bg-white`}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className="dropdown-toggle ml-7 flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-gray-400 transition hover:bg-brand-50 hover:text-brand-600"
        >
          <Plus size={14} className="shrink-0" />
          Строка
        </button>

        <Dropdown
          isOpen={isOpen}
          onClose={close}
          usePortal
          anchorEl={triggerRef.current}
          className="w-72 p-1.5"
        >
          <button
            type="button"
            onClick={() => {
              close();
              onCreateVacancy();
            }}
            className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-gray-700 transition hover:bg-brand-50 hover:text-brand-600"
          >
            <UserPlus size={15} className="shrink-0 text-gray-400" />
            <span className="min-w-0">
              <span className="block font-medium">Вакансия</span>
              <span className="block text-[11px] text-gray-400">
                Свободная строка под план найма
              </span>
            </span>
          </button>

          <div className="relative mb-1 border-t border-gray-100 pt-1.5">
            <Search size={14} className="absolute left-2.5 top-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Сотрудник..."
              className="h-8 w-full rounded-lg border border-gray-200 pl-8 pr-2 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
            />
          </div>

          <div className="max-h-64 overflow-y-auto" onScroll={handleScroll}>
            {options.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-gray-400">
                {isFetching
                  ? "Загружаем..."
                  : isError
                    ? "Не удалось загрузить список сотрудников"
                    : "Никого не нашли"}
              </p>
            ) : (
              <>
                {options.map((employee) => {
                  const used = usedEmployeeIds.has(employee.id);
                  return (
                    <button
                      key={employee.id}
                      type="button"
                      disabled={used}
                      onClick={() => {
                        close();
                        onPickEmployee({ id: employee.id, name: employee.name, positionId: null });
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                        used
                          ? "cursor-not-allowed text-gray-300"
                          : "text-gray-700 hover:bg-brand-50 hover:text-brand-600"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate">{employee.name}</span>
                        {employee.position && (
                          <span className="block truncate text-[11px] text-gray-400">
                            {employee.position}
                          </span>
                        )}
                      </span>
                      {used && <span className="shrink-0 text-[11px]">уже в бюджете</span>}
                    </button>
                  );
                })}

                {(hasMore || isFetching) && (
                  <p className="px-2 py-2 text-center text-[11px] text-gray-400">
                    {isFetching ? "Загружаем ещё..." : "Прокрутите, чтобы загрузить ещё"}
                  </p>
                )}
              </>
            )}
          </div>
        </Dropdown>
      </div>
    </div>
  );
}
