// Подтверждение удаления ручной записи — общее для таблицы табеля и страницы
// дня. Удаление мягкое, но необратимое для пользователя: восстановить запись
// из интерфейса нельзя, а у подтверждённой ещё и уменьшится «Отработано».
// Поэтому спрашиваем всегда и показываем, что именно удаляем.

import { Modal } from "../../../components/ui/modal";
import { formatDateRu, formatDuration } from "../constants";
import type { TimesheetEntry } from "../types";

interface ConfirmDeleteModalProps {
  entry: TimesheetEntry | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmDeleteModal({
  entry,
  isDeleting,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) {
  const interval =
    entry?.startTime && entry?.endTime ? `${entry.startTime} – ${entry.endTime}` : null;

  return (
    <Modal
      isOpen={Boolean(entry)}
      onClose={() => {
        if (!isDeleting) onCancel();
      }}
      className="w-full max-w-md p-6"
      showCloseButton={false}
    >
      <h4 className="m-0 text-[18px] font-bold text-slate-900 dark:text-white/90">
        Удалить запись ручного времени?
      </h4>

      {entry && (
        <p className="mt-2 text-[13px] text-slate-600 dark:text-gray-300">
          {formatDateRu(entry.date)}
          {interval ? `, ${interval}` : ""} · {formatDuration(entry.durationSeconds)}
          {entry.reason ? ` · ${entry.reason}` : ""}
        </p>
      )}

      <p className="mb-6 mt-2 text-[13px] text-slate-500 dark:text-gray-400">
        {entry?.status === "approved"
          ? "Запись уже подтверждена — после удаления её часы уйдут из «Отработано»."
          : "Восстановить запись из интерфейса будет нельзя."}
      </p>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={isDeleting}
          className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-transparent dark:text-gray-300"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isDeleting}
          className="h-9 rounded-lg border border-rose-200 bg-rose-50 px-4 text-[13px] font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isDeleting ? "Удаление..." : "Удалить"}
        </button>
      </div>
    </Modal>
  );
}
