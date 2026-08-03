import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";

import type { CustomField } from "../../../../Settings/CustomFields/types";
import { DynamicFieldInput } from "../../../Form/layout/DynamicFieldControl";
import { SortableTile } from "../../../Form/layout/FormLayoutArea";
import type { useFormLayout } from "../../../Form/layout/useEmployeeFormLayout";
import type { FormLayoutItem } from "../../../Form/layout/types";
import { WORK_FIELD_MAP, WORK_MODAL_CARD_ID, type WorkFieldContext } from "./workFields";

/**
 * Поля модалки «Добавить/изменить должность», разложенные по сохранённой
 * раскладке (`entity_slug = 'employee_works'`). Два режима, как в форме
 * сотрудника: заполнение и конструктор.
 *
 * Карточек здесь нет — модалка это один плоский блок, поэтому вся раскладка
 * живёт в единственной карточке, а конструктор управляет только порядком и
 * шириной полей.
 */

const GRID_COLUMNS = 2;

const DYNAMIC_INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
  backgroundColor: "#fff",
  padding: "9px 12px",
  fontSize: "13px",
  color: "#1e293b",
  outline: "none",
};

type WorkFieldsAreaProps = {
  layoutApi: ReturnType<typeof useFormLayout>;
  fieldContext: WorkFieldContext;
  dynamicFields: CustomField[];
  customData: Record<string, unknown>;
  customErrors: Record<string, string>;
  onCustomChange: (key: string, value: unknown) => void;
  builderMode: boolean;
  brandColor: string;
};

export default function WorkFieldsArea({
  layoutApi,
  fieldContext,
  dynamicFields,
  customData,
  customErrors,
  onCustomChange,
  builderMode,
  brandColor,
}: WorkFieldsAreaProps) {
  const [addOpen, setAddOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const dynamicById = useMemo(
    () => new Map(dynamicFields.map((field) => [field.id, field])),
    [dynamicFields]
  );

  /** Поля, которых нет в этом режиме модалки: дата окончания и причина возврата. */
  const isHiddenInMode = (item: FormLayoutItem): boolean => {
    if (item.kind !== "static") return false;
    const meta = WORK_FIELD_MAP[item.id];
    if (!meta) return true;
    if (meta.editOnly && fieldContext.mode !== "edit") return true;
    if (meta.hiddenOnReturn && fieldContext.mode === "return") return true;
    return false;
  };

  const items = layoutApi
    .itemsOfCard(WORK_MODAL_CARD_ID)
    .filter((item) => builderMode || !isHiddenInMode(item));

  const titleOf = (item: FormLayoutItem): string =>
    item.kind === "static"
      ? WORK_FIELD_MAP[item.id]?.label ?? item.id
      : dynamicById.get(item.id)?.label ?? "Поле";

  const addOptions = [
    ...layoutApi.unplaced.static.map((meta) => ({
      id: meta.key,
      kind: "static" as const,
      label: meta.label,
    })),
    ...layoutApi.unplaced.dynamic
      .map((id) => dynamicById.get(id))
      .filter((field): field is CustomField => Boolean(field))
      .map((field) => ({ id: field.id, kind: "dynamic" as const, label: field.label })),
  ];

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;

    const overIndex = items.findIndex((item) => item.id === over.id);
    layoutApi.moveItem(
      String(active.id),
      WORK_MODAL_CARD_ID,
      overIndex === -1 ? items.length : overIndex
    );
  };

  const renderFilled = (item: FormLayoutItem) => {
    const isFull = item.width === "full";

    if (item.kind === "static") {
      const meta = WORK_FIELD_MAP[item.id];
      if (!meta) return null;

      return (
        <div key={item.id} style={{ gridColumn: isFull ? "1 / -1" : undefined }}>
          <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
            {meta.label}
          </label>
          {meta.render(fieldContext)}
        </div>
      );
    }

    const field = dynamicById.get(item.id);
    if (!field) return null;

    const error = customErrors[field.key];

    return (
      <div key={item.id} style={{ gridColumn: isFull ? "1 / -1" : undefined }}>
        <label className="mb-1.5 block text-[13px] font-medium text-slate-700">
          {field.label}
          {field.rules.required ? " *" : ""}
        </label>
        <DynamicFieldInput
          field={field}
          value={customData[field.key]}
          onChange={(next) => onCustomChange(field.key, next)}
          inputStyle={DYNAMIC_INPUT_STYLE}
          brandColor={brandColor}
          invalid={Boolean(error)}
        />
        {(error || field.hint) && (
          <p
            className="mt-1.5 text-[12px]"
            style={{ color: error ? "#f04438" : "#94a3b8" }}
          >
            {error || field.hint}
          </p>
        )}
      </div>
    );
  };

  if (!builderMode) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {items.map(renderFilled)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="m-0 text-[12px] text-slate-400">
          Перетащите поле, чтобы изменить порядок. Ширина — за правый край плитки.
        </p>
        <div className="relative ml-auto">
          <button
            type="button"
            onClick={() => setAddOpen((prev) => !prev)}
            disabled={addOptions.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Поле{addOptions.length > 0 ? ` (${addOptions.length})` : ""}
          </button>

          {addOpen && addOptions.length > 0 && (
            <div className="absolute right-0 z-10 mt-1 max-h-56 w-56 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              {addOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    layoutApi.addItem(option.id, option.kind, WORK_MODAL_CARD_ID);
                    setAddOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left text-[13px] text-slate-700 transition hover:bg-slate-50"
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={items.map((item) => item.id)} strategy={rectSortingStrategy}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`,
              gap: "10px",
            }}
          >
            {items.map((item) => (
              <SortableTile
                key={item.id}
                item={item}
                title={titleOf(item)}
                badge={item.kind === "static" ? "статичное" : "динамическое"}
                note={
                  item.kind === "static" && WORK_FIELD_MAP[item.id]?.editOnly
                    ? "только при изменении"
                    : undefined
                }
                removable
                columns={GRID_COLUMNS}
                accentColor={brandColor}
                onRemove={() => layoutApi.removeItem(item.id)}
                onCommitWidth={(width) => layoutApi.setItemWidth(item.id, width)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {items.length === 0 && (
        <p className="m-0 py-6 text-center text-[13px] text-slate-400">
          В форме не осталось полей — добавьте их кнопкой «Поле».
        </p>
      )}
    </div>
  );
}
