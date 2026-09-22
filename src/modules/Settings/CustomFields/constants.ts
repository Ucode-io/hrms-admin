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

import type { MessageKey } from "../../../i18n/messages";
import type { FieldType } from "./types";

export type FieldTypeGroup = "text" | "number" | "choice" | "relation";

export type FieldTypeMeta = {
  type: FieldType;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  icon: LucideIcon;
  group: FieldTypeGroup;
  hasOptions?: boolean;
  hasTextRules?: boolean;
  hasNumberRules?: boolean;
  hasDateRules?: boolean;
  hasFileRules?: boolean;
};

export const FIELD_TYPES: FieldTypeMeta[] = [
  {
    type: "text",
    titleKey: "settings_custom_fields.type.text.title",
    descriptionKey: "settings_custom_fields.type.text.description",
    icon: Type,
    group: "text",
    hasTextRules: true,
  },
  {
    type: "textarea",
    titleKey: "settings_custom_fields.type.textarea.title",
    descriptionKey: "settings_custom_fields.type.textarea.description",
    icon: AlignLeft,
    group: "text",
    hasTextRules: true,
  },
  {
    type: "email",
    titleKey: "settings_custom_fields.type.email.title",
    descriptionKey: "settings_custom_fields.type.email.description",
    icon: AtSign,
    group: "text",
    hasTextRules: true,
  },
  {
    type: "phone",
    titleKey: "settings_custom_fields.type.phone.title",
    descriptionKey: "settings_custom_fields.type.phone.description",
    icon: Phone,
    group: "text",
    hasTextRules: true,
  },
  {
    type: "url",
    titleKey: "settings_custom_fields.type.url.title",
    descriptionKey: "settings_custom_fields.type.url.description",
    icon: Link2,
    group: "text",
    hasTextRules: true,
  },
  {
    type: "number",
    titleKey: "settings_custom_fields.type.number.title",
    descriptionKey: "settings_custom_fields.type.number.description",
    icon: Hash,
    group: "number",
    hasNumberRules: true,
  },
  {
    type: "money",
    titleKey: "settings_custom_fields.type.money.title",
    descriptionKey: "settings_custom_fields.type.money.description",
    icon: CircleDollarSign,
    group: "number",
    hasNumberRules: true,
  },
  {
    type: "date",
    titleKey: "settings_custom_fields.type.date.title",
    descriptionKey: "settings_custom_fields.type.date.description",
    icon: Calendar,
    group: "number",
    hasDateRules: true,
  },
  {
    type: "datetime",
    titleKey: "settings_custom_fields.type.datetime.title",
    descriptionKey: "settings_custom_fields.type.datetime.description",
    icon: CalendarClock,
    group: "number",
    hasDateRules: true,
  },
  {
    type: "boolean",
    titleKey: "settings_custom_fields.type.boolean.title",
    descriptionKey: "settings_custom_fields.type.boolean.description",
    icon: SquareCheck,
    group: "choice",
  },
  {
    type: "select",
    titleKey: "settings_custom_fields.type.select.title",
    descriptionKey: "settings_custom_fields.type.select.description",
    icon: ListFilter,
    group: "choice",
    hasOptions: true,
  },
  {
    type: "multiselect",
    titleKey: "settings_custom_fields.type.multiselect.title",
    descriptionKey: "settings_custom_fields.type.multiselect.description",
    icon: ListChecks,
    group: "choice",
    hasOptions: true,
  },
  {
    type: "radio",
    titleKey: "settings_custom_fields.type.radio.title",
    descriptionKey: "settings_custom_fields.type.radio.description",
    icon: CircleDot,
    group: "choice",
    hasOptions: true,
  },
  {
    type: "checkbox_group",
    titleKey: "settings_custom_fields.type.checkbox_group.title",
    descriptionKey: "settings_custom_fields.type.checkbox_group.description",
    icon: Layers,
    group: "choice",
    hasOptions: true,
  },
  {
    type: "file",
    titleKey: "settings_custom_fields.type.file.title",
    descriptionKey: "settings_custom_fields.type.file.description",
    icon: FileUp,
    group: "relation",
    hasFileRules: true,
  },
  {
    type: "employee",
    titleKey: "settings_custom_fields.type.employee.title",
    descriptionKey: "settings_custom_fields.type.employee.description",
    icon: UserRound,
    group: "relation",
  },
  {
    type: "directory",
    titleKey: "settings_custom_fields.type.directory.title",
    descriptionKey: "settings_custom_fields.type.directory.description",
    icon: Braces,
    group: "relation",
  },
];

export const FIELD_TYPE_MAP: Record<FieldType, FieldTypeMeta> = FIELD_TYPES.reduce(
  (acc, meta) => {
    acc[meta.type] = meta;
    return acc;
  },
  {} as Record<FieldType, FieldTypeMeta>
);

export const FIELD_TYPE_GROUPS: { id: FieldTypeGroup; labelKey: MessageKey }[] = [
  { id: "text", labelKey: "settings_custom_fields.type_group.text" },
  { id: "number", labelKey: "settings_custom_fields.type_group.number" },
  { id: "choice", labelKey: "settings_custom_fields.type_group.choice" },
  { id: "relation", labelKey: "settings_custom_fields.type_group.relation" },
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
export const DIRECTORY_SLUGS: { value: string; labelKey: MessageKey }[] = [
  { value: "positions", labelKey: "settings_custom_fields.directory.positions" },
  { value: "departments", labelKey: "settings_custom_fields.directory.departments" },
  { value: "locations", labelKey: "settings_custom_fields.directory.locations" },
  { value: "regions", labelKey: "settings_custom_fields.directory.regions" },
  { value: "skills", labelKey: "settings_custom_fields.directory.skills" },
  { value: "employment_types", labelKey: "settings_custom_fields.directory.employment_types" },
  { value: "experience_levels", labelKey: "settings_custom_fields.directory.experience_levels" },
  { value: "property_categories", labelKey: "settings_custom_fields.directory.property_categories" },
];
