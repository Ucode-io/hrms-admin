import { useEffect, useMemo, useState } from "react";
import { HandCoins, Pencil, Plus, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Modal } from "../../../../components/ui/modal";
import companyStore from "../../../../store/company.store";
import {
  useCreateEmployeeCompensation,
  useDeleteEmployeeCompensation,
  useEmployeeCompensationsQuery,
  useUpdateEmployeeCompensation,
} from "../../../../api/services/employeeCompensation.service";
import { COMPANY_ID, useSettingsDirectoryQuery } from "../../../../api/services/settingsDirectory.service";
import { useDynamicValues } from "../../../Settings/CustomFields/useDynamicValues";
import DynamicFieldsBlock from "../../../Settings/CustomFields/DynamicFieldsBlock";
import { useTranslation, translate } from "../../../../i18n";

type CompensationSectionProps = {
  employeeGuid: string;
  brandColor: string;
};

type OperationType = "income" | "deduction";

type CompensationRecord = {
  guid: string;
  date: string;
  amount: number;
  description: string;
  createdAt: string;
  compensationTypeId: string;
  compensationTypeTitle: string;
  operationType: OperationType;
  /** Контейнер значений динамических полей, как пришёл из записи. */
  customData: unknown;
};

type CompensationDraft = {
  accrualDate: Date | null;
  amount: string;
  description: string;
  compensationTypeId: string;
  operationType: OperationType;
};

type CompensationTypeItem = {
  guid: string;
  title?: string;
  operation_type?: string[] | string | null;
  [key: string]: unknown;
};

const COMPENSATION_TYPES_SLUG = "compensation_types";

const OPERATION_TAG_STYLES: Record<OperationType, string> = {
  income: "border-emerald-200 bg-emerald-50 text-emerald-700",
  deduction: "border-rose-200 bg-rose-50 text-rose-700",
};

const getDefaultDraft = (): CompensationDraft => ({
  accrualDate: new Date(),
  amount: "",
  description: "",
  compensationTypeId: "",
  operationType: "income",
});

const toTime = (date: string) => {
  const ts = new Date(date).getTime();
  return Number.isNaN(ts) ? 0 : ts;
};

