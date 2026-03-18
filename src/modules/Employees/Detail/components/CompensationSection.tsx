import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, HandCoins, Pencil, Plus, Trash2 } from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Modal } from "../../../../components/ui/modal";
import {
  useCreateEmployeeCompensation,
  useDeleteEmployeeCompensation,
  useEmployeeCompensationsQuery,
  useUpdateEmployeeCompensation,
} from "../../../../api/services/employeeCompensation.service";

type CompensationSectionProps = {
  employeeGuid: string;
  brandColor: string;
};

type CompensationRecord = {
  guid: string;
  date: string;
  amount: number;
  description: string;
};

type CompensationDraft = {
  monthDate: Date | null;
  amount: string;
  description: string;
};

const toTime = (date: string) => {
  const ts = new Date(date).getTime();
  return Number.isNaN(ts) ? 0 : ts;
};

const parseMonthDate = (value: string): Date | null => {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }
  return new Date(year, month - 1, 1);
};

const toApiDateFromMonth = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
};

const formatMonthYear = (dateStr: string): string => {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "long",
  });
};

const formatAmount = (value: number): string => {
  return `${new Intl.NumberFormat("ru-RU").format(value)} сум`;
};

const today = new Date();

const EMPTY_DRAFT: CompensationDraft = {
  monthDate: new Date(today.getFullYear(), today.getMonth(), 1),
  amount: "",
  description: "",
};

