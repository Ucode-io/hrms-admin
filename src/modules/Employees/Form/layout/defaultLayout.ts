import { STATIC_FIELD_MAP } from "./staticFields";
import type { EmployeeFormLayout, FormLayoutCard, FormLayoutItem } from "./types";
import { translate } from "../../../../i18n";

type CardSeed = {
  id: string;
  title: string;
  description?: string;
  column: FormLayoutCard["column"];
  /** Карточка вне конструктора — рендерится как есть (см. «Рабочие данные»). */
  locked?: boolean;
  fields: string[];
};

/** Раскладка «как было» до появления конструктора — она же кнопка «Сбросить». */
const getCardSeeds = (): CardSeed[] => [
  {
    id: "crd_personal",
    title: translate("employees.form_layout.card_personal_title"),
    description: translate("employees.form_layout.card_personal_description"),
    column: "left",
    fields: ["photo", "second_name", "first_name", "middle_name", "birth_date", "gender"],
  },
  {
    id: "crd_contacts",
    title: translate("employees.form_layout.card_contacts_title"),
    description: translate("employees.form_layout.card_contacts_description"),
    column: "left",
    fields: ["email", "personal_email", "phone", "work_phone", "telegram"],
  },
  {
    id: "crd_access",
    title: translate("employees.form_layout.card_access_title"),
    description: "",
    column: "left",
    fields: ["hrms_roles_id"],
  },
  {
    // Данные employee_work — пишутся отдельным запросом при создании, поэтому
    // карточка живёт вне конструктора и её состав не настраивается.
    id: "crd_work",
    title: translate("employees.form_layout.card_work_title"),
    description: "",
    column: "right",
    locked: true,
    fields: [
      "date_hire",
      "employment_types_id",
      "positions_id",
      "employee_work_reason_id",
      "salary",
      "departments_id",
      "experience_levels_id",
      "locations_id",
    ],
  },
];

export const createDefaultLayout = (): EmployeeFormLayout => {
  const cards: FormLayoutCard[] = [];
  const items: FormLayoutItem[] = [];

  getCardSeeds().forEach((seed, cardIndex) => {
    cards.push({
      id: seed.id,
      title: seed.title,
      description: seed.description ?? "",
      column: seed.column,
      system: true,
      locked: seed.locked ?? false,
      sortOrder: cardIndex,
    });

    seed.fields.forEach((key, fieldIndex) => {
      items.push({
        id: key,
        kind: "static",
        cardId: seed.id,
        width: STATIC_FIELD_MAP[key]?.defaultWidth ?? "half",
        sortOrder: fieldIndex,
      });
    });
  });

  return { cards, items };
};
