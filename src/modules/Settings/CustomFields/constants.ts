import {
  AlignLeft,
  AtSign,
  Braces,
  Calendar,
  CalendarClock,
  CircleDollarSign,
  CircleDot,
  Contact,
  Database,
  FileUp,
  Hash,
  Layers,
  Link2,
  ListChecks,
  ListFilter,
  Phone,
  SquareCheck,
  Type,
  UserRound,
  Briefcase,
  Building2,
  Package,
  Users,
  Target,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { FieldType } from "./types";

export type FieldTypeMeta = {
  type: FieldType;
  title: string;
  description: string;
  icon: LucideIcon;
  group: "Текст" | "Числа и даты" | "Выбор" | "Связи";
  hasOptions?: boolean;
  hasTextRules?: boolean;
  hasNumberRules?: boolean;
  hasDateRules?: boolean;
  hasFileRules?: boolean;
};

export const FIELD_TYPES: FieldTypeMeta[] = [
  {
    type: "text",
    title: "Текст",
    description: "Однострочная строка",
    icon: Type,
    group: "Текст",
    hasTextRules: true,
  },
  {
    type: "textarea",
    title: "Многострочный текст",
    description: "Абзац или заметка",
    icon: AlignLeft,
    group: "Текст",
    hasTextRules: true,
  },
  {
    type: "email",
    title: "Эл. почта",
    description: "С проверкой формата",
    icon: AtSign,
    group: "Текст",
    hasTextRules: true,
  },
  {
    type: "phone",
    title: "Телефон",
    description: "Маска +998 __ ___ __ __",
    icon: Phone,
    group: "Текст",
    hasTextRules: true,
  },
  {
    type: "url",
    title: "Ссылка",
    description: "URL с проверкой",
    icon: Link2,
    group: "Текст",
    hasTextRules: true,
  },
  {
    type: "number",
    title: "Число",
    description: "Целое или дробное",
    icon: Hash,
    group: "Числа и даты",
    hasNumberRules: true,
  },
  {
    type: "money",
    title: "Сумма",
    description: "Денежное значение",
    icon: CircleDollarSign,
    group: "Числа и даты",
    hasNumberRules: true,
  },
  {
    type: "date",
    title: "Дата",
    description: "Календарь",
    icon: Calendar,
    group: "Числа и даты",
    hasDateRules: true,
  },
  {
    type: "datetime",
    title: "Дата и время",
    description: "Календарь со временем",
    icon: CalendarClock,
    group: "Числа и даты",
    hasDateRules: true,
  },
  {
    type: "boolean",
    title: "Переключатель",
    description: "Да / Нет",
    icon: SquareCheck,
    group: "Выбор",
  },
  {
    type: "select",
    title: "Список",
    description: "Один вариант из списка",
    icon: ListFilter,
    group: "Выбор",
    hasOptions: true,
  },
  {
    type: "multiselect",
    title: "Мультисписок",
    description: "Несколько вариантов",
    icon: ListChecks,
    group: "Выбор",
    hasOptions: true,
  },
  {
    type: "radio",
    title: "Радиокнопки",
    description: "Варианты в строку",
    icon: CircleDot,
    group: "Выбор",
    hasOptions: true,
  },
  {
    type: "checkbox_group",
    title: "Чекбоксы",
    description: "Множественный выбор",
    icon: Layers,
    group: "Выбор",
    hasOptions: true,
  },
  {
    type: "file",
    title: "Файл",
    description: "Загрузка документа",
    icon: FileUp,
    group: "Связи",
    hasFileRules: true,
  },
  {
    type: "employee",
    title: "Сотрудник",
    description: "Ссылка на сотрудника",
    icon: UserRound,
    group: "Связи",
  },
  {
    type: "directory",
    title: "Справочник",
    description: "Значение из справочника",
    icon: Braces,
    group: "Связи",
  },
];

export const FIELD_TYPE_MAP: Record<FieldType, FieldTypeMeta> = FIELD_TYPES.reduce(
  (acc, meta) => {
    acc[meta.type] = meta;
    return acc;
  },
  {} as Record<FieldType, FieldTypeMeta>
);

export const FIELD_TYPE_GROUPS: FieldTypeMeta["group"][] = [
  "Текст",
  "Числа и даты",
  "Выбор",
  "Связи",
];

/** Иконки таблиц (сущностей) — ключ хранится в `CustomFieldEntity.icon`. */
export const ENTITY_ICONS: Record<string, LucideIcon> = {
  users: Users,
  contact: Contact,
  briefcase: Briefcase,
  building: Building2,
  package: Package,
  target: Target,
  wallet: Wallet,
  database: Database,
};

export const OPTION_COLORS = [
  "#465FFF",
  "#12B76A",
  "#F79009",
  "#F04438",
  "#7C4DFF",
  "#0BA5EC",
  "#EC4899",
  "#64748B",
];

/** Справочники u-code, доступные для типа «Справочник». */
export const DIRECTORY_SLUGS: { value: string; label: string }[] = [
  { value: "positions", label: "Должности" },
  { value: "departments", label: "Департаменты" },
  { value: "locations", label: "Филиалы" },
  { value: "regions", label: "Регионы" },
  { value: "skills", label: "Навыки" },
  { value: "employment_types", label: "Типы трудоустройства" },
  { value: "experience_levels", label: "Уровни опыта" },
  { value: "property_categories", label: "Категории имущества" },
];
