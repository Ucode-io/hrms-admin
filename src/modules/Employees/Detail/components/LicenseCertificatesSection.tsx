import { useMemo, useState } from "react";
import { Award, CalendarDays, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { Modal } from "../../../../components/ui/modal";
import DateInput from "../../../../components/form/DateInput";
import {
  useCreateEmployeeCertificate,
  useDeleteEmployeeCertificate,
  useEmployeeCertificatesQuery,
  useUpdateEmployeeCertificate,
} from "../../../../api/services/employeeCertificate.service";

type LicenseCertificatesSectionProps = {
  employeeGuid: string;
  brandColor: string;
};

type LicenseRecord = {
  guid: string;
  title: string;
  issuer: string;
  credential_id: string;
  issue_date: string;
  expiration_date: string;
  no_expiration: boolean;
  credential_url: string;
  description: string;
};

type LicenseDraft = Omit<LicenseRecord, "guid">;

const EMPTY_DRAFT: LicenseDraft = {
  title: "",
  issuer: "",
  credential_id: "",
  issue_date: "",
  expiration_date: "",
  no_expiration: false,
  credential_url: "",
  description: "",
};

const toTime = (date: string) => {
  const ts = new Date(date).getTime();
  return Number.isNaN(ts) ? 0 : ts;
};

function formatMonthYear(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  const months = ["Янв.", "Февр.", "Март", "Апр.", "Май", "Июн.", "Июл.", "Авг.", "Сент.", "Окт.", "Нояб.", "Дек."];
  return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatValidity(
  issueDate: string,
  expirationDate: string,
  noExpiration: boolean
): string {
  const issueLabel = formatMonthYear(issueDate);
  const expLabel = formatMonthYear(expirationDate);
  if (!issueLabel) return "Дата не указана";
  if (noExpiration) return `${issueLabel} — бессрочно`;
  if (!expLabel) return `${issueLabel} —`;
  return `${issueLabel} — ${expLabel}`;
}

function LicenseCertificatesSection({
  employeeGuid,
  brandColor,
}: LicenseCertificatesSectionProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGuid, setEditingGuid] = useState<string | null>(null);
  const [draft, setDraft] = useState<LicenseDraft>(EMPTY_DRAFT);
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<LicenseRecord | null>(null);

  const { data, isLoading } = useEmployeeCertificatesQuery({
    userBaseId: employeeGuid,
    limit: 100,
    offset: 0,
  });

  const createMutation = useCreateEmployeeCertificate(employeeGuid);
  const updateMutation = useUpdateEmployeeCertificate(employeeGuid);
  const deleteMutation = useDeleteEmployeeCertificate(employeeGuid);

  const isSaving =
    createMutation.isLoading || updateMutation.isLoading || deleteMutation.isLoading;

  const records = useMemo<LicenseRecord[]>(() => {
    const rows = (data?.response || []).map((item) => ({
      guid: item.guid,
      title: typeof item.title === "string" ? item.title : "",
      issuer: typeof item.issuer === "string" ? item.issuer : "",
      credential_id:
        typeof item.credential_id === "string" ? item.credential_id : "",
      issue_date: typeof item.issue_date === "string" ? item.issue_date : "",
      expiration_date:
        typeof item.expiration_date === "string" ? item.expiration_date : "",
      no_expiration: Boolean(item.no_expiration),
      credential_url:
        typeof item.credential_url === "string" ? item.credential_url : "",
      description: typeof item.description === "string" ? item.description : "",
    }));
    return rows.sort((a, b) => toTime(b.issue_date) - toTime(a.issue_date));
  }, [data?.response]);

  const openCreate = () => {
    setEditingGuid(null);
    setDraft(EMPTY_DRAFT);
    setError("");
    setIsFormOpen(true);
  };

  const openEdit = (record: LicenseRecord) => {
    setEditingGuid(record.guid);
    setDraft({
      title: record.title,
      issuer: record.issuer,
      credential_id: record.credential_id,
      issue_date: record.issue_date,
      expiration_date: record.expiration_date,
      no_expiration: record.no_expiration,
      credential_url: record.credential_url,
      description: record.description,
    });
    setError("");
    setIsFormOpen(true);
  };

  const closeForm = () => {
    if (isSaving) return;
    setIsFormOpen(false);
    setEditingGuid(null);
    setDraft(EMPTY_DRAFT);
    setError("");
  };

  const handleSave = async () => {
    const title = draft.title.trim();
    const issuer = draft.issuer.trim();
    const credentialId = draft.credential_id.trim();
    const issueDate = draft.issue_date;
    const expirationDate = draft.no_expiration ? "" : draft.expiration_date;
    const credentialUrl = draft.credential_url.trim();
    const description = draft.description.trim();

    if (!title) {
      setError("Укажите название лицензии или сертификата.");
      return;
    }
    if (!issuer) {
      setError("Укажите организацию-эмитента.");
      return;
    }
    if (!issueDate) {
      setError("Укажите дату выдачи.");
      return;
    }
    if (!draft.no_expiration && expirationDate && expirationDate < issueDate) {
      setError("Дата окончания не может быть раньше даты выдачи.");
      return;
    }

    const payload = {
      user_base_id: employeeGuid,
      title,
      issuer,
      credential_id: credentialId || null,
      issue_date: issueDate,
      expiration_date: draft.no_expiration ? null : expirationDate || null,
      no_expiration: draft.no_expiration,
      credential_url: credentialUrl || null,
      description: description || null,
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
      closeForm();
    } catch (saveError) {
      console.error("Certificate save error:", saveError);
      setError("Не удалось сохранить запись. Попробуйте ещё раз.");
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteMutation.mutateAsync(toDelete.guid);
      setToDelete(null);
    } catch (deleteError) {
      console.error("Certificate delete error:", deleteError);
      setError("Не удалось удалить запись. Попробуйте ещё раз.");
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span style={{ color: brandColor }}>
              <Award className="w-4 h-4" />
            </span>
            <h3 className="text-[15px] font-bold text-slate-900 m-0">
              Лицензии и сертификаты
            </h3>
            <span className="text-[12px] font-medium text-slate-400">
              {records.length}
            </span>
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

        <div className="px-6 pt-4 pb-5">
          {isLoading ? (
            <div className="py-8 flex items-center justify-center">
              <div
                className="w-7 h-7 rounded-full border-2 border-slate-200 animate-spin"
                style={{ borderTopColor: brandColor }}
              />
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center">
              <div
                className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center"
                style={{ backgroundColor: `${brandColor}14` }}
              >
                <Award className="w-5 h-5" style={{ color: brandColor }} />
              </div>
              <p className="text-[13px] text-slate-500 mb-3">Записей пока нет</p>
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold cursor-pointer transition-colors hover:bg-slate-100"
                style={{ color: brandColor }}
              >
                <Plus className="w-3.5 h-3.5" />
                Добавить первую запись
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {records.map((record) => (
                <div
                  key={record.guid}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-[14px] font-semibold text-slate-900 leading-tight m-0">
                        {record.title}
                      </h4>
                      <p className="mt-1 text-[13px] text-slate-600 m-0">
                        {record.issuer}
                        {record.credential_id ? ` · ID: ${record.credential_id}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[12px] text-slate-600">
                          <CalendarDays className="w-3.5 h-3.5" />
                          {formatValidity(
                            record.issue_date,
                            record.expiration_date,
                            record.no_expiration
                          )}
                        </span>
                        {record.credential_url && (
                          <a
                            href={record.credential_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[12px] hover:bg-slate-100"
                            style={{ color: brandColor }}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Проверить
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(record)}
                        className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 cursor-pointer transition-colors hover:bg-slate-100 hover:text-slate-700"
                        title="Редактировать"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setToDelete(record)}
                        className="flex items-center justify-center w-8 h-8 rounded-lg border border-red-100 bg-white text-red-500 cursor-pointer transition-colors hover:bg-red-50"
                        title="Удалить"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {record.description && (
                    <p className="mt-3 text-[13px] text-slate-500 leading-relaxed m-0">
                      {record.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={isFormOpen} onClose={closeForm} className="max-w-2xl w-full p-6">
        <div>
          <h3 className="text-[18px] font-bold text-slate-900 m-0 mb-1">
            {editingGuid ? "Редактировать запись" : "Добавить запись"}
          </h3>
          <p className="text-[13px] text-slate-500 m-0 mb-5">
            Укажите данные лицензии или сертификата.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                Название *
              </label>
              <input
                type="text"
                value={draft.title}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Например: PMP Certification"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[14px] text-slate-800 outline-none transition-colors focus:border-slate-400"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                Организация *
              </label>
              <input
                type="text"
                value={draft.issuer}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, issuer: event.target.value }))
                }
                placeholder="Кем выдано"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[14px] text-slate-800 outline-none transition-colors focus:border-slate-400"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                Номер / ID
              </label>
              <input
                type="text"
                value={draft.credential_id}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, credential_id: event.target.value }))
                }
                placeholder="ABC-12345"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[14px] text-slate-800 outline-none transition-colors focus:border-slate-400"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                Дата выдачи *
              </label>
              <DateInput
                value={draft.issue_date}
                onChange={(next) => setDraft((prev) => ({ ...prev, issue_date: next }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-9 text-[14px] text-slate-800 outline-none transition-colors focus:border-slate-400"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                Срок действия до
              </label>
              <DateInput
                value={draft.expiration_date}
                onChange={(next) => setDraft((prev) => ({ ...prev, expiration_date: next }))}
                min={draft.issue_date || undefined}
                disabled={draft.no_expiration}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-9 text-[14px] text-slate-800 outline-none transition-colors focus:border-slate-400 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
                Ссылка на подтверждение
              </label>
              <input
                type="url"
                value={draft.credential_url}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, credential_url: event.target.value }))
                }
                placeholder="https://..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[14px] text-slate-800 outline-none transition-colors focus:border-slate-400"
              />
            </div>
          </div>

          <label className="mt-3.5 inline-flex items-center gap-2 text-[13px] text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={draft.no_expiration}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  no_expiration: event.target.checked,
                  expiration_date: event.target.checked ? "" : prev.expiration_date,
                }))
              }
              className="h-4 w-4 rounded border-slate-300 text-slate-700"
            />
            Бессрочно
          </label>

          <div className="mt-3">
            <label className="block text-[13px] font-medium text-slate-600 mb-1.5">
              Описание
            </label>
            <textarea
              value={draft.description}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, description: event.target.value }))
              }
              rows={3}
              placeholder="Дополнительная информация"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[14px] text-slate-800 outline-none transition-colors focus:border-slate-400 resize-none"
            />
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[13px] text-rose-700">
              {error}
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={closeForm}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-[13px] font-medium cursor-pointer transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl border-none text-white text-[13px] font-semibold cursor-pointer transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: brandColor }}
            >
              {isSaving ? "Сохранение..." : editingGuid ? "Сохранить" : "Добавить"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!toDelete}
        onClose={() => !isSaving && setToDelete(null)}
        showCloseButton={false}
        className="max-w-md w-full p-6"
      >
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 mb-4">
            <Trash2 className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-[18px] font-bold text-slate-900 m-0 mb-2">
            Удалить запись?
          </h3>
          <p className="text-[13px] text-slate-500 m-0 mb-6">
            {toDelete?.title
              ? `Запись «${toDelete.title}» будет удалена без возможности восстановления.`
              : "Запись будет удалена без возможности восстановления."}
          </p>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setToDelete(null)}
              disabled={isSaving}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSaving}
              className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-red-700 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Удаление..." : "Удалить"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default LicenseCertificatesSection;
