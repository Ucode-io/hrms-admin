// Форма ручного времени: HR заводит часы за сотрудника, запись уходит на
// согласование со статусом «Ожидает».
//
// Две формы ввода — интервал «с — по» и голая длительность: часто помнят
// только «три часа», а требовать выдуманные 09:00–12:00 значит портить данные.
// Интервал через полночь не поддерживается (сервер это тоже отклоняет):
// запись принадлежит одному дню табеля, и вторая половина ушла бы в другой
// день незаметно для итогов — такие случаи вводятся двумя записями.

import { useEffect, useMemo, useState } from "react";
import { Modal } from "../../../components/ui/modal";
import type { TimesheetDirectoryItem, TimesheetEmployee, TimesheetEntry } from "../types";
import type { ManualTimeSavePayload } from "../../../api/services/manualTime.service";
import { formatDuration } from "../constants";
import TimeInput from "../../../components/form/TimeInput";
import DateInput from "../../../components/form/DateInput";

interface ManualTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: TimesheetEmployee[];
  projects: TimesheetDirectoryItem[];
  tasks: TimesheetDirectoryItem[];
  /** Запись в правку; `null` — создание. */
  entry: TimesheetEntry | null;
  defaultDate: string;
  isSaving: boolean;
  error: string;
  onSubmit: (payload: ManualTimeSavePayload) => void;
}

type Mode = "interval" | "duration";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const toMinutes = (value: string): number | null => {
  const match = TIME_PATTERN.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

const inputClass =
  "h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";

const labelClass = "mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400";

export default function ManualTimeModal({
  isOpen,
  onClose,
  employees,
  projects,
  tasks,
  entry,
  defaultDate,
  isSaving,
  error,
  onSubmit,
}: ManualTimeModalProps) {
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [mode, setMode] = useState<Mode>("interval");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [hours, setHours] = useState("1");
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");

  // Форма пересобирается при каждом открытии: иначе прошлый черновик всплывал
  // бы поверх новой записи.
  useEffect(() => {
    if (!isOpen) return;
    setFormError("");
    setEmployeeId(entry?.employeeId ?? "");
    setDate(entry?.date || defaultDate);
    setProjectId(entry?.projectId ?? "");
    setTaskId(entry?.taskId ?? "");
    setReason(entry?.reason ?? "");

    const hasInterval = Boolean(entry?.startTime && entry?.endTime);
    setMode(entry && !hasInterval ? "duration" : "interval");
    setStartTime(entry?.startTime || "09:00");
    setEndTime(entry?.endTime || "18:00");
    setHours(
      entry && !hasInterval
        ? String(Math.round(((entry.durationSeconds || 0) / 3600) * 100) / 100)
        : "1"
    );
  }, [isOpen, entry, defaultDate]);

  const visibleTasks = useMemo(
    () => (projectId ? tasks.filter((task) => !task.projectId || task.projectId === projectId) : tasks),
    [tasks, projectId]
  );

  const previewSeconds = useMemo(() => {
    if (mode === "interval") {
      const start = toMinutes(startTime);
      const end = toMinutes(endTime);
      if (start == null || end == null || end <= start) return 0;
      return (end - start) * 60;
    }
    const parsed = Number(hours.replace(",", "."));
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 3600) : 0;
  }, [mode, startTime, endTime, hours]);

  const handleSubmit = () => {
    if (!employeeId) {
      setFormError("Выберите сотрудника");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setFormError("Укажите дату");
      return;
    }
    if (!reason.trim()) {
      setFormError("Укажите причину: по ней согласующий понимает, за что часы");
      return;
    }
    if (previewSeconds <= 0) {
      setFormError(
        mode === "interval"
          ? "Окончание должно быть позже начала (в пределах одного дня)"
          : "Укажите положительную длительность"
      );
      return;
    }

    const project = projects.find((item) => item.id === projectId);
    const task = visibleTasks.find((item) => item.id === taskId);

    setFormError("");
    onSubmit({
      ...(entry?.id ? { guid: entry.id } : {}),
      user_base_id: employeeId,
      work_date: date,
      ...(mode === "interval"
        ? { start_time: startTime, end_time: endTime }
        : { duration_minutes: Math.round(previewSeconds / 60) }),
      ...(projectId ? { project_id: projectId, project_name: project?.name ?? "" } : {}),
      ...(taskId ? { task_id: taskId, task_name: task?.name ?? "" } : {}),
      reason: reason.trim(),
    });
  };

  const message = formError || error;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[560px] p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white/90">
        {entry ? "Изменить запись" : "Добавить время"}
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Запись появится в табеле со статусом «Ожидает» и попадёт в отработанное время
        после подтверждения.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass}>Сотрудник</label>
          <select
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
            className={inputClass}
            disabled={Boolean(entry)}
          >
            <option value="">Выберите сотрудника</option>
            {employees.map((employee) => (
              <option key={employee.employeeId} value={employee.employeeId}>
                {employee.name}
                {employee.department ? ` — ${employee.department}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Дата</label>
          <DateInput value={date} onChange={setDate} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Как задать время</label>
          <div className="inline-flex h-10 w-full rounded-xl border border-gray-200 p-0.5 dark:border-gray-700">
            {(
              [
                { key: "interval", label: "С — по" },
                { key: "duration", label: "Длительность" },
              ] as { key: Mode; label: string }[]
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setMode(item.key)}
                className={`flex-1 rounded-lg text-sm font-medium transition ${
                  mode === item.key
                    ? "bg-brand-500 text-white"
                    : "text-gray-600 hover:bg-gray-50 dark:text-gray-300"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {mode === "interval" ? (
          <>
            <div>
              <label className={labelClass}>Начало</label>
              <TimeInput
                value={startTime}
                onChange={(next) => setStartTime(next)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Окончание</label>
              <TimeInput
                value={endTime}
                onChange={(next) => setEndTime(next)}
                className={inputClass}
              />
            </div>
          </>
        ) : (
          <div>
            <label className={labelClass}>Часов</label>
            <input
              type="number"
              min="0.25"
              step="0.25"
              value={hours}
              onChange={(event) => setHours(event.target.value)}
              className={inputClass}
            />
          </div>
        )}

        <div>
          <label className={labelClass}>Проект</label>
          <select
            value={projectId}
            onChange={(event) => {
              setProjectId(event.target.value);
              setTaskId("");
            }}
            className={inputClass}
          >
            <option value="">Без проекта</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Задача</label>
          <select
            value={taskId}
            onChange={(event) => setTaskId(event.target.value)}
            className={inputClass}
          >
            <option value="">Без задачи</option>
            {visibleTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.name}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass}>Причина</label>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            placeholder="Например: работа на площадке клиента без трекера"
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          К начислению: <strong className="text-gray-800 dark:text-white/90">
            {formatDuration(previewSeconds)}
          </strong>
        </span>
        {message ? <span className="text-sm text-error-600">{message}</span> : null}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="h-10 rounded-xl border border-gray-200 px-4 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-300"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving}
          className="h-10 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60"
        >
          {isSaving ? "Сохранение…" : entry ? "Сохранить" : "Отправить на согласование"}
        </button>
      </div>
    </Modal>
  );
}
