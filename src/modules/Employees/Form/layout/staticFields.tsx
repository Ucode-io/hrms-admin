import type { ReactNode } from "react";
import { Controller, type Control, type UseFormRegister } from "react-hook-form";
import DatePicker from "react-datepicker";
import { InputMask } from "@react-input/mask";

import SearchableSelect from "../../../../components/ui/searchable-select";
import type { EmployeeFormValues, SelectOption } from "../types";
import type { LayoutWidth } from "./types";

/**
 * Реестр статичных полей формы сотрудника. Раскладка (`useEmployeeFormLayout`)
 * решает, в какой карточке и в каком порядке они выводятся, а рендер контрола
 * и привязка к react-hook-form живут здесь — payload от расположения не зависит.
 */
export type StaticFieldContext = {
  register: UseFormRegister<EmployeeFormValues>;
  control: Control<EmployeeFormValues>;
  brandColor: string;
  inputStyle: React.CSSProperties;
  focusHandlers: {
    onFocus: (event: React.FocusEvent<HTMLInputElement>) => void;
    onBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
  };
  options: {
    gender: SelectOption[];
    roles: SelectOption[];
    employmentTypes: SelectOption[];
    positions: SelectOption[];
    employeeWorkReasons: SelectOption[];
    departments: SelectOption[];
    experienceLevels: SelectOption[];
    locations: SelectOption[];
  };
  /** Подсказка в поле «Уровень» зависит от выбранной должности. */
  experienceLevelPlaceholder: string;
  /** Блок фотографии целиком — со своей загрузкой и превью. */
  renderPhoto: () => ReactNode;
};

export type StaticFieldMeta = {
  key: string;
  label: string;
  hint?: string;
  defaultWidth: LayoutWidth;
  /** Обязательное поле формы — убрать его из раскладки нельзя. */
  required?: boolean;
  /** Поле пишется только при создании сотрудника (форма редактирования его скрывает). */
  createOnly?: boolean;
  /** Рендерит сам себя целиком, без внешнего label (фото). */
  bare?: boolean;
  render: (ctx: StaticFieldContext) => ReactNode;
};

const maskProps = {
  mask: "+___ __ ___ __ __",
  replacement: { _: /\d/ },
  placeholder: "+998 ** *** ** **",
} as const;

const select = (
  ctx: StaticFieldContext,
  name: keyof EmployeeFormValues,
  options: SelectOption[],
  placeholder: string
) => (
  <Controller
    control={ctx.control}
    name={name}
    render={({ field }) => (
      <SearchableSelect
        options={options}
        value={typeof field.value === "string" ? field.value : ""}
        onChange={field.onChange}
        placeholder={placeholder}
        brandColor={ctx.brandColor}
      />
    )}
  />
);

const text = (
  ctx: StaticFieldContext,
  name: keyof EmployeeFormValues,
  placeholder: string,
  extra: { required?: boolean; type?: string; min?: number } = {}
) => (
  <input
    {...ctx.register(name, extra.required ? { required: true } : undefined)}
    type={extra.type ?? "text"}
    min={extra.min}
    placeholder={placeholder}
    style={ctx.inputStyle}
    {...ctx.focusHandlers}
  />
);

const datePicker = (
  ctx: StaticFieldContext,
  name: "birth_date" | "date_hire",
  maxToday: boolean
) => (
  <Controller
    control={ctx.control}
    name={name}
    render={({ field }) => (
      <DatePicker
        selected={field.value}
        onChange={field.onChange}
        dateFormat="dd.MM.yyyy"
        placeholderText="дд.мм.гггг"
        showYearDropdown
        showMonthDropdown
        dropdownMode="select"
        maxDate={maxToday ? new Date() : undefined}
        className="employee-form-datepicker"
        wrapperClassName="employee-form-datepicker-wrapper"
      />
    )}
  />
);

const phone = (ctx: StaticFieldContext, name: "phone" | "work_phone") => (
  <Controller
    control={ctx.control}
    name={name}
    render={({ field }) => (
      <InputMask
        {...maskProps}
        value={field.value}
        onChange={(event) => field.onChange(event.target.value)}
        style={ctx.inputStyle}
        onFocus={(event) => (event.currentTarget.style.borderColor = ctx.brandColor)}
        onBlur={(event) => (event.currentTarget.style.borderColor = "#e2e8f0")}
      />
    )}
  />
);

