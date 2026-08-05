import { Fragment, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Check, ChevronLeft, ChevronRight, Clock, PencilLine, Plus, X } from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../components/common/PageMeta";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { useHeaderBreadcrumbItems } from "../../context/HeaderBreadcrumbContext";
import companyStore from "../../store/company.store";
import {
  useTimesheetDayQuery,
  useTimesheetListQuery,
} from "../../api/services/timesheet.service";
import { EMPTY_FILTERS } from "./components/FiltersBar";
import { formatDateRu, formatDuration, shiftDays } from "./constants";
import { EmployeeAvatar, SourceBadge } from "./components/badges";
import DayTimeline, { type TimelineGap } from "./components/DayTimeline";
import ConfirmDeleteModal from "./components/ConfirmDeleteModal";
import {
  useDeleteManualTime,
  useSaveManualTime,
} from "../../api/services/manualTime.service";
import { useManualTimeApproval } from "./useManualTimeApproval";
import ApprovalProcessModal from "../../components/approvals/ApprovalProcessModal";
import ApprovalProgressButton from "../../components/approvals/ApprovalProgressButton";
import type { ManualTimeStatus, TimesheetEntry } from "./types";
import SummaryCards, { type SummaryItem } from "./components/SummaryCards";
import {
  EntriesSkeleton,
  Skeleton,
  SummaryCardsSkeleton,
  TimelineSkeleton,
} from "./components/DaySkeletons";