function CompensationSection({ employeeGuid, brandColor }: CompensationSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuid, setEditingGuid] = useState<string | null>(null);
  const [draft, setDraft] = useState<CompensationDraft>(EMPTY_DRAFT);
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<CompensationRecord | null>(null);

  const { data, isLoading } = useEmployeeCompensationsQuery({
    userBaseId: employeeGuid,
    limit: 100,
    offset: 0,
  });

  const createMutation = useCreateEmployeeCompensation(employeeGuid);
  const updateMutation = useUpdateEmployeeCompensation(employeeGuid);
  const deleteMutation = useDeleteEmployeeCompensation(employeeGuid);

  const isSaving =
    createMutation.isLoading || updateMutation.isLoading || deleteMutation.isLoading;

  const records = useMemo<CompensationRecord[]>(() => {
    const rows = (data?.response || []).map((item) => {
      const amountRaw = item.amount;
      const parsedAmount =
        typeof amountRaw === "number"
          ? amountRaw
          : typeof amountRaw === "string"
            ? Number(amountRaw)
            : 0;

      return {
        guid: item.guid,
        date: typeof item.date === "string" ? item.date : "",
        amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
        description: typeof item.description === "string" ? item.description : "",
      };
    });

    return rows.sort((a, b) => toTime(b.date) - toTime(a.date));
  }, [data?.response]);

  const openCreate = () => {
    setEditingGuid(null);
    setDraft(EMPTY_DRAFT);
    setError("");
    setIsModalOpen(true);
  };

  const openEdit = (record: CompensationRecord) => {
    setEditingGuid(record.guid);
    setDraft({
      monthDate: parseMonthDate(record.date) || new Date(today.getFullYear(), today.getMonth(), 1),
      amount: record.amount > 0 ? String(record.amount) : "",
      description: record.description,
    });
    setError("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
    setEditingGuid(null);
    setDraft(EMPTY_DRAFT);
    setError("");
  };

  const handleSave = async () => {
    if (!draft.monthDate) {
      setError("Выберите год и месяц.");
      return;
    }

    const parsedAmount = Number(draft.amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Укажите корректную сумму.");
      return;
    }

    const payload = {
      user_base_id: employeeGuid,
      date: toApiDateFromMonth(draft.monthDate),
      amount: parsedAmount,
      description: draft.description.trim() || null,
    };

    try {
      if (editingGuid) {
        await updateMutation.mutateAsync({
          guid: editingGuid,
          ...payload,
        });
      } else {
        await createMutation.mutateAsync(payload);
      }
      closeModal();
    } catch (saveError) {
      console.error("Compensation save error:", saveError);
      setError("Не удалось сохранить запись. Попробуйте ещё раз.");
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteMutation.mutateAsync(toDelete.guid);
      setToDelete(null);
    } catch (deleteError) {
      console.error("Compensation delete error:", deleteError);
      setError("Не удалось удалить запись. Попробуйте ещё раз.");
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span style={{ color: brandColor }}>
              <HandCoins className="w-4 h-4" />
            </span>
            <h3 className="text-[15px] font-bold text-slate-900 m-0">Компенсация</h3>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold cursor-pointer transition-colors hover:bg-slate-50"
            style={{ color: brandColor }}
          >
            <Plus className="w-3.5 h-3.5" />
            Добавить
          </button>
        </div>

        <div className="px-6 py-5">
          {isLoading ? (
            <div className="py-8 flex items-center justify-center">
              <div
                className="w-7 h-7 rounded-full border-2 border-slate-200 animate-spin"
                style={{ borderTopColor: brandColor }}
              />
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
              <p className="m-0 text-[13px] text-slate-500">
                Записей о компенсациях пока нет
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-2 text-[12px] font-semibold text-slate-500">Период</th>
                    <th className="py-2 text-[12px] font-semibold text-slate-500">Сумма</th>
                    <th className="py-2 text-[12px] font-semibold text-slate-500">Описание</th>
                    <th className="py-2 text-[12px] font-semibold text-slate-500 text-right">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.guid} className="border-b border-slate-100">
                      <td className="py-3 text-[13px] text-slate-800">
                        {formatMonthYear(record.date)}
                      </td>
                      <td className="py-3 text-[13px] font-semibold text-slate-900">
                        {formatAmount(record.amount)}
                      </td>
                      <td className="py-3 text-[13px] text-slate-700">
                        {record.description || "—"}
                      </td>
                      <td className="py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(record)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
                            title="Изменить"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setToDelete(record)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-500 transition-colors hover:bg-rose-50"
                            title="Удалить"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        className="max-w-2xl w-full p-0 overflow-visible"
      >
        <div className="border-b border-slate-200 px-6 py-5">
          <h4 className="m-0 text-[22px] font-bold text-slate-900">
            {editingGuid ? "Изменить компенсацию" : "Добавить компенсацию"}
          </h4>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
              Год и месяц
            </label>
            <DatePicker
              selected={draft.monthDate}
              onChange={(date) =>
                setDraft((prev) => ({
                  ...prev,
                  monthDate: date
                    ? new Date(date.getFullYear(), date.getMonth(), 1)
                    : null,
                }))
              }
              showMonthYearPicker
              dateFormat="MM.yyyy"
              placeholderText="мм.гггг"
              popperClassName="compensation-month-picker-popper"
              calendarClassName="compensation-month-picker-calendar"
              wrapperClassName="compensation-month-picker-wrapper"
              showPopperArrow={false}
              renderCustomHeader={({
                date,
                decreaseYear,
                increaseYear,
                prevMonthButtonDisabled,
                nextMonthButtonDisabled,
              }) => (
                <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={decreaseYear}
                    disabled={prevMonthButtonDisabled}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-[14px] font-semibold text-slate-800">
                    {date.getFullYear()}
                  </span>
                  <button
                    type="button"
                    onClick={increaseYear}
                    disabled={nextMonthButtonDisabled}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
              Сумма
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={draft.amount}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, amount: event.target.value }))
              }
              placeholder="Например: 5000000"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
              Описание
            </label>
            <textarea
              rows={4}
              value={draft.description}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, description: event.target.value }))
              }
              placeholder="Например: Ежемесячный KPI бонус"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-800 outline-none transition focus:border-slate-300"
            />
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-600">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={closeModal}
            disabled={isSaving}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="h-9 rounded-lg border border-transparent px-4 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: brandColor }}
          >
            {isSaving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(toDelete)}
        onClose={() => !isSaving && setToDelete(null)}
        className="max-w-md w-full p-6"
        showCloseButton={false}
      >
        <h4 className="m-0 text-[18px] font-bold text-slate-900">
          Удалить компенсацию?
        </h4>
        <p className="mb-6 mt-2 text-[13px] text-slate-500">
          Запись будет удалена без возможности восстановления.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setToDelete(null)}
            disabled={isSaving}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isSaving}
            className="h-9 rounded-lg border border-rose-200 bg-rose-50 px-4 text-[13px] font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Удаление..." : "Удалить"}
          </button>
        </div>
      </Modal>
    </>
  );
}

export default CompensationSection;
