import type { EmployeeFormLayout } from "../../../Form/layout/types";
import { WORK_FIELDS, WORK_MODAL_CARD_ID } from "./workFields";

/**
 * Раскладка модалки «как было» до появления конструктора — она же кнопка
 * «Сбросить раскладку». Модалка — один плоский блок, поэтому карточка одна:
 * управлять карточками в окне 700px некуда и незачем.
 */
export const createDefaultWorkLayout = (): EmployeeFormLayout => ({
  cards: [
    {
      id: WORK_MODAL_CARD_ID,
      title: "Поля записи",
      description: "",
      column: "left",
      system: true,
      locked: false,
      sortOrder: 0,
    },
  ],
  items: WORK_FIELDS.map((meta, index) => ({
    id: meta.key,
    kind: "static" as const,
    cardId: WORK_MODAL_CARD_ID,
    width: meta.defaultWidth,
    sortOrder: index,
  })),
});