const STATUS_META: Record<ManualTimeStatus, { label: string; className: string }> = {
  pending: { label: "Ожидает", className: "bg-amber-100 text-amber-700" },
  approved: { label: "Подтверждено", className: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Отклонено", className: "bg-rose-100 text-rose-700" },
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const toMinutes = (value: string): number | null => {
  const match = TIME_PATTERN.exec(value.trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

const cellInput =
  "h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-700 outline-none transition focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";

/** Черновик ручной записи — та самая строка ввода под клик по таймлайну. */
type ManualDraft = {
  startTime: string;
  endTime: string;
  projectId: string;
  taskId: string;
  reason: string;
};

export default function TimesheetDayPage() {
  const { employeeId = "", date = "" } = useParams();
  const navigate = useNavigate();
  const brandColor = companyStore.mainColor || "#2563eb";
  /** Общая подсветка строки таблицы и её сегмента на таймлайне. */
  const [hoveredEntryId, setHoveredEntryId] = useState<string | null>(null);

  const { data, isError, error, isPreviousData } = useTimesheetDayQuery(employeeId, date);

  /**
   * Пока грузится соседний день, в `data` лежит предыдущий: сотрудник тот же —
   * его шапку показываем сразу, а цифры дня уже чужие, поэтому на их месте
   * скелетон. Из-за этого страница не схлопывается в спиннер на каждый клик по
   * стрелке даты.
   */
  const employee =
    data && (!data.employee.employeeId || data.employee.employeeId === employeeId)
      ? data.employee
      : null;
  const dayData = data && !isPreviousData ? data : null;
  const day = dayData?.day ?? null;
  const entries = dayData?.entries ?? [];
  // Через useMemo, а не `?? []` по месту: новый пустой массив на каждом рендере
  // сбрасывал бы мемоизацию списка задач под выбранным проектом.
  const dayProjects = useMemo(() => dayData?.projects ?? [], [dayData?.projects]);
  const dayTasks = useMemo(() => dayData?.tasks ?? [], [dayData?.tasks]);

  /**
   * Запасной источник справочников: `timesheet_day` отдаёт проекты и задачи
   * только с версии, где они добавлены, а страница должна работать и на
   * старой развёрнутой функции — иначе селекты в строке ввода пустые. Запрос
   * уходит одной записью и только когда день справочников не принёс.
   */
  const directoriesQuery = useTimesheetListQuery(
    { from: date, to: date },
    EMPTY_FILTERS,
    { limit: 1, offset: 0 },
    Boolean(date) && Boolean(dayData) && dayProjects.length === 0
  );

  const fallbackProjects = directoriesQuery.data?.projects;
  const fallbackTasks = directoriesQuery.data?.tasks;
  const projects = useMemo(
    () => (dayProjects.length ? dayProjects : fallbackProjects ?? []),
    [dayProjects, fallbackProjects]
  );
  const tasks = useMemo(
    () => (dayTasks.length ? dayTasks : fallbackTasks ?? []),
    [dayTasks, fallbackTasks]
  );

  // ── Ручное время ────────────────────────────────────────────────────────
  const [draft, setDraft] = useState<ManualDraft | null>(null);
  const [draftError, setDraftError] = useState("");
  const [entryToDelete, setEntryToDelete] = useState<TimesheetEntry | null>(null);
  const saveManual = useSaveManualTime();
  const deleteManual = useDeleteManualTime();

  // Согласование — тот же хук, что и в таблице табеля: подтвердить время можно
  // прямо там, где его завели, и правило «мимо этапов нельзя» одно на оба
  // экрана. Департамент у всех записей дня общий — он у сотрудника страницы.
  const approval = useManualTimeApproval(entries, () => employee?.departmentId);

  const draftMinutes = draft
    ? {
        from: toMinutes(draft.startTime),
        to: toMinutes(draft.endTime),
      }
    : null;
  const draftSeconds =
    draftMinutes && draftMinutes.from != null && draftMinutes.to != null
      ? Math.max(0, (draftMinutes.to - draftMinutes.from) * 60)
      : 0;

  const visibleTasks = useMemo(
    () =>
      draft?.projectId
        ? tasks.filter((task) => !task.projectId || task.projectId === draft.projectId)
        : tasks,
    [tasks, draft?.projectId]
  );

  const openDraft = (gap: TimelineGap) => {
    setDraftError("");
    setDraft({
      startTime: gap.startTime,
      endTime: gap.endTime,
      projectId: "",
      taskId: "",
      reason: "",
    });
  };

  const submitDraft = async () => {
    if (!draft) return;
    if (draftSeconds <= 0) {
      setDraftError("Окончание должно быть позже начала");
      return;
    }
    if (!draft.reason.trim()) {
      setDraftError("Укажите причину");
      return;
    }

    const project = projects.find((item) => item.id === draft.projectId);
    const task = visibleTasks.find((item) => item.id === draft.taskId);

    try {
      setDraftError("");
      await saveManual.mutateAsync({
        user_base_id: employeeId,
        work_date: date,
        start_time: draft.startTime,
        end_time: draft.endTime,
        ...(draft.projectId
          ? { project_id: draft.projectId, project_name: project?.name ?? "" }
          : {}),
        ...(draft.taskId ? { task_id: draft.taskId, task_name: task?.name ?? "" } : {}),
        reason: draft.reason.trim(),
      });
      setDraft(null);
      toast.success("Время добавлено и отправлено на согласование.");
    } catch (saveError) {
      setDraftError(
        saveError instanceof Error ? saveError.message : "Не удалось сохранить запись."
      );
    }
  };

  /** Удаление необратимо для пользователя, поэтому всегда через подтверждение. */
  const confirmDelete = async () => {
    if (!entryToDelete) return;
    try {
      await deleteManual.mutateAsync(entryToDelete.id);
      setEntryToDelete(null);
      toast.success("Запись удалена.");
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error ? deleteError.message : "Не удалось удалить запись."
      );
    }
  };

  useHeaderBreadcrumbItems(
    useMemo(
      () => [
        { label: "Табель времени", to: "/timesheet" },
        {
          label: employee ? `${employee.name} — ${formatDateRu(date)}` : formatDateRu(date),
          to: `/timesheet/${employeeId}/${date}`,
        },
      ],
      [employee, employeeId, date]
    )
  );

  const summaryItems = useMemo<SummaryItem[]>(() => {
    if (!dayData) return [];
    const { day } = dayData;
    const percent =
      day.planSeconds > 0 ? Math.round((day.workedSeconds / day.planSeconds) * 100) : 0;

    return [
      {
        label: "Отработано",
        value: formatDuration(day.workedSeconds),
        hint: `${day.entryCount} записей`,
        color: brandColor,
      },
      {
        label: "План",
        value: day.planSeconds > 0 ? formatDuration(day.planSeconds) : "Выходной",
        hint: day.planSeconds > 0 ? `Выполнено ${percent}%` : undefined,
      },
      {
        label: "Начало – Окончание",
        // Рабочий день Time Doctor может заканчиваться уже за полночь. Без
        // пометки «+1» такое окончание читается как «закончил до начала».
        value:
          day.firstStart && day.lastEnd
            ? `${day.firstStart.slice(11, 16)} – ${day.lastEnd.slice(11, 16)}${
                day.lastEnd.slice(0, 10) > day.date ? " (+1)" : ""
              }`
            : "—",
      },
      { label: "Перерывы", value: formatDuration(day.breakSeconds) },
      {
        label: "Статус дня",
        value: day.absence || day.holiday || (day.isDayOff ? "Выходной" : "Рабочий день"),
      },
    ];
  }, [dayData, brandColor]);

  /**
   * Строка ввода встаёт на своё место по времени начала — как в Time Doctor,
   * где промежуток редактируется там, где он и находится в списке.
   */
  const draftPosition = draft
    ? (() => {
        const index = entries.findIndex(
          (entry) => (entry.startTime || "99:99") >= draft.startTime
        );
        return index === -1 ? entries.length : index;
      })()
    : -1;

  const draftRow = draft ? (
    <TableRow className="bg-brand-50/50 dark:bg-brand-500/10">
      <TableCell className="whitespace-nowrap px-5 py-2.5">
        <input
          type="time"
          value={draft.startTime}
          onChange={(event) =>
            setDraft((prev) => (prev ? { ...prev, startTime: event.target.value } : prev))
          }
          className={cellInput}
        />
      </TableCell>
      <TableCell className="whitespace-nowrap px-5 py-2.5">
        <input
          type="time"
          value={draft.endTime}
          onChange={(event) =>
            setDraft((prev) => (prev ? { ...prev, endTime: event.target.value } : prev))
          }
          className={cellInput}
        />
      </TableCell>
      <TableCell className="whitespace-nowrap px-5 py-2.5 text-sm font-semibold text-gray-800 dark:text-white/90">
        {formatDuration(draftSeconds)}
      </TableCell>
      <TableCell className="px-5 py-2.5">
        <select
          value={draft.projectId}
          onChange={(event) =>
            setDraft((prev) =>
              prev ? { ...prev, projectId: event.target.value, taskId: "" } : prev
            )
          }
          className={cellInput}
        >
          <option value="">Без проекта</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </TableCell>
      <TableCell className="px-5 py-2.5">
        <select
          value={draft.taskId}
          onChange={(event) =>
            setDraft((prev) => (prev ? { ...prev, taskId: event.target.value } : prev))
          }
          className={cellInput}
        >
          <option value="">Без задачи</option>
          {visibleTasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.name}
            </option>
          ))}
        </select>
      </TableCell>
      <TableCell className="whitespace-nowrap px-5 py-2.5">
        <SourceBadge source="hrms_manual" />
      </TableCell>
      <TableCell className="px-5 py-2.5">
        <input
          type="text"
          value={draft.reason}
          onChange={(event) =>
            setDraft((prev) => (prev ? { ...prev, reason: event.target.value } : prev))
          }
          placeholder="Причина"
          autoFocus
          onKeyDown={(event) => {
            if (event.key === "Enter") void submitDraft();
            if (event.key === "Escape") setDraft(null);
          }}
          className={cellInput}
        />
        {draftError && <p className="mt-1 text-[11px] text-error-600">{draftError}</p>}
      </TableCell>
      <TableCell className="whitespace-nowrap px-5 py-2.5 text-right">
        <span className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setDraft(null);
              setDraftError("");
            }}
            disabled={saveManual.isLoading}
            title="Отмена"
            className="rounded-lg border border-gray-200 p-1.5 text-gray-400 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700"
          >
            <X size={15} />
          </button>
          <button
            type="button"
            onClick={() => void submitDraft()}
            disabled={saveManual.isLoading}
            title="Сохранить и отправить на согласование"
            className="rounded-lg bg-emerald-600 p-1.5 text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            <Check size={15} />
          </button>
        </span>
      </TableCell>
    </TableRow>
  ) : null;

  if (isError && !data) {
    return (
      <div className="rounded-2xl border border-error-200 bg-error-50 px-5 py-8 text-center text-sm text-error-600 dark:border-error-500/30 dark:bg-error-500/10">
        {error instanceof Error ? error.message : "Не удалось загрузить день табеля."}
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title={`${employee ? `${employee.name} — ` : ""}${formatDateRu(date)} | Табель времени`}
        description="Детализация отработанного времени за день"
      />

      {/* ── Шапка сотрудника ────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center gap-4">
          {employee ? (
            <>
              <EmployeeAvatar
                name={employee.name}
                photo={employee.photo}
                seed={employee.employeeId}
                size={52}
              />
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold text-gray-800 dark:text-white/90">
                  {employee.name}
                </h1>
                <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                  {[employee.position, employee.department].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
            </>
          ) : (
            <>
              <Skeleton className="h-[52px] w-[52px] rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-3.5 w-32" />
              </div>
            </>
          )}

          {/* Соседние дни: разбор дня почти всегда продолжается вчера/завтра.
              Переключатель тот же, что в «Время → Посещаемость». */}
          <div
            className="ml-auto"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "3px",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              backgroundColor: "#f8fafc",
              height: "38px",
            }}
          >
            <button
              type="button"
              onClick={() => navigate(`/timesheet/${employeeId}/${shiftDays(date, -1)}`)}
              className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-transparent text-slate-600 transition hover:border-slate-200 hover:bg-white"
              aria-label="Предыдущий день"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[150px] px-3 text-center text-[13px] font-semibold text-slate-700">
              {formatDateRu(date)}
            </span>
            <button
              type="button"
              onClick={() => navigate(`/timesheet/${employeeId}/${shiftDays(date, 1)}`)}
              className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-transparent text-slate-600 transition hover:border-slate-200 hover:bg-white"
              aria-label="Следующий день"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4">
        {day ? <SummaryCards items={summaryItems} /> : <SummaryCardsSkeleton />}
      </div>

      {/* ── Таймлайн дня ────────────────────────────────────────────────── */}
      <div className="mt-4">
        {day ? (
          <DayTimeline
            date={date}
            entries={entries}
            hoveredEntryId={hoveredEntryId}
            onHoverEntry={setHoveredEntryId}
            onGapClick={openDraft}
            draftRange={
              draft ? { startTime: draft.startTime, endTime: draft.endTime } : null
            }
          />
        ) : (
          <TimelineSkeleton />
        )}
      </div>

      {/* ── Записи дня ──────────────────────────────────────────────────── */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90">
            Записи времени за {formatDateRu(date)}
          </h2>
          {/* Дубль клика по таймлайну: когда день пустой или свободного окна на
              дорожке не видно, кнопка остаётся очевидным входом в ту же форму. */}
          <button
            type="button"
            onClick={() => openDraft({ startTime: "09:00", endTime: "18:00" })}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
          >
            <Plus size={14} />
            Добавить время
          </button>
        </div>

        {!day ? (
          <EntriesSkeleton />
        ) : entries.length === 0 && !draft ? (
          <div className="py-14 text-center">
            <Clock size={26} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {day.absence || (day.isDayOff ? "Выходной день" : "Записей за этот день нет")}
            </p>
            <button
              type="button"
              onClick={() => openDraft({ startTime: "09:00", endTime: "18:00" })}
              className="mt-3 text-sm font-semibold text-brand-500 hover:underline"
            >
              Добавить время вручную
            </button>
          </div>
        ) : (
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-gray-800">
                <TableRow>
                  {[
                    "Начало",
                    "Окончание",
                    "Длительность",
                    "Проект",
                    "Задача",
                    "Источник",
                    "Причина",
                    "",
                  ].map(
                    (header) => (
                      <TableCell
                        key={header}
                        isHeader
                        className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400"
                      >
                        {header}
                      </TableCell>
                    )
                  )}
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
                {entries.map((entry, index) => (
                  <Fragment key={entry.id}>
                  {index === draftPosition ? draftRow : null}
                  <TableRow
                    // Подсветка связывает строку с её сегментом на таймлайне —
                    // в обе стороны, поэтому состояние живёт на странице.
                    onMouseEnter={() => setHoveredEntryId(entry.id)}
                    onMouseLeave={() => setHoveredEntryId(null)}
                    className={`transition-colors ${
                      hoveredEntryId === entry.id
                        ? "bg-brand-50/70 dark:bg-brand-500/10"
                        : "hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                    }`}
                  >
                    <TableCell className="whitespace-nowrap px-5 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {entry.startTime || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-5 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {entry.endTime || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-5 py-3 text-sm font-semibold text-gray-800 dark:text-white/90">
                      {formatDuration(entry.durationSeconds)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-5 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {entry.projectName || "—"}
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate px-5 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {entry.taskName || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-5 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <SourceBadge source={entry.source} />
                        {entry.isManual && (
                          <span
                            className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                              STATUS_META[entry.status ?? "pending"].className
                            }`}
                            title={entry.reviewComment || undefined}
                          >
                            {STATUS_META[entry.status ?? "pending"].label}
                          </span>
                        )}
                        {entry.isEdited && (
                          <PencilLine
                            size={13}
                            className="text-amber-500"
                            aria-label="Запись правили в Time Doctor"
                          />
                        )}
                      </span>
                    </TableCell>
                    <TableCell
                      className="max-w-[240px] truncate px-5 py-3 text-xs text-gray-500 dark:text-gray-400"
                      title={entry.reason || undefined}
                    >
                      {entry.reason || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-5 py-3 text-right">
                      {entry.isManual && (
                        <span className="inline-flex items-center justify-end gap-1.5">
                          {(entry.status ?? "pending") === "pending" ? (
                            <>
                              <ApprovalProgressButton
                                approvedStages={approval.stagesOf(entry).approved}
                                totalStages={approval.stagesOf(entry).total || 1}
                                onClick={() => void approval.confirm(entry)}
                                disabled={approval.isReviewing}
                                label="Подтвердить"
                              />
                              <button
                                type="button"
                                onClick={() => void approval.review(entry, "rejected")}
                                disabled={approval.isReviewing}
                                className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[12px] font-semibold text-rose-600 transition hover:bg-rose-100 disabled:opacity-60"
                              >
                                Отклонить
                              </button>
                            </>
                          ) : (
                            approval.stagesOf(entry).process && (
                              // Финализированную запись открываем историей:
                              // видно, кто и когда одобрял.
                              <button
                                type="button"
                                onClick={() => approval.openApproval(entry)}
                                className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-[12px] font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
                              >
                                Согласование
                              </button>
                            )
                          )}
                          <button
                            type="button"
                            onClick={() => setEntryToDelete(entry)}
                            disabled={deleteManual.isLoading}
                            title="Удалить запись"
                            className="rounded-lg border border-gray-200 p-1.5 text-gray-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60 dark:border-gray-700"
                          >
                            <X size={14} />
                          </button>
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                  </Fragment>
                ))}
                {draftPosition === entries.length ? draftRow : null}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <ApprovalProcessModal {...approval.modalProps} />

      <ConfirmDeleteModal
        entry={entryToDelete}
        isDeleting={deleteManual.isLoading}
        onCancel={() => setEntryToDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
