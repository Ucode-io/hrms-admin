import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Lock, Plus, Trash2, X } from "lucide-react";

import type { CustomField } from "../../../Settings/CustomFields/types";
import DynamicFieldControl from "./DynamicFieldControl";
import { STATIC_FIELD_MAP, type StaticFieldContext } from "./staticFields";
import type {
  FormLayoutCard,
  FormLayoutItem,
  LayoutColumn,
  LayoutWidth,
} from "./types";
import type { useEmployeeFormLayout } from "./useEmployeeFormLayout";
import { useTranslation, translate } from "../../../../i18n";

const ITEM_ZONE_PREFIX = "items:";

/** Расстояние между плитками в сетке конструктора — участвует в расчёте ширины колонки. */
const BUILDER_GRID_GAP = 10;

/** Поле, которого сейчас нет ни в одной карточке — кандидат на добавление. */
type AddOption = {
  id: string;
  label: string;
  kind: FormLayoutItem["kind"];
};

type LayoutApi = ReturnType<typeof useEmployeeFormLayout>;

type FormLayoutAreaProps = {
  layoutApi: LayoutApi;
  /** Динамические поля таблицы user_base из справочника «Динамические поля». */
  dynamicFields: CustomField[];
  fieldContext: StaticFieldContext;
  /** Ошибки валидации динамических полей: ключ поля → сообщение. */
  dynamicErrors: Record<string, string>;
  builderMode: boolean;
  isEdit: boolean;
  labelStyle: React.CSSProperties;
  inputStyle: React.CSSProperties;
  brandColor: string;
};

const cardShell: React.CSSProperties = {
  borderRadius: "14px",
  border: "1px solid #e2e8f0",
  backgroundColor: "#fff",
};

const cardHeader: React.CSSProperties = {
  padding: "18px 24px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: "15px",
  fontWeight: 700,
  color: "#0f172a",
};

const ghostButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  padding: "6px 10px",
  fontSize: "12px",
  fontWeight: 500,
  color: "#475569",
  backgroundColor: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  cursor: "pointer",
};

/* ─────────── Режим заполнения ─────────── */

type FilledItemProps = {
  item: FormLayoutItem;
  title: string;
  hint?: string;
  /** Подсказка под полем красная, когда это сообщение об ошибке валидации. */
  hintTone?: "error";
  children: ReactNode;
  bare?: boolean;
  labelStyle: React.CSSProperties;
};