const toDateValue = (value: string): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toIsoDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatDateTime = (dateStr: string): string => {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatAmount = (value: number): string => {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ${translate("employees.compensation.currency_suffix")}`;
};

const formatAmountInput = (value: string): string => {
  if (!value) return "";

  const isNegative = value.startsWith("-");
  const digits = value.replace(/[^\d]/g, "");

  if (!digits) {
    return isNegative ? "-" : "";
  }

  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return isNegative ? `-${formatted}` : formatted;
};

const normalizeAmountInput = (value: string): string => {
  const trimmed = value.replace(/\s+/g, "");
  const isNegative = trimmed.startsWith("-");
  const digits = trimmed.replace(/[^\d]/g, "");

  if (!digits) {
    return isNegative ? "-" : "";
  }

  return formatAmountInput(`${isNegative ? "-" : ""}${digits}`);
};

const parseAmountInput = (value: string): number => {
  const normalized = value.replace(/\s+/g, "");
  return Number(normalized);
};

const resolveOperationType = (value: unknown): OperationType => {
  if (Array.isArray(value)) {
    return value[0] === "deduction" || value[0] === "outcome" ? "deduction" : "income";
  }

  return value === "deduction" || value === "outcome" ? "deduction" : "income";
};

function CompensationSection({ employeeGuid, brandColor }: CompensationSectionProps) {
  const { t } = useTranslation();
  const OPERATION_LABELS: Record<OperationType, string> = {
    income: t("employees.compensation.operation_income"),
    deduction: t("employees.compensation.operation_deduction"),
  };
  /** Динамические поля таблицы employee_compensations. */
  const dynamic = useDynamicValues("employee_compensations");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuid, setEditingGuid] = useState<string | null>(null);
  const [draft, setDraft] = useState<CompensationDraft>(getDefaultDraft());
  const [error, setError] = useState("");
  const [toDelete, setToDelete] = useState<CompensationRecord | null>(null);

  const { data, isLoading } = useEmployeeCompensationsQuery({
    userBaseId: employeeGuid,
    limit: 100,
    offset: 0,
  });

  const { data: compensationTypesData, isLoading: isTypesLoading } = useSettingsDirectoryQuery({
    slug: COMPENSATION_TYPES_SLUG,
    params: {
      limit: 1000,
      offset: 0,
    },
  });

  const createMutation = useCreateEmployeeCompensation(employeeGuid);
  const updateMutation = useUpdateEmployeeCompensation(employeeGuid);
  const deleteMutation = useDeleteEmployeeCompensation(employeeGuid);

  const isSaving =
    createMutation.isLoading || updateMutation.isLoading || deleteMutation.isLoading;

  const compensationTypeOptions = useMemo(
    () => (compensationTypesData?.response || []) as CompensationTypeItem[],
    [compensationTypesData?.response]
  );
  const filteredCompensationTypeOptions = useMemo(
    () =>
      compensationTypeOptions.filter(
        (item) => resolveOperationType(item.operation_type) === draft.operationType
      ),
    [compensationTypeOptions, draft.operationType]
  );

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
        createdAt: typeof item.created_at === "string" ? item.created_at : "",
        compensationTypeId:
          typeof item.compensation_types_id === "string" ? item.compensation_types_id : "",
        compensationTypeTitle:
          item.compensation_types_id_data &&
          typeof item.compensation_types_id_data.title === "string"
            ? item.compensation_types_id_data.title
            : "",
        operationType: resolveOperationType(item.operation_type),
        customData: (item as { custom_data?: unknown }).custom_data,
      };
    });

    return rows.sort((a, b) => toTime(b.date) - toTime(a.date));
  }, [data?.response]);

  const openCreate = () => {
    setEditingGuid(null);
    setDraft(getDefaultDraft());
    dynamic.reset();
    setError("");
    setIsModalOpen(true);
  };

  const openEdit = (record: CompensationRecord) => {
    setEditingGuid(record.guid);
    setDraft({
      accrualDate: toDateValue(record.date),
      amount: formatAmountInput(String(record.amount)),
      description: record.description,
      compensationTypeId: record.compensationTypeId,
      operationType: record.operationType,
    });
    dynamic.reset(record.customData);
    setError("");
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (!draft.compensationTypeId) return;

    const hasSelectedType = filteredCompensationTypeOptions.some(
      (item) => item.guid === draft.compensationTypeId
    );

    if (!hasSelectedType) {
      setDraft((prev) => ({
        ...prev,
        compensationTypeId: "",
      }));
    }
  }, [draft.compensationTypeId, filteredCompensationTypeOptions]);

  const closeModal = () => {
    if (isSaving) return;
    setIsModalOpen(false);
    setEditingGuid(null);
    setDraft(getDefaultDraft());
    setError("");
  };

  const handleSave = async () => {
    if (!draft.accrualDate) {
      setError(t("employees.compensation.accrual_date_required"));
      return;
    }

    const parsedAmount = parseAmountInput(draft.amount);
    if (!Number.isFinite(parsedAmount)) {
      setError(t("employees.compensation.amount_invalid"));
      return;
    }

    if (!draft.compensationTypeId) {
      setError(t("employees.compensation.type_required"));
      return;
    }

    // Правила динамических полей проверяем до запроса.
    if (!dynamic.validate()) {
      setError(t("employees.compensation.check_extra_fields"));
      return;
    }

    const payload = {
      user_base_id: employeeGuid,
      companies_id: companyStore.company?.guid || COMPANY_ID,
      date: toIsoDate(draft.accrualDate),
      amount: parsedAmount,
      description: draft.description.trim() || null,
      compensation_types_id: draft.compensationTypeId,
      operation_type: [draft.operationType],
      ...dynamic.toPayload(),
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
      setError(t("employees.compensation.save_failed"));
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteMutation.mutateAsync(toDelete.guid);
      setToDelete(null);
    } catch (deleteError) {
      console.error("Compensation delete error:", deleteError);
      setError(t("employees.compensation.delete_failed"));
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
            <h3 className="text-[15px] font-bold text-slate-900 m-0">{t("employees.compensation.title")}</h3>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold cursor-pointer transition-colors hover:bg-slate-50"
            style={{ color: brandColor }}
          >
            <Plus className="w-3.5 h-3.5" />
            {t("common.add")}
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
                {t("employees.compensation.empty")}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-2 pr-4 text-[12px] font-semibold text-slate-500">{t("employees.compensation.col_accrual_date")}</th>
                    <th className="py-2 pr-4 text-[12px] font-semibold text-slate-500">{t("employees.compensation.col_type")}</th>
                    <th className="py-2 pr-4 text-[12px] font-semibold text-slate-500">{t("employees.compensation.col_operation")}</th>
                    <th className="py-2 pr-4 text-[12px] font-semibold text-slate-500">{t("employees.compensation.col_amount")}</th>
                    <th className="py-2 pr-4 text-[12px] font-semibold text-slate-500">{t("employees.compensation.col_description")}</th>
                    <th className="py-2 pr-4 text-[12px] font-semibold text-slate-500">{t("employees.compensation.col_created")}</th>
                    <th className="py-2 text-[12px] font-semibold text-slate-500 text-right">
                      {t("employees.compensation.col_actions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.guid} className="border-b border-slate-100 align-top">
                      <td className="py-3 pr-4 text-[13px] text-slate-800">
                        {formatDate(record.date)}
                      </td>
                      <td className="py-3 pr-4 text-[13px] text-slate-700">
                        {record.compensationTypeTitle || "—"}
                      </td>
                      <td className="py-3 pr-4 text-[13px] text-slate-700">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[12px] font-semibold ${OPERATION_TAG_STYLES[record.operationType]}`}
                        >
                          {OPERATION_LABELS[record.operationType]}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-[13px] font-semibold text-slate-900">
                        {formatAmount(record.amount)}
                      </td>
                      <td className="py-3 pr-4 text-[13px] text-slate-700">
                        {record.description || "—"}
                      </td>
                      <td className="py-3 pr-4 text-[13px] text-slate-700">
                        {formatDateTime(record.createdAt)}
                      </td>
                      <td className="py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(record)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
                            title={t("common.edit")}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setToDelete(record)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-500 transition-colors hover:bg-rose-50"
                            title={t("common.delete")}
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
            {editingGuid ? t("employees.compensation.edit_modal_title") : t("employees.compensation.add_modal_title")}
          </h4>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
              {t("employees.compensation.operation_type_label")}
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    operationType: "income",
                    compensationTypeId: "",
                  }))
                }
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  draft.operationType === "income"
                    ? "border-emerald-300 bg-emerald-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/50"
                }`}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    draft.operationType === "income"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <TrendingUp className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-[13px] font-semibold text-slate-900">
                    {t("employees.compensation.operation_income")}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-slate-500">
                    income
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    operationType: "deduction",
                    compensationTypeId: "",
                  }))
                }
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  draft.operationType === "deduction"
                    ? "border-rose-300 bg-rose-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-rose-200 hover:bg-rose-50/50"
                }`}
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    draft.operationType === "deduction"
                      ? "bg-rose-100 text-rose-700"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <TrendingDown className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-[13px] font-semibold text-slate-900">
                    {t("employees.compensation.operation_deduction")}
                  </span>
                  <span className="mt-0.5 block text-[12px] text-slate-500">
                    deduction
                  </span>
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                {t("employees.compensation.col_accrual_date")}
              </label>
              <DatePicker
                selected={draft.accrualDate}
                onChange={(date) =>
                  setDraft((prev) => ({
                    ...prev,
                    accrualDate: date,
                  }))
                }
                dateFormat="dd.MM.yyyy"
                placeholderText={t("employees.detail.dismissal_date_placeholder")}
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                wrapperClassName="w-full"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                {t("employees.compensation.col_type")}
              </label>
              <select
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300"
                value={draft.compensationTypeId}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    compensationTypeId: event.target.value,
                  }))
                }
                disabled={isSaving || isTypesLoading}
              >
                <option value="">{t("employees.compensation.select_type")}</option>
                {filteredCompensationTypeOptions.map((item) => (
                  <option key={item.guid} value={item.guid}>
                    {item.title || t("employees.detail.no_title")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
              {t("employees.compensation.col_amount")}
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={draft.amount}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  amount: normalizeAmountInput(event.target.value),
                }))
              }
              placeholder={t("employees.compensation.amount_placeholder")}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
              {t("employees.compensation.col_description")}
            </label>
            <textarea
              rows={4}
              value={draft.description}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, description: event.target.value }))
              }
              placeholder={t("employees.compensation.description_placeholder")}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-800 outline-none transition focus:border-slate-300"
            />
          </div>

          <DynamicFieldsBlock
            fields={dynamic.fields}
            values={dynamic.values}
            errors={dynamic.errors}
            onChange={dynamic.setValue}
            brandColor={brandColor}
          />

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
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="h-9 rounded-lg border border-transparent px-4 text-[13px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: brandColor }}
          >
            {isSaving ? t("common.saving") : t("common.save")}
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
          {t("employees.compensation.delete_modal_title")}
        </h4>
        <p className="mb-6 mt-2 text-[13px] text-slate-500">
          {t("employees.sport_attendance.delete_modal_description")}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setToDelete(null)}
            disabled={isSaving}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isSaving}
            className="h-9 rounded-lg border border-rose-200 bg-rose-50 px-4 text-[13px] font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? t("employees.sport_attendance.deleting") : t("common.delete")}
          </button>
        </div>
      </Modal>
    </>
  );
}

export default CompensationSection;
