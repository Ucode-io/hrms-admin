import type { ReactNode } from "react";
import DatePicker from "react-datepicker";

import RemoteSingleSelect, {
  type RemoteSelectOption,
} from "../../../../../components/autocomplete/RemoteSingleSelect";
import type { LayoutWidth } from "../../../Form/layout/types";
import { translate } from "../../../../../i18n";

/**
 * Реестр полей модалки «Добавить/изменить должность» (таблица employee_works).
 * Устроен как `Form/layout/staticFields.tsx`: раскладка решает, в каком порядке
 * и какой ширины выводить поля, а рендер контрола и привязка к состоянию живут
 * здесь — payload от расположения не зависит.
 */

export type WorkFormState = {
  employmentTypeId: string;
  departmentId: string;
  locationId: string;
  positionsId: string;
  experienceLevelId: string;
  employeeWorkReasonId: string;
  workScheduleId: string;
  salary: string;
  dateFrom: string;
  dateTo: string;
};

export type WorkModalMode = "create" | "edit" | "return";

export type WorkFieldContext = {
  form: WorkFormState;
  setForm: React.Dispatch<React.SetStateAction<WorkFormState>>;
  mode: WorkModalMode;
  disabled: boolean;
  inputClassName: string;
  menuPortalTarget: HTMLElement | undefined;
  loadOptionsBySlug: (params: {
    slug: string;
    search: string;
    limit: number;
    offset: number;
  }) => Promise<{ count: number; options: RemoteSelectOption[] }>;
  /** Значение, уже выбранное в записи — чтобы селект показал его до загрузки списка. */
  fallbackOptions: {
    employmentType: RemoteSelectOption | null;
    department: RemoteSelectOption | null;
    location: RemoteSelectOption | null;
    position: RemoteSelectOption | null;
    experienceLevel: RemoteSelectOption | null;
    workReason: RemoteSelectOption | null;
    workSchedule: RemoteSelectOption | null;
  };
  /** Уровни ограничены группой выбранной должности; null — ограничения нет. */
  /** Уровни выбранной должности. Пустое множество = выбирать нечего. */
  allowedExperienceLevelIds: Set<string>;
  hasPositionGroup: boolean;
  parseIsoDate: (value: string) => Date | null;
  toIsoDate: (value: Date) => string;
  employeeWorkReasonSlug: string;
};

export type WorkFieldMeta = {
  key: string;
  label: string;
  defaultWidth: LayoutWidth;
  /** Поле есть только в режиме редактирования записи (дата окончания). */
  editOnly?: boolean;
  /** Поле скрыто при возврате сотрудника — причину там подставляют автоматически. */
  hiddenOnReturn?: boolean;
  render: (ctx: WorkFieldContext) => ReactNode;
};

const directoryField = (
  ctx: WorkFieldContext,
  options: {
    slug: string;
    value: string;
    fallback: RemoteSelectOption | null;
    placeholder: string;
    classNamePrefix: string;
    onChange: (value: string) => void;
  }
) => (
  <RemoteSingleSelect
    value={options.value}
    loadOptions={({ search, limit, offset }) =>
      ctx.loadOptionsBySlug({ slug: options.slug, search, limit, offset })
    }
    fallbackOption={options.fallback}
    onChange={options.onChange}
    placeholder={options.placeholder}
    disabled={ctx.disabled}
    menuPortalTarget={ctx.menuPortalTarget}
    classNamePrefix={options.classNamePrefix}
  />
);

const datePickerProps = {
  dateFormat: "dd.MM.yyyy",
  showMonthDropdown: true,
  showYearDropdown: true,
  dropdownMode: "select" as const,
  popperClassName: "work-date-picker-popper",
  calendarClassName: "work-date-picker-calendar",
  wrapperClassName: "work-date-picker-wrapper",
  showPopperArrow: false,
};