function FilledItem({
  item,
  title,
  hint,
  hintTone,
  children,
  bare,
  labelStyle,
}: FilledItemProps) {
  return (
    <div style={{ gridColumn: item.width === "full" ? "1 / -1" : undefined }}>
      {bare ? (
        children
      ) : (
        <>
          <label style={labelStyle}>{title}</label>
          {children}
          {hint && (
            <p
              style={{
                marginTop: "8px",
                fontSize: "12px",
                color: hintTone === "error" ? "#f04438" : "#94a3b8",
              }}
            >
              {hint}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/* ─────────── Плитка конструктора ─────────── */

type TileBodyProps = {
  title: string;
  badge: string;
  note?: string;
  removable: boolean;
  onRemove?: () => void;
  /** Плитка-«дырка» на месте переносимого поля. */
  placeholder?: boolean;
  /** Плитка в DragOverlay — летит за курсором. */
  overlay?: boolean;
  resizing?: boolean;
  accentColor: string;
};

/** Внешний вид плитки поля. Используется в сетке и в DragOverlay. */
function TileBody({
  title,
  badge,
  note,
  removable,
  onRemove,
  placeholder,
  overlay,
  resizing,
  accentColor,
}: TileBodyProps) {
  const { t } = useTranslation();
  const borderColor =
    resizing || overlay ? accentColor : placeholder ? "#c7d2fe" : "#e2e8f0";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        height: "100%",
        padding: "10px 12px",
        borderRadius: "10px",
        border: `1px ${placeholder ? "dashed" : "solid"} ${borderColor}`,
        backgroundColor: placeholder ? "#f8fafc" : "#fff",
        opacity: placeholder ? 0.55 : 1,
        boxShadow: overlay ? "0 12px 28px rgba(15, 23, 42, 0.16)" : "none",
        boxSizing: "border-box",
      }}
    >
      <GripVertical
        style={{ width: "16px", height: "16px", flexShrink: 0, color: "#cbd5e1" }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <p
          style={{
            margin: 0,
            fontSize: "13px",
            fontWeight: 500,
            color: "#0f172a",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </p>
        <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#94a3b8" }}>
          {badge}
          {note ? ` · ${note}` : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={removable ? onRemove : undefined}
        onPointerDown={(event) => event.stopPropagation()}
        disabled={!removable}
        title={removable ? t("employees.form_layout.remove_field") : t("employees.form_layout.required_field")}
        style={{
          ...ghostButton,
          padding: "4px 6px",
          color: removable ? "#94a3b8" : "#cbd5e1",
          cursor: removable ? "pointer" : "not-allowed",
        }}
      >
        {removable ? (
          <X style={{ width: "14px", height: "14px" }} />
        ) : (
          <Lock style={{ width: "13px", height: "13px" }} />
        )}
      </button>
    </div>
  );
}

export type SortableTileProps = {
  item: FormLayoutItem;
  title: string;
  badge: string;
  note?: string;
  removable: boolean;
  /** Колонок в сетке карточки — от этого зависит ширина «половины». */
  columns: number;
  accentColor: string;
  highlight?: "on" | "fading";
  onRemove: () => void;
  onCommitWidth: (width: LayoutWidth) => void;
};

type ResizeState = {
  /** Живая ширина плитки — следует за курсором. */
  live: number;
  /** Ширина, которая применится при отпускании. */
  target: LayoutWidth;
};

/**
 * Плитка поля: перенос — за любое место плитки (dnd-kit), ресайз — за правый
 * край, как у нативного ресайзера. Во время ресайза плитка растягивается за
 * курсором, а при отпускании прилипает к ближайшей ширине (половина / вся строка).
 */
export function SortableTile({
  item,
  title,
  badge,
  note,
  removable,
  columns,
  accentColor,
  highlight,
  onRemove,
  onCommitWidth,
}: SortableTileProps) {
  const { t } = useTranslation();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [resize, setResize] = useState<ResizeState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  /** Геометрия на момент начала ресайза: стартовые X/размеры и обе ширины-кандидаты. */
  const geometry = useRef({ startX: 0, startWidth: 0, startHeight: 0, half: 0, full: 0 });

  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({
      id: item.id,
      data: { kind: "item", cardId: item.cardId },
      disabled: Boolean(resize),
    });

  const setRefs = (node: HTMLDivElement | null) => {
    wrapperRef.current = node;
    setNodeRef(node);
  };

  const applyResize = (next: ResizeState | null) => {
    resizeRef.current = next;
    setResize(next);
  };

  const canResize = columns > 1;

  const beginResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canResize) return;
    // Ресайз не должен запускать перенос плитки.
    event.preventDefault();
    event.stopPropagation();

    const wrapper = wrapperRef.current;
    const grid = wrapper?.closest("[data-card-grid]");
    if (!wrapper || !grid) return;

    const gridWidth = grid.getBoundingClientRect().width;
    const half = (gridWidth - BUILDER_GRID_GAP * (columns - 1)) / columns;
    const { width: startWidth, height: startHeight } = wrapper.getBoundingClientRect();

    geometry.current = {
      startX: event.clientX,
      startWidth,
      startHeight,
      half,
      full: gridWidth,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Захват не критичен: без него ресайз работает, пока курсор над краем.
    }
    applyResize({ live: startWidth, target: item.width });
  };

  const moveResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeRef.current) return;

    const { startX, startWidth, half, full } = geometry.current;
    const projected = startWidth + (event.clientX - startX);
    const live = Math.min(Math.max(projected, half * 0.6), full);
    const target: LayoutWidth = projected > (half + full) / 2 ? "full" : "half";

    applyResize({ live, target });
  };

  const endResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = resizeRef.current;
    if (!current) return;

    applyResize(null);
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // См. beginResize — захвата могло не быть.
    }
    if (current.target !== item.width) {
      onCommitWidth(current.target);
    }
  };

  /**
   * Во время ресайза ячейка сетки НЕ меняется (иначе 1fr-колонки пересчитались
   * бы от растянутой плитки и соседние ряды поехали бы). Обёртка фиксирует
   * высоту ячейки, а сама плитка становится абсолютным «призраком», который
   * тянется за курсором поверх сетки. Настоящая ширина применяется при отпускании.
   */
  const wrapperStyle = {
    position: "relative",
    gridColumn: item.width === "full" ? "1 / -1" : undefined,
    transform: resize ? undefined : CSS.Translate.toString(transform),
    transition: resize ? "none" : transition,
    cursor: "grab",
    touchAction: "none",
    userSelect: resize ? "none" : undefined,
    ...(resize ? { height: `${geometry.current.startHeight}px`, zIndex: 5 } : {}),
    "--efb-accent": accentColor,
  } as CSSProperties;

  const liveLayerStyle: CSSProperties = resize
    ? {
        position: "absolute",
        top: 0,
        left: 0,
        width: `${resize.live}px`,
        height: "100%",
        zIndex: 5,
      }
    : { position: "relative", height: "100%" };

  return (
    <div
      ref={setRefs}
      data-layout-item={item.id}
      className={
        highlight
          ? `employee-form-field-added${highlight === "fading" ? " employee-form-field-added-fading" : ""}`
          : undefined
      }
      style={wrapperStyle}
      {...attributes}
      {...listeners}
    >
      {/* «Дырка» на месте плитки — показывает её текущую ячейку. */}
      {resize && (
        <div
          key="ghost-hole"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "10px",
            border: "1px dashed #e2e8f0",
            backgroundColor: "#f8fafc",
          }}
        />
      )}

      {/* key стабилен: при старте ресайза DOM-узлы не пересоздаются,
          иначе pointer capture на крае слетел бы. */}
      <div key="tile" style={liveLayerStyle}>
        <TileBody
          title={title}
          badge={badge}
          note={note}
          removable={removable}
          onRemove={onRemove}
          placeholder={isDragging}
          resizing={Boolean(resize)}
          accentColor={accentColor}
        />

        {canResize && !isDragging && (
          <div
            className="efb-resize-edge"
            data-active={resize ? "true" : undefined}
            role="separator"
            aria-orientation="vertical"
            aria-label={t("employees.form_layout.resize_field_label")}
            title={t("employees.form_layout.resize_field_hint")}
            onPointerDown={beginResize}
            onPointerMove={moveResize}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            onDoubleClick={() => onCommitWidth(item.width === "full" ? "half" : "full")}
          >
            <span />
          </div>
        )}

        {resize && (
          <span className="efb-resize-badge">
            {resize.target === "full" ? t("employees.form_layout.width_full") : t("employees.form_layout.width_half")}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─────────── Карточка ─────────── */

type CardBlockProps = {
  card: FormLayoutCard;
  items: FormLayoutItem[];
  columns: number;
  builderMode: boolean;
  renderItem: (item: FormLayoutItem) => ReactNode;
  onRename: (title: string) => void;
  onDelete: () => void;
  /** Список полей, которые можно добавить именно в эту карточку. */
  addOptions: AddOption[];
  onAdd: (option: AddOption) => void;
};

function CardBlock({
  card,
  items,
  columns,
  builderMode,
  renderItem,
  onRename,
  onDelete,
  addOptions,
  onAdd,
}: CardBlockProps) {
  const { t } = useTranslation();
  const [addOpen, setAddOpen] = useState(false);

  const { setNodeRef, attributes, listeners, transform, transition, isDragging } =
    useSortable({ id: card.id, data: { kind: "card" }, disabled: !builderMode });

  // Зона для полей: отдельный id, чтобы можно было бросить в пустую карточку.
  const { setNodeRef: setZoneRef, isOver } = useDroppable({
    id: `${ITEM_ZONE_PREFIX}${card.id}`,
    data: { kind: "item-zone", cardId: card.id },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        ...cardShell,
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        borderColor: isDragging ? "#c7d2fe" : "#e2e8f0",
      }}
    >
      <div style={{ ...cardHeader, display: "flex", alignItems: "center", gap: "10px" }}>
        {builderMode && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            title={t("employees.form_layout.reorder_cards_hint")}
            style={{
              border: "none",
              background: "none",
              padding: 0,
              color: "#cbd5e1",
              cursor: "grab",
              touchAction: "none",
            }}
          >
            <GripVertical style={{ width: "18px", height: "18px" }} />
          </button>
        )}

        {builderMode ? (
          <input
            value={card.title}
            onChange={(event) => onRename(event.target.value)}
            placeholder={t("employees.form_layout.card_title_placeholder")}
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: "15px",
              fontWeight: 700,
              color: "#0f172a",
              border: "1px solid transparent",
              borderRadius: "8px",
              padding: "4px 8px",
              outline: "none",
              backgroundColor: "#f8fafc",
            }}
          />
        ) : (
          <span style={{ flex: 1, minWidth: 0 }}>{card.title}</span>
        )}

        {builderMode && (
          <>
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setAddOpen((prev) => !prev)}
                disabled={addOptions.length === 0}
                title={
                  addOptions.length === 0
                    ? t("employees.form_layout.all_fields_placed")
                    : t("employees.form_layout.add_field_to_card")
                }
                style={{
                  ...ghostButton,
                  color: addOptions.length === 0 ? "#cbd5e1" : "#475569",
                  cursor: addOptions.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                <Plus style={{ width: "14px", height: "14px" }} /> {t("employees.form_layout.field")}
              </button>

              {addOpen && addOptions.length > 0 && (
                <>
                  <div
                    onClick={() => setAddOpen(false)}
                    style={{ position: "fixed", inset: 0, zIndex: 20 }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      right: 0,
                      zIndex: 21,
                      width: "280px",
                      maxHeight: "300px",
                      overflowY: "auto",
                      padding: "6px",
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0",
                      backgroundColor: "#fff",
                      boxShadow: "0 16px 36px rgba(15, 23, 42, 0.12)",
                    }}
                  >
                    <p
                      style={{
                        margin: "4px 8px 6px",
                        fontSize: "11px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: "#94a3b8",
                      }}
                    >
                      {t("employees.form_layout.add_to_card", { card: card.title || t("employees.form_layout.untitled_card") })}
                    </p>
                    {addOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          onAdd(option);
                          setAddOpen(false);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                          width: "100%",
                          padding: "8px 10px",
                          fontSize: "13px",
                          color: "#0f172a",
                          textAlign: "left",
                          background: "none",
                          border: "none",
                          borderRadius: "8px",
                          cursor: "pointer",
                        }}
                        onMouseEnter={(event) =>
                          (event.currentTarget.style.backgroundColor = "#f8fafc")
                        }
                        onMouseLeave={(event) =>
                          (event.currentTarget.style.backgroundColor = "transparent")
                        }
                      >
                        <span
                          style={{
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {option.label}
                        </span>
                        <span style={{ fontSize: "11px", color: "#94a3b8", flexShrink: 0 }}>
                          {option.kind === "static" ? t("employees.form_layout.badge_static") : t("employees.form_layout.badge_dynamic")}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={card.system ? undefined : onDelete}
              disabled={card.system}
              title={
                card.system
                  ? t("employees.form_layout.system_card_hint")
                  : t("employees.form_layout.delete_card_hint")
              }
              style={{
                ...ghostButton,
                padding: "6px 8px",
                color: card.system ? "#cbd5e1" : "#ef4444",
                cursor: card.system ? "not-allowed" : "pointer",
              }}
            >
              <Trash2 style={{ width: "14px", height: "14px" }} />
            </button>
          </>
        )}
      </div>

      <div
        ref={setZoneRef}
        style={{
          padding: "24px",
          backgroundColor: isOver ? "#f8fafc" : undefined,
          transition: "background-color 0.15s",
        }}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={rectSortingStrategy}
        >
          <div
            data-card-grid
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              gap: builderMode ? `${BUILDER_GRID_GAP}px` : "20px 24px",
            }}
          >
            {items.map((item) => renderItem(item))}
          </div>
        </SortableContext>

        {items.length === 0 && (
          <p style={{ margin: 0, textAlign: "center", fontSize: "13px", color: "#94a3b8" }}>
            {builderMode ? t("employees.form_layout.drop_fields_here") : t("employees.form_layout.no_fields")}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─────────── Область формы ─────────── */

export default function FormLayoutArea({
  layoutApi,
  dynamicFields,
  fieldContext,
  dynamicErrors,
  builderMode,
  isEdit,
  labelStyle,
  inputStyle,
  brandColor,
}: FormLayoutAreaProps) {
  const { t } = useTranslation();
  const {
    layout,
    cardsOfColumn,
    itemsOfCard,
    unplaced,
    moveItem,
    addItem,
    removeItem,
    setItemWidth,
    addCard,
    updateCard,
    deleteCard,
    reorderCards,
  } = layoutApi;

  const [draggingItem, setDraggingItem] = useState<FormLayoutItem | null>(null);
  /** Поле, только что добавленное через меню карточки — подсвечиваем и скроллим к нему. */
  const [added, setAdded] = useState<{ id: string; phase: "on" | "fading" } | null>(null);

  useEffect(() => {
    if (!added || added.phase !== "on") return;

    const node = document.querySelector(`[data-layout-item="${added.id}"]`);
    node?.scrollIntoView({ behavior: "smooth", block: "center" });

    const fade = window.setTimeout(
      () => setAdded((prev) => (prev?.id === added.id ? { ...prev, phase: "fading" } : prev)),
      900
    );
    const clear = window.setTimeout(
      () => setAdded((prev) => (prev?.id === added.id ? null : prev)),
      2000
    );

    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(clear);
    };
  }, [added]);

  const sensors = useSensors(
    // Порог активации побольше: плитка драгается за любое место, и клик по
    // кнопке внутри не должен случайно превращаться в перенос.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const collisionDetection: CollisionDetection = (args) => {
    const byPointer = pointerWithin(args);
    return byPointer.length > 0 ? byPointer : rectIntersection(args);
  };

  const dynamicById = useMemo(
    () => new Map(dynamicFields.map((field) => [field.id, field])),
    [dynamicFields]
  );

  /** Поля вне формы: их предлагает меню «+ Поле» в шапке каждой карточки. */
  const addOptions = useMemo<AddOption[]>(
    () => [
      ...unplaced.static.map((meta) => ({
        id: meta.key,
        label: meta.label,
        kind: "static" as const,
      })),
      ...unplaced.dynamic.map((id) => ({
        id,
        label: dynamicById.get(id)?.label ?? id,
        kind: "dynamic" as const,
      })),
    ],
    [unplaced, dynamicById]
  );

  const handleAdd = (option: AddOption, cardId: string) => {
    addItem(option.id, option.kind, cardId);
    setAdded({ id: option.id, phase: "on" });
  };

  const titleOf = (item: FormLayoutItem) =>
    item.kind === "static"
      ? STATIC_FIELD_MAP[item.id]?.label ?? item.id
      : dynamicById.get(item.id)?.label ?? item.id;

  /** Поля «только при создании» в режиме редактирования не показываем. */
  const isHiddenInEdit = (item: FormLayoutItem) =>
    isEdit && item.kind === "static" && Boolean(STATIC_FIELD_MAP[item.id]?.createOnly);

  const visibleItems = (cardId: string) =>
    itemsOfCard(cardId).filter((item) => builderMode || !isHiddenInEdit(item));

  const renderFilled = (item: FormLayoutItem): ReactNode => {
    if (item.kind === "static") {
      const meta = STATIC_FIELD_MAP[item.id];
      if (!meta) return null;

      return (
        <FilledItem
          key={item.id}
          item={item}
          title={meta.label}
          hint={meta.hint}
          bare={meta.bare}
          labelStyle={labelStyle}
        >
          {meta.render(fieldContext)}
        </FilledItem>
      );
    }

    const field = dynamicById.get(item.id);
    if (!field) return null;

    return (
      <FilledItem
        key={item.id}
        item={item}
        title={`${field.label}${field.rules.required ? " *" : ""}`}
        hint={dynamicErrors[field.key] || field.hint}
        hintTone={dynamicErrors[field.key] ? "error" : undefined}
        labelStyle={labelStyle}
      >
        <DynamicFieldControl
          field={field}
          control={fieldContext.control}
          inputStyle={inputStyle}
          brandColor={brandColor}
          invalid={Boolean(dynamicErrors[field.key])}
        />
      </FilledItem>
    );
  };

  const renderBuilder = (item: FormLayoutItem, columns: number): ReactNode => {
    const meta = item.kind === "static" ? STATIC_FIELD_MAP[item.id] : undefined;

    return (
      <SortableTile
        key={item.id}
        item={item}
        title={titleOf(item)}
        badge={item.kind === "static" ? t("employees.form_layout.badge_static") : t("employees.form_layout.badge_dynamic")}
        note={meta?.createOnly ? t("employees.form_layout.create_only") : undefined}
        removable={!meta?.required}
        columns={columns}
        accentColor={brandColor}
        highlight={added?.id === item.id ? added.phase : undefined}
        onRemove={() => removeItem(item.id)}
        onCommitWidth={(width) => setItemWidth(item.id, width)}
      />
    );
  };

  /** Карточка, которой принадлежит элемент под курсором (плитка, зона или сама карточка). */
  const cardIdOf = (overId: string): string => {
    if (overId.startsWith(ITEM_ZONE_PREFIX)) return overId.slice(ITEM_ZONE_PREFIX.length);
    if (layout.cards.some((card) => card.id === overId)) return overId;
    return layout.items.find((item) => item.id === overId)?.cardId ?? "";
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    if (active.data.current?.kind !== "item") return;
    setDraggingItem(layout.items.find((item) => item.id === active.id) ?? null);
  };

  /** Живой перенос между карточками: поле «переезжает» ещё до того, как его бросили. */
  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || active.data.current?.kind !== "item") return;

    const activeId = String(active.id);
    const sourceCardId = layout.items.find((item) => item.id === activeId)?.cardId;
    const targetCardId = cardIdOf(String(over.id));
    if (!sourceCardId || !targetCardId || sourceCardId === targetCardId) return;

    const target = itemsOfCard(targetCardId);
    const overIndex = target.findIndex((item) => item.id === over.id);
    moveItem(activeId, targetCardId, overIndex === -1 ? target.length : overIndex);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingItem(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (active.data.current?.kind === "card") {
      const card = layout.cards.find((entry) => entry.id === activeId);
      const overCardId = cardIdOf(overId);
      if (!card || !overCardId || overCardId === activeId) return;

      const ids = cardsOfColumn(card.column).map((entry) => entry.id);
      const from = ids.indexOf(activeId);
      const to = ids.indexOf(overCardId);
      if (from === -1 || to === -1) return;

      const next = [...ids];
      next.splice(to, 0, next.splice(from, 1)[0]);
      reorderCards(card.column, next);
      return;
    }

    const targetCardId = cardIdOf(overId);
    if (!targetCardId) return;

    const target = itemsOfCard(targetCardId);
    const overIndex = target.findIndex((item) => item.id === overId);
    moveItem(activeId, targetCardId, overIndex === -1 ? target.length : overIndex);
  };

  const renderColumn = (column: LayoutColumn) => {
    // «Рабочие данные» вне конструктора: карточка рендерится как есть.
    const cards = cardsOfColumn(column).filter((card) => !builderMode || !card.locked);
    const columns = column === "left" ? 2 : 1;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <SortableContext
          items={cards.map((card) => card.id)}
          strategy={verticalListSortingStrategy}
        >
          {cards.map((card) => {
            const items = visibleItems(card.id);
            if (!builderMode && items.length === 0) return null;

            return (
              <CardBlock
                key={card.id}
                card={card}
                items={items}
                columns={columns}
                builderMode={builderMode}
                renderItem={
                  builderMode ? (item) => renderBuilder(item, columns) : renderFilled
                }
                onRename={(title) => updateCard(card.id, { title })}
                onDelete={() => deleteCard(card.id)}
                addOptions={addOptions}
                onAdd={(option) => handleAdd(option, card.id)}
              />
            );
          })}
        </SortableContext>

        {builderMode && (
          <button
            type="button"
            onClick={() => addCard()}
            style={{
              ...ghostButton,
              width: "100%",
              padding: "14px",
              borderStyle: "dashed",
              fontSize: "13px",
            }}
          >
            <Plus style={{ width: "15px", height: "15px" }} /> {t("employees.form_layout.add_card")}
          </button>
        )}
      </div>
    );
  };

  const showRightColumn = !builderMode && !isEdit;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingItem(null)}
    >
      {builderMode && addOptions.length > 0 && <UnplacedHint options={addOptions} />}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: showRightColumn ? "1fr 400px" : "1fr",
          gap: "20px",
          alignItems: "start",
        }}
      >
        {renderColumn("left")}
        {showRightColumn && renderColumn("right")}
      </div>

      {/* Плавающая копия плитки — оригинал остаётся «дыркой» в сетке. */}
      <DragOverlay dropAnimation={null}>
        {draggingItem && (
          <TileBody
            title={titleOf(draggingItem)}
            badge={draggingItem.kind === "static" ? t("employees.form_layout.badge_static") : t("employees.form_layout.badge_dynamic")}
            removable={false}
            overlay
            accentColor={brandColor}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

/* ─────────── Подсказка о полях вне формы ─────────── */

/**
 * Список полей, которых нет ни в одной карточке. Добавляются они кнопкой
 * «+ Поле» в шапке нужной карточки — так сразу видно, куда именно попадёт поле.
 */
function UnplacedHint({ options }: { options: AddOption[] }) {
  const { t } = useTranslation();
  return (
    <div style={{ ...cardShell, marginBottom: "20px", padding: "14px 20px" }}>
      <p style={{ margin: 0, fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>
        {t("employees.form_layout.outside_form_count", { count: options.length })}
      </p>
      <p style={{ margin: "2px 0 10px", fontSize: "12px", color: "#94a3b8" }}>
        {t("employees.form_layout.outside_form_hint")}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {options.map((option) => (
          <span
            key={option.id}
            style={{
              padding: "5px 10px",
              fontSize: "12px",
              color: "#64748b",
              backgroundColor: "#f8fafc",
              border: "1px dashed #e2e8f0",
              borderRadius: "8px",
            }}
          >
            {option.label}
          </span>
        ))}
      </div>
    </div>
  );
}