export const STATIC_FIELDS: StaticFieldMeta[] = [
  {
    key: "photo",
    label: "Фотография",
    defaultWidth: "full",
    bare: true,
    render: (ctx) => ctx.renderPhoto(),
  },
  {
    key: "second_name",
    label: "Фамилия *",
    defaultWidth: "half",
    required: true,
    render: (ctx) => text(ctx, "second_name", "Введите фамилию", { required: true }),
  },
  {
    key: "first_name",
    label: "Имя *",
    defaultWidth: "half",
    required: true,
    render: (ctx) => text(ctx, "first_name", "Введите имя", { required: true }),
  },
  {
    key: "middle_name",
    label: "Отчество",
    defaultWidth: "half",
    render: (ctx) => text(ctx, "middle_name", "Введите отчество"),
  },
  {
    key: "birth_date",
    label: "Дата рождения",
    defaultWidth: "half",
    render: (ctx) => datePicker(ctx, "birth_date", true),
  },
  {
    key: "gender",
    label: "Пол",
    defaultWidth: "half",
    render: (ctx) => select(ctx, "gender", ctx.options.gender, "Выберите пол"),
  },
  {
    key: "email",
    label: "Эл. почта *",
    defaultWidth: "half",
    required: true,
    render: (ctx) =>
      text(ctx, "email", "example@company.uz", { required: true, type: "email" }),
  },
  {
    key: "personal_email",
    label: "Личная эл. почта",
    defaultWidth: "half",
    render: (ctx) => text(ctx, "personal_email", "example@mail.com", { type: "email" }),
  },
  {
    key: "phone",
    label: "Мобильный телефон",
    defaultWidth: "half",
    render: (ctx) => phone(ctx, "phone"),
  },
  {
    key: "work_phone",
    label: "Рабочий телефон",
    defaultWidth: "half",
    render: (ctx) => phone(ctx, "work_phone"),
  },
  {
    key: "telegram",
    label: "Телеграм",
    defaultWidth: "half",
    render: (ctx) => text(ctx, "telegram", "@username"),
  },
  {
    key: "hrms_roles_id",
    label: "Роль доступа",
    hint: "Определяет, какие модули доступны сотруднику.",
    defaultWidth: "full",
    render: (ctx) => select(ctx, "hrms_roles_id", ctx.options.roles, "Выберите роль"),
  },
  {
    key: "date_hire",
    label: "Дата начала",
    defaultWidth: "full",
    render: (ctx) => datePicker(ctx, "date_hire", false),
  },
  {
    key: "employment_types_id",
    label: "Тип работы",
    defaultWidth: "full",
    render: (ctx) =>
      select(ctx, "employment_types_id", ctx.options.employmentTypes, "Выберите тип"),
  },
  {
    key: "positions_id",
    label: "Должность",
    defaultWidth: "full",
    render: (ctx) =>
      select(ctx, "positions_id", ctx.options.positions, "Выберите должность"),
  },
  {
    key: "employee_work_reason_id",
    label: "Причина изменения",
    defaultWidth: "full",
    createOnly: true,
    render: (ctx) =>
      select(
        ctx,
        "employee_work_reason_id",
        ctx.options.employeeWorkReasons,
        "Выберите причину"
      ),
  },
  {
    key: "salary",
    label: "Оклад",
    defaultWidth: "full",
    createOnly: true,
    render: (ctx) => text(ctx, "salary", "Например: 15000000", { type: "number", min: 0 }),
  },
  {
    key: "departments_id",
    label: "Департамент",
    defaultWidth: "full",
    render: (ctx) =>
      select(ctx, "departments_id", ctx.options.departments, "Выберите департамент"),
  },
  {
    key: "experience_levels_id",
    label: "Уровень",
    defaultWidth: "full",
    render: (ctx) =>
      select(
        ctx,
        "experience_levels_id",
        ctx.options.experienceLevels,
        ctx.experienceLevelPlaceholder
      ),
  },
  {
    key: "locations_id",
    label: "Филиал",
    defaultWidth: "full",
    render: (ctx) => select(ctx, "locations_id", ctx.options.locations, "Выберите филиал"),
  },
];

export const STATIC_FIELD_MAP: Record<string, StaticFieldMeta> = STATIC_FIELDS.reduce(
  (acc, meta) => {
    acc[meta.key] = meta;
    return acc;
  },
  {} as Record<string, StaticFieldMeta>
);