export const WORK_FIELDS: WorkFieldMeta[] = [
  {
    key: "employment_types_id",
    label: translate("employees.work_fields.employment_type"),
    defaultWidth: "half",
    render: (ctx) =>
      directoryField(ctx, {
        slug: "employment_types",
        value: ctx.form.employmentTypeId,
        fallback: ctx.fallbackOptions.employmentType,
        placeholder: translate("employees.work_fields.employment_type_placeholder"),
        classNamePrefix: "work-employment-type-select",
        onChange: (value) => ctx.setForm((prev) => ({ ...prev, employmentTypeId: value })),
      }),
  },
  {
    key: "departments_id",
    label: translate("employees.work_fields.department"),
    defaultWidth: "half",
    render: (ctx) =>
      directoryField(ctx, {
        slug: "departments",
        value: ctx.form.departmentId,
        fallback: ctx.fallbackOptions.department,
        placeholder: translate("employees.work_fields.department_placeholder"),
        classNamePrefix: "work-department-select",
        onChange: (value) => ctx.setForm((prev) => ({ ...prev, departmentId: value })),
      }),
  },
  {
    key: "locations_id",
    label: translate("employees.work_fields.location"),
    defaultWidth: "half",
    render: (ctx) =>
      directoryField(ctx, {
        slug: "locations",
        value: ctx.form.locationId,
        fallback: ctx.fallbackOptions.location,
        placeholder: translate("employees.work_fields.location_placeholder"),
        classNamePrefix: "work-location-select",
        onChange: (value) => ctx.setForm((prev) => ({ ...prev, locationId: value })),
      }),
  },
  {
    key: "positions_id",
    label: translate("employees.work_fields.position"),
    defaultWidth: "half",
    render: (ctx) =>
      directoryField(ctx, {
        slug: "positions",
        value: ctx.form.positionsId,
        fallback: ctx.fallbackOptions.position,
        placeholder: translate("employees.work_fields.position_placeholder"),
        classNamePrefix: "work-position-select",
        onChange: (value) => ctx.setForm((prev) => ({ ...prev, positionsId: value })),
      }),
  },
  {
    key: "experience_levels_id",
    label: translate("employees.work_fields.experience_level"),
    defaultWidth: "half",
    render: (ctx) => (
      <RemoteSingleSelect
        value={ctx.form.experienceLevelId}
        loadOptions={async ({ search, limit, offset }) => {
          const res = await ctx.loadOptionsBySlug({
            slug: "experience_levels",
            search,
            limit,
            offset,
          });

          return {
            count: res.count,
            options: res.options.filter((item) =>
              ctx.allowedExperienceLevelIds.has(item.value)
            ),
          };
        }}
        fallbackOption={ctx.fallbackOptions.experienceLevel}
        onChange={(value) => ctx.setForm((prev) => ({ ...prev, experienceLevelId: value }))}
        placeholder={
          ctx.hasPositionGroup
            ? translate("employees.work_fields.experience_level_placeholder")
            : ctx.form.positionsId
              ? translate("employees.work_fields.experience_level_no_ladder")
              : translate("employees.work_fields.experience_level_pick_position_first")
        }
        disabled={ctx.disabled}
        menuPortalTarget={ctx.menuPortalTarget}
        classNamePrefix="work-experience-level-select"
      />
    ),
  },
  {
    key: "employee_work_reason_id",
    label: translate("employees.work_fields.reason"),
    defaultWidth: "full",
    hiddenOnReturn: true,
    render: (ctx) =>
      directoryField(ctx, {
        slug: ctx.employeeWorkReasonSlug,
        value: ctx.form.employeeWorkReasonId,
        fallback: ctx.fallbackOptions.workReason,
        placeholder: translate("employees.work_fields.reason_placeholder"),
        classNamePrefix: "work-reason-select",
        onChange: (value) =>
          ctx.setForm((prev) => ({ ...prev, employeeWorkReasonId: value })),
      }),
  },
  {
    key: "work_schedule_id",
    label: translate("employees.work_fields.schedule"),
    defaultWidth: "full",
    render: (ctx) =>
      directoryField(ctx, {
        slug: "work_schedule",
        value: ctx.form.workScheduleId,
        fallback: ctx.fallbackOptions.workSchedule,
        placeholder: translate("employees.work_fields.schedule_placeholder"),
        classNamePrefix: "work-schedule-select",
        onChange: (value) => ctx.setForm((prev) => ({ ...prev, workScheduleId: value })),
      }),
  },
  {
    key: "salary",
    label: translate("employees.work_fields.salary"),
    defaultWidth: "half",
    render: (ctx) => (
      <input
        type="number"
        min={0}
        step={1}
        placeholder={translate("employees.work_fields.salary_placeholder")}
        className={ctx.inputClassName}
        value={ctx.form.salary}
        onChange={(event) =>
          ctx.setForm((prev) => ({ ...prev, salary: event.target.value }))
        }
        disabled={ctx.disabled}
      />
    ),
  },
  {
    key: "date_from",
    label: translate("employees.work_fields.date_from"),
    defaultWidth: "half",
    render: (ctx) => (
      <DatePicker
        {...datePickerProps}
        selected={ctx.parseIsoDate(ctx.form.dateFrom)}
        onChange={(date: Date | null) =>
          ctx.setForm((prev) => ({
            ...prev,
            dateFrom: date ? ctx.toIsoDate(date) : "",
          }))
        }
        placeholderText={translate("employees.work_fields.date_placeholder")}
        className={ctx.inputClassName}
        disabled={ctx.disabled}
      />
    ),
  },
  {
    key: "date_to",
    label: translate("employees.work_fields.date_to"),
    defaultWidth: "half",
    editOnly: true,
    render: (ctx) => (
      <DatePicker
        {...datePickerProps}
        selected={ctx.parseIsoDate(ctx.form.dateTo)}
        onChange={(date: Date | null) =>
          ctx.setForm((prev) => ({
            ...prev,
            dateTo: date ? ctx.toIsoDate(date) : "",
          }))
        }
        isClearable
        placeholderText={translate("employees.work_fields.date_to_placeholder")}
        className={ctx.inputClassName}
        disabled={ctx.disabled}
      />
    ),
  },
];

export const WORK_FIELD_MAP: Record<string, WorkFieldMeta> = WORK_FIELDS.reduce(
  (acc, meta) => {
    acc[meta.key] = meta;
    return acc;
  },
  {} as Record<string, WorkFieldMeta>
);

/** Единственная карточка раскладки: модалка — один плоский блок полей. */
export const WORK_MODAL_CARD_ID = "crd_work_modal";
