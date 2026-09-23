import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Search, UserPlus } from "lucide-react";
import { fetchEmployeesList } from "../../../../api/services/employee.service";
import type { TaskEmployee } from "../../types";
import Popover from "../ui/Popover";
import { ClearButton, ControlButton, FieldSlot, type ControlVariant } from "../ui/controls";
import { AvatarStack, EmployeeAvatar } from "../badges";
import { useTranslation } from "../../../../i18n";
import type { MessageKey } from "../../../../i18n/messages";

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

/** Подпись показывается от двух человек, так что формы «one» здесь не бывает. */
const assigneesCountKey = (count: number): MessageKey => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "tasks.assignee.count_few";
  return "tasks.assignee.count_many";
};

/** Цвет аватара выводим из id — тот же приём, что в task.service. */
const AVATAR_COLORS = ["#465fff", "#12b76a", "#f79009", "#f04438", "#7c4dff", "#0ba5ec"];
const colorFromId = (id: string): string => {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash + id.charCodeAt(index)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[hash];
};

interface AssigneeFieldProps {
  value: string[];
  /** Сотрудники, уже известные экрану (исполнители задач) — для аватаров. */
  employees: TaskEmployee[];
  onChange: (assigneeIds: string[]) => void;
  variant: ControlVariant;
  placeholder?: string;
}

/**
 * Множественный выбор исполнителей.
 *
 * Список не грузится целиком: страницы по 25 подтягиваются по скроллу, поиск
 * уходит на сервер (items API уже умеет `search` / `offset`). Прежний вариант
 * тянул всех сотрудников компании на каждое открытие поповера.
 */
export default function AssigneeField({
  value,
  employees,
  onChange,
  variant,
  placeholder,
}: AssigneeFieldProps) {
  const { t } = useTranslation();
  placeholder ??= t("tasks.assignee.not_assigned");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<TaskEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  /**
   * Все, кого мы уже видели: исполнители задач + подгруженные страницы. Нужен,
   * чтобы выбранный человек не пропадал из плашки после нового поиска.
   */
  const [known, setKnown] = useState<Record<string, TaskEmployee>>({});

  useEffect(() => {
    setKnown((prev) => {
      const next = { ...prev };
      employees.forEach((employee) => {
        next[employee.id] = employee;
      });
      return next;
    });
  }, [employees]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const loadPage = useCallback(
    async (reset: boolean) => {
      setIsLoading(true);
      try {
        const offset = reset ? 0 : offsetRef.current;
        const { count, response } = await fetchEmployeesList({
          limit: PAGE_SIZE,
          offset,
          search: debouncedQuery || undefined,
        });

        const page: TaskEmployee[] = response.map((employee) => ({
          id: employee.guid,
          name:
            [employee.second_name, employee.first_name].filter(Boolean).join(" ").trim() ||
            t("tasks.assignee.no_name"),
          position:
            (employee.positions_id_data as { title?: string } | null)?.title ?? "",
          color: colorFromId(employee.guid),
        }));

        offsetRef.current = offset + page.length;
        setItems((prev) => (reset ? page : [...prev, ...page]));
        setHasMore(offsetRef.current < count);
        setKnown((prev) => {
          const next = { ...prev };
          page.forEach((employee) => {
            next[employee.id] = employee;
          });
          return next;
        });
      } catch {
        setHasMore(false);
      } finally {
        setIsLoading(false);
      }
    },
    [debouncedQuery, t]
  );

  // Открытие поповера и новый запрос начинают список заново.
  useEffect(() => {
    if (!open) return;
    offsetRef.current = 0;
    void loadPage(true);
    listRef.current?.scrollTo({ top: 0 });
  }, [open, loadPage]);

  const handleScroll = () => {
    const node = listRef.current;
    if (!node || isLoading || !hasMore) return;
    if (node.scrollHeight - node.scrollTop - node.clientHeight < 80) void loadPage(false);
  };

  const selected = useMemo(
    () =>
      value
        .map((id) => known[id])
        .filter((employee): employee is TaskEmployee => Boolean(employee)),
    [value, known]
  );

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);

  // В узком сайдбаре второе имя не влезает, а стопка аватаров и так говорит,
  // кто назначен — поэтому подпись раскрывается только в широкой плашке.
  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0].name
        : variant === "chip"
          ? t(assigneesCountKey(selected.length), { count: selected.length })
          : "";

  return (
    <FieldSlot>
      <Popover
        open={open}
        onOpenChange={setOpen}
        width={320}
        content={() => (
          <div className="flex max-h-[320px] flex-col">
            <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 dark:border-gray-800">
              <Search size={14} className="shrink-0 text-gray-400" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("tasks.assignee.search_placeholder")}
                className="w-full bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-200"
              />
              {isLoading && <Loader2 size={14} className="shrink-0 animate-spin text-gray-400" />}
            </div>

            <div
              ref={listRef}
              onScroll={handleScroll}
              className="custom-scrollbar flex-1 overflow-y-auto py-1"
            >
              {items.map((employee) => (
                <button
                  key={employee.id}
                  type="button"
                  onClick={() => toggle(employee.id)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  <EmployeeAvatar employee={employee} size={24} />
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-gray-200">
                    {employee.name}
                  </span>
                  {employee.position && (
                    <span className="shrink-0 truncate text-theme-xs text-gray-400">
                      {employee.position}
                    </span>
                  )}
                  {value.includes(employee.id) && (
                    <Check size={14} className="shrink-0 text-brand-500" />
                  )}
                </button>
              ))}

              {items.length === 0 && !isLoading && (
                <p className="px-3 py-6 text-center text-sm text-gray-400">
                  {t("tasks.assignee.no_employees_found")}
                </p>
              )}

              {isLoading && items.length > 0 && (
                <p className="py-2 text-center text-theme-xs text-gray-400">{t("tasks.assignee.loading")}</p>
              )}
            </div>

            {value.length > 0 && (
              <div className="border-t border-gray-100 p-1 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-gray-500 transition hover:bg-gray-50 hover:text-error-600 dark:hover:bg-white/5"
                >
                  {t("tasks.assignee.clear_all")}
                </button>
              </div>
            )}
          </div>
        )}
      >
        {({ ref, props }) => (
          <ControlButton
            ref={ref}
            variant={variant}
            open={open}
            active={selected.length > 0}
            muted={selected.length === 0}
            hasClear={selected.length > 0}
            className="max-w-full"
            {...props}
          >
            {selected.length > 0 ? (
              <AvatarStack employees={selected} size={22} />
            ) : (
              <UserPlus size={15} className="shrink-0 text-gray-400" />
            )}
            {label && <span className="min-w-0 flex-1 truncate text-left">{label}</span>}
          </ControlButton>
        )}
      </Popover>
      {selected.length > 0 && (
        <ClearButton onClick={() => onChange([])} label={t("tasks.assignee.remove_assignees")} />
      )}
    </FieldSlot>
  );
}
