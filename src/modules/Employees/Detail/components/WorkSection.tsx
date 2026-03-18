import { useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Pencil,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Modal } from "../../../../components/ui/modal";
import { useEmploymentTypesQuery } from "../../../../api/services/employmentType.service";
import { useExperienceLevelsQuery } from "../../../../api/services/experienceLevel.service";
import { useDivisionsQuery } from "../../../../api/services/division.service";
import { useLocationsQuery } from "../../../../api/services/location.service";
import { useDepartmentsSettingsQuery } from "../../../../api/services/department.service";
import { usePositionsQuery } from "../../../../api/services/position.service";
import {
  type EmployeeWork,
  useCreateEmployeeWork,
  useEmployeeWorksQuery,
  useUpdateEmployeeWork,
} from "../../../../api/services/employeeWork.service";

type WorkSectionProps = {
  employeeGuid: string;
  brandColor: string;
};

type WorkRecord = {
  guid: string;
  employmentTypeTitle: string;
  departmentTitle: string;
  divisionTitle: string;
  locationTitle: string;
  positionTitle: string;
  experienceLevelTitle: string;
  salary: number | null;
  dateFrom: string;
  dateTo: string;
};

type WorkFormState = {
  employmentTypeId: string;
  departmentId: string;
  divisionId: string;
  locationId: string;
  positionsId: string;
  experienceLevelId: string;
  salary: string;
  dateFrom: string;
};

const INPUT_CLASSNAME =
  "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-slate-300";

const toIsoDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseIsoDate = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
};

const todayIso = toIsoDate(new Date());

const formatDate = (value: string): string => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = parsed.getFullYear();
  return `${day}.${month}.${year}`;
};

const parseSalary = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const formatSalary = (value: number | null): string => {
  if (value === null) return "—";
  return `${new Intl.NumberFormat("ru-RU").format(value)} сум`;
};

const normalizeRecord = (row: EmployeeWork): WorkRecord => {
  return {
    guid: row.guid,
    employmentTypeTitle:
      (typeof row.employment_types_id_data?.title === "string" &&
        row.employment_types_id_data.title) ||
      "—",
    departmentTitle:
      (typeof row.departments_id_data?.title === "string" && row.departments_id_data.title) ||
      "—",
    divisionTitle:
      (typeof row.divisions_id_data?.title === "string" && row.divisions_id_data.title) || "—",
    locationTitle:
      (typeof row.locations_id_data?.title === "string" && row.locations_id_data.title) || "—",
    positionTitle:
      (typeof row.positions_id_data?.title === "string" && row.positions_id_data.title) ||
      "Без должности",
    experienceLevelTitle:
      (typeof row.experience_levels_id_data?.title === "string" && row.experience_levels_id_data.title) ||
      "—",
    salary: parseSalary(row.salary),
    dateFrom: typeof row.date_from === "string" ? row.date_from : "",
    dateTo: typeof row.date_to === "string" ? row.date_to : "",
  };
};

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        <span className="text-slate-400">{icon}</span>
        {label}
      </div>
      <p className="m-0 mt-1 text-[13px] font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function WorkCard({
  record,
  brandColor,
  isCurrent = false,
}: {
  record: WorkRecord;
  brandColor: string;
  isCurrent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{
              backgroundColor: `${brandColor}14`,
              color: brandColor,
            }}
          >
            <BriefcaseBusiness className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="m-0 truncate text-[15px] font-bold leading-[1.35] text-slate-900">
              {record.positionTitle}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-semibold"
                style={{
                  backgroundColor: `${brandColor}12`,
                  color: brandColor,
                }}
              >
                Уровень: {record.experienceLevelTitle}
              </span>
              {isCurrent ? (
                <span className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  Актуально
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Metric
          icon={<Wallet className="h-3.5 w-3.5" />}
          label="Оклад"
          value={formatSalary(record.salary)}
        />
        <Metric
          icon={<CalendarDays className="h-3.5 w-3.5" />}
          label="Начало"
          value={formatDate(record.dateFrom)}
        />
        <Metric
          icon={<CalendarDays className="h-3.5 w-3.5" />}
          label="Окончание"
          value={record.dateTo ? formatDate(record.dateTo) : "По настоящее время"}
        />
      </div>

      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={<BriefcaseBusiness className="h-3.5 w-3.5" />}
          label="Тип работы"
          value={record.employmentTypeTitle}
        />
        <Metric
          icon={<BriefcaseBusiness className="h-3.5 w-3.5" />}
          label="Департамент"
          value={record.departmentTitle}
        />
        <Metric
          icon={<BriefcaseBusiness className="h-3.5 w-3.5" />}
          label="Подразделение"
          value={record.divisionTitle}
        />
        <Metric
          icon={<BriefcaseBusiness className="h-3.5 w-3.5" />}
          label="Локация"
          value={record.locationTitle}
        />
      </div>
    </div>
  );
}

export default function WorkSection({ employeeGuid, brandColor }: WorkSectionProps) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [form, setForm] = useState<WorkFormState>({
    employmentTypeId: "",
    departmentId: "",
    divisionId: "",
    locationId: "",
    positionsId: "",
    experienceLevelId: "",
    salary: "",
    dateFrom: todayIso,
  });

  const { data, isLoading } = useEmployeeWorksQuery({
    userBaseId: employeeGuid,
    limit: 100,
    offset: 0,
  });
  const { data: positionsData } = usePositionsQuery({
    params: { limit: 200, offset: 0 },
  });
  const { data: employmentTypesData } = useEmploymentTypesQuery({
    params: { limit: 200, offset: 0 },
  });
  const { data: experienceLevelsData } = useExperienceLevelsQuery({
    params: { limit: 200, offset: 0 },
  });
  const { data: departmentsData } = useDepartmentsSettingsQuery({
    params: { limit: 200, offset: 0 },
  });
  const { data: divisionsData } = useDivisionsQuery({
    params: { limit: 200, offset: 0 },
  });
  const { data: locationsData } = useLocationsQuery({
    params: { limit: 200, offset: 0 },
  });

  const createEmployeeWork = useCreateEmployeeWork();
  const updateEmployeeWork = useUpdateEmployeeWork();
  const isSaving = createEmployeeWork.isLoading || updateEmployeeWork.isLoading;

  const sourceRecords = useMemo(() => {
    return Array.isArray(data?.response) ? (data.response as EmployeeWork[]) : [];
  }, [data?.response]);

  const currentRaw = sourceRecords[0] || null;
  const currentRecord = currentRaw ? normalizeRecord(currentRaw) : null;
  const historyRecords = sourceRecords.slice(1).map(normalizeRecord);

  const positionsOptions = useMemo(() => {
    return Array.isArray(positionsData?.response) ? positionsData.response : [];
  }, [positionsData?.response]);

  const employmentTypeOptions = useMemo(() => {
    return Array.isArray(employmentTypesData?.response) ? employmentTypesData.response : [];
  }, [employmentTypesData?.response]);

  const experienceLevelOptions = useMemo(() => {
    return Array.isArray(experienceLevelsData?.response) ? experienceLevelsData.response : [];
  }, [experienceLevelsData?.response]);

  const departmentOptions = useMemo(() => {
    return Array.isArray(departmentsData?.response) ? departmentsData.response : [];
  }, [departmentsData?.response]);

  const divisionOptions = useMemo(() => {
    return Array.isArray(divisionsData?.response) ? divisionsData.response : [];
  }, [divisionsData?.response]);

  const locationOptions = useMemo(() => {
    return Array.isArray(locationsData?.response) ? locationsData.response : [];
  }, [locationsData?.response]);

  const openEditModal = () => {
    const positionId =
      currentRaw && typeof currentRaw.positions_id === "string" ? currentRaw.positions_id : "";
    const experienceLevelId =
      currentRaw && typeof currentRaw.experience_levels_id === "string"
        ? currentRaw.experience_levels_id
        : "";
    const employmentTypeId =
      currentRaw && typeof currentRaw.employment_types_id === "string"
        ? currentRaw.employment_types_id
        : "";
    const departmentId =
      currentRaw && typeof currentRaw.departments_id === "string" ? currentRaw.departments_id : "";
    const divisionId =
      currentRaw && typeof currentRaw.divisions_id === "string" ? currentRaw.divisions_id : "";
    const locationId =
      currentRaw && typeof currentRaw.locations_id === "string" ? currentRaw.locations_id : "";
    const salaryValue =
      currentRaw?.salary === null || currentRaw?.salary === undefined
        ? ""
        : String(currentRaw.salary);
    const dateFrom =
      currentRaw && typeof currentRaw.date_from === "string" && currentRaw.date_from
        ? currentRaw.date_from
        : todayIso;

    setForm({
      employmentTypeId,
      departmentId,
      divisionId,
      locationId,
      positionsId: positionId,
      experienceLevelId,
      salary: salaryValue,
      dateFrom,
    });
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    if (isSaving) return;
    setIsEditModalOpen(false);
  };

  const handleSave = async () => {
    if (!form.positionsId) {
      toast.error("Выберите должность");
      return;
    }

    if (!form.dateFrom) {
      toast.error("Укажите дату начала");
      return;
    }

    const salaryRaw = form.salary.trim();
    let salaryValue: number | null = null;
    if (salaryRaw) {
      const parsedSalary = Number(salaryRaw.replace(/\s+/g, ""));
      if (!Number.isFinite(parsedSalary) || parsedSalary < 0) {
        toast.error("Оклад указан некорректно");
        return;
      }
      salaryValue = parsedSalary;
    }

    const previousGuid = currentRaw?.guid || "";
    const previousDateTo =
      currentRaw && typeof currentRaw.date_to === "string" ? currentRaw.date_to : null;

    try {
      if (previousGuid) {
        await updateEmployeeWork.mutateAsync({
          guid: previousGuid,
          data: {
            date_to: form.dateFrom,
          },
        });
      }

      try {
        await createEmployeeWork.mutateAsync({
          user_base_id: employeeGuid,
          employment_types_id: form.employmentTypeId || null,
          departments_id: form.departmentId || null,
          divisions_id: form.divisionId || null,
          locations_id: form.locationId || null,
          positions_id: form.positionsId || null,
          experience_levels_id: form.experienceLevelId || null,
          salary: salaryValue,
          date_from: form.dateFrom,
          date_to: null,
        });
      } catch (createError) {
        if (previousGuid) {
          try {
            await updateEmployeeWork.mutateAsync({
              guid: previousGuid,
              data: {
                date_to: previousDateTo,
              },
            });
          } catch {
            // noop rollback fallback
          }
        }
        throw createError;
      }

      toast.success("Запись о работе обновлена");
      setIsEditModalOpen(false);
    } catch {
      toast.error("Не удалось сохранить изменения");
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4.5">
          <div className="flex items-center gap-2">
            <span style={{ color: brandColor }}>
              <BriefcaseBusiness className="h-4 w-4" />
            </span>
            <h3 className="m-0 text-[15px] font-bold text-slate-900">Работа</h3>
          </div>
          <button
            type="button"
            onClick={openEditModal}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
          >
            <Pencil className="h-3.5 w-3.5" />
            {currentRecord ? "Изменить" : "Добавить"}
          </button>
        </div>

        <div className="px-6 py-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div
                className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200"
                style={{ borderTopColor: brandColor }}
              />
            </div>
          ) : !currentRecord ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center text-[13px] text-slate-500">
              Записей о работе пока нет
            </div>
          ) : (
            <div className="space-y-3">
              <WorkCard record={currentRecord} brandColor={brandColor} isCurrent />

              {historyRecords.length > 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50/60">
                  <button
                    type="button"
                    onClick={() => setIsHistoryOpen((prev) => !prev)}
                    className="flex w-full items-center justify-between border-none bg-transparent px-4 py-3 text-left text-[13px] font-semibold text-slate-700 transition hover:bg-slate-100/70"
                  >
                    <span>{isHistoryOpen ? "Скрыть историю" : "Посмотреть историю"}</span>
                    {isHistoryOpen ? (
                      <ChevronUp className="h-4 w-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    )}
                  </button>

                  {isHistoryOpen ? (
                    <div className="space-y-2 border-t border-slate-200 px-4 py-3">
                      {historyRecords.map((record) => (
                        <WorkCard key={record.guid} record={record} brandColor={brandColor} />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        className="relative z-[120000] max-w-[620px] w-full p-0 overflow-visible"
      >
        <div className="border-b border-slate-200 px-6 py-5">
          <h4 className="m-0 text-[24px] font-bold text-slate-900">Изменить работу</h4>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Тип работы
              </label>
              <select
                className={INPUT_CLASSNAME}
                value={form.employmentTypeId}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, employmentTypeId: event.target.value }))
                }
                disabled={isSaving}
              >
                <option value="">Выберите тип</option>
                {employmentTypeOptions.map((item) => (
                  <option key={item.guid} value={item.guid}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Департамент
              </label>
              <select
                className={INPUT_CLASSNAME}
                value={form.departmentId}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, departmentId: event.target.value }))
                }
                disabled={isSaving}
              >
                <option value="">Выберите департамент</option>
                {departmentOptions.map((item) => (
                  <option key={item.guid} value={item.guid}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Подразделение
              </label>
              <select
                className={INPUT_CLASSNAME}
                value={form.divisionId}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, divisionId: event.target.value }))
                }
                disabled={isSaving}
              >
                <option value="">Выберите подразделение</option>
                {divisionOptions.map((item) => (
                  <option key={item.guid} value={item.guid}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Локация
              </label>
              <select
                className={INPUT_CLASSNAME}
                value={form.locationId}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, locationId: event.target.value }))
                }
                disabled={isSaving}
              >
                <option value="">Выберите локацию</option>
                {locationOptions.map((item) => (
                  <option key={item.guid} value={item.guid}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
              Должность
            </label>
            <select
              className={INPUT_CLASSNAME}
              value={form.positionsId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, positionsId: event.target.value }))
              }
              disabled={isSaving}
            >
              <option value="">Выберите должность</option>
              {positionsOptions.map((item) => (
                <option key={item.guid} value={item.guid}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
              Уровень
            </label>
            <select
              className={INPUT_CLASSNAME}
              value={form.experienceLevelId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, experienceLevelId: event.target.value }))
              }
              disabled={isSaving}
            >
              <option value="">Выберите уровень</option>
              {experienceLevelOptions.map((item) => (
                <option key={item.guid} value={item.guid}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Оклад
              </label>
              <input
                type="number"
                min={0}
                step={1}
                placeholder="Например: 15000000"
                className={INPUT_CLASSNAME}
                value={form.salary}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, salary: event.target.value }))
                }
                disabled={isSaving}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
                Дата начала
              </label>
              <DatePicker
                selected={parseIsoDate(form.dateFrom)}
                onChange={(date) =>
                  setForm((prev) => ({
                    ...prev,
                    dateFrom: date ? toIsoDate(date) : "",
                  }))
                }
                dateFormat="dd.MM.yyyy"
                placeholderText="дд.мм.гггг"
                showMonthDropdown
                showYearDropdown
                dropdownMode="select"
                popperClassName="work-date-picker-popper"
                calendarClassName="work-date-picker-calendar"
                wrapperClassName="work-date-picker-wrapper"
                showPopperArrow={false}
                className={INPUT_CLASSNAME}
                disabled={isSaving}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={closeEditModal}
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
    </>
  );
}
