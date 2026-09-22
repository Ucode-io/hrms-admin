import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  EMPLOYEE_FORM_ENTITY,
  useFormLayoutQuery,
  useSaveFormLayout,
} from "../../../../api/services/formLayout.service";
import { createDefaultLayout } from "./defaultLayout";
import { STATIC_FIELD_MAP, STATIC_FIELDS } from "./staticFields";
import type {
  EmployeeFormLayout,
  FormLayoutCard,
  FormLayoutItem,
  LayoutColumn,
  LayoutWidth,
} from "./types";
import { translate } from "../../../../i18n";

const createId = (prefix: string): string =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

const sortBy = <T extends { sortOrder: number }>(items: T[]): T[] =>
  [...items].sort((a, b) => a.sortOrder - b.sortOrder);

const reindex = <T extends { sortOrder: number }>(items: T[]): T[] =>
  items.map((item, index) => ({ ...item, sortOrder: index }));

/**
 * Приводит сохранённую раскладку к текущему коду и схеме динамических полей:
 * выкидывает элементы, которых больше нет, и возвращает обязательные статичные
 * поля, если их успели убрать в старой версии.
 */
const reconcile = (
  layout: EmployeeFormLayout,
  dynamicIds: string[],
  registry: LayoutRegistry
): EmployeeFormLayout => {
  // Раскладки, сохранённые до появления `locked`, дочитываем из дефолта.
  const lockedByDefault = new Set(
    registry
      .createDefault()
      .cards.filter((card) => card.locked)
      .map((card) => card.id)
  );
  const cards = layout.cards.map((card) => ({
    ...card,
    locked: card.locked ?? lockedByDefault.has(card.id),
  }));

  const cardIds = new Set(cards.map((card) => card.id));
  const dynamicSet = new Set(dynamicIds);

  const items = layout.items.filter((item) => {
    if (!cardIds.has(item.cardId)) return false;
    return item.kind === "static"
      ? registry.staticFields.some((meta) => meta.key === item.id)
      : dynamicSet.has(item.id);
  });

  const placed = new Set(items.map((item) => item.id));
  const fallbackCardId = layout.cards[0]?.id;

  if (fallbackCardId) {
    registry.staticFields
      .filter((meta) => meta.required && !placed.has(meta.key))
      .forEach((meta) => {
        items.push({
          id: meta.key,
          kind: "static",
          cardId: fallbackCardId,
          width: meta.defaultWidth,
          sortOrder: items.length,
        });
      });
  }

  return { cards, items };
};

/** Что хук должен знать о статичных полях конкретной формы. */
export type LayoutStaticField = {
  key: string;
  label: string;
  defaultWidth: LayoutWidth;
  required?: boolean;
};

export type LayoutRegistry = {
  createDefault: () => EmployeeFormLayout;
  /** Все статичные поля формы: по ним считаются «вне формы» и обязательные. */
  staticFields: LayoutStaticField[];
};

const EMPLOYEE_FORM_REGISTRY: LayoutRegistry = {
  createDefault: createDefaultLayout,
  staticFields: STATIC_FIELDS,
};

/**
 * Раскладка формы: какие карточки есть, что в них лежит и в каком порядке.
 * Хранится на сервере одним документом (`form_layout_*`) на пару
 * (компания, таблица), правки копятся локально и уходят одним запросом по кнопке
 * «Готово» — иначе каждое перетаскивание было бы отдельным сохранением.
 */
export const useFormLayout = (
  entitySlug: string,
  dynamicFieldIds: string[],
  registry: LayoutRegistry
) => {
  const { data: stored, isLoading } = useFormLayoutQuery(entitySlug);
  const saveMutation = useSaveFormLayout(entitySlug);

  const [layout, setLayout] = useState<EmployeeFormLayout>(registry.createDefault);
  /** Есть несохранённые правки — тогда ответ сервера уже не перетирает состояние. */
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);

  const edit = useCallback(
    (updater: (prev: EmployeeFormLayout) => EmployeeFormLayout) => {
      dirtyRef.current = true;
      setDirty(true);
      setLayout(updater);
    },
    []
  );

  // Раскладка компании приезжает после первого рендера — подхватываем её, пока
  // пользователь ничего не менял. Пустой ответ = компания её не настраивала,
  // остаётся раскладка по умолчанию из кода.
  useEffect(() => {
    if (!stored || dirtyRef.current) return;
    setLayout(stored);
  }, [stored]);

  const dynamicKey = dynamicFieldIds.join("|");

  const normalized = useMemo(
    () => reconcile(layout, dynamicKey ? dynamicKey.split("|") : [], registry),
    [layout, dynamicKey, registry]
  );

  const cardsOfColumn = useCallback(
    (column: LayoutColumn) =>
      sortBy(normalized.cards.filter((card) => card.column === column)),
    [normalized.cards]
  );

  const itemsOfCard = useCallback(
    (cardId: string) => sortBy(normalized.items.filter((item) => item.cardId === cardId)),
    [normalized.items]
  );

  /** Поля, которых нет ни в одной карточке — их предлагаем добавить в конструкторе. */
  const unplaced = useMemo(() => {
    const placed = new Set(normalized.items.map((item) => item.id));

    return {
      static: registry.staticFields.filter((meta) => !placed.has(meta.key)),
      dynamic: dynamicFieldIds.filter((id) => !placed.has(id)),
    };
  }, [normalized.items, dynamicFieldIds, registry.staticFields]);

  /** Карточки, которые редактируются в конструкторе (без «Рабочих данных»). */
  const editableCards = useMemo(
    () => sortBy(normalized.cards.filter((card) => !card.locked)),
    [normalized.cards]
  );

  const moveItem = useCallback(
    (itemId: string, targetCardId: string, targetIndex: number) => {
      edit((prev) => {
        const source = prev.items.find((item) => item.id === itemId);
        if (!source) return prev;

        const target = sortBy(
          prev.items.filter(
            (item) => item.cardId === targetCardId && item.id !== itemId
          )
        );
        const bounded = Math.max(0, Math.min(targetIndex, target.length));
        target.splice(bounded, 0, { ...source, cardId: targetCardId });

        const rest = prev.items.filter(
          (item) => item.cardId !== targetCardId && item.id !== itemId
        );

        if (source.cardId === targetCardId) {
          return { ...prev, items: [...rest, ...reindex(target)] };
        }

        const origin = reindex(
          sortBy(prev.items.filter((item) => item.cardId === source.cardId && item.id !== itemId))
        );
        const others = rest.filter((item) => item.cardId !== source.cardId);

        return { ...prev, items: [...others, ...origin, ...reindex(target)] };
      });
    },
    [edit]
  );

  const addItem = useCallback(
    (itemId: string, kind: FormLayoutItem["kind"], cardId: string) => {
      edit((prev) => {
        if (prev.items.some((item) => item.id === itemId)) return prev;

        const siblings = prev.items.filter((item) => item.cardId === cardId);
        const width: LayoutWidth =
          kind === "static" ? STATIC_FIELD_MAP[itemId]?.defaultWidth ?? "half" : "half";

        return {
          ...prev,
          items: [
            ...prev.items,
            { id: itemId, kind, cardId, width, sortOrder: siblings.length },
          ],
        };
      });
    },
    [edit]
  );

  const removeItem = useCallback((itemId: string) => {
    edit((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }));
  }, [edit]);

  const setItemWidth = useCallback((itemId: string, width: LayoutWidth) => {
    edit((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId ? { ...item, width } : item
      ),
    }));
  }, [edit]);

  /** Новые карточки всегда в левой колонке — правая живёт вне конструктора. */
  const addCard = useCallback(() => {
    const id = createId("crd");

    edit((prev) => ({
      ...prev,
      cards: [
        ...prev.cards,
        {
          id,
          title: translate("employees.form_layout.new_card_title"),
          description: "",
          column: "left",
          system: false,
          locked: false,
          sortOrder: prev.cards.filter((card) => card.column === "left").length,
        },
      ],
    }));

    return id;
  }, [edit]);

  const updateCard = useCallback(
    (cardId: string, changes: Partial<Omit<FormLayoutCard, "id">>) => {
      edit((prev) => ({
        ...prev,
        cards: prev.cards.map((card) =>
          card.id === cardId ? { ...card, ...changes } : card
        ),
      }));
    },
    [edit]
  );

  /** Карточка удаляется вместе с раскладкой её полей — сами поля не пропадают. */
  const deleteCard = useCallback((cardId: string) => {
    edit((prev) => ({
      cards: prev.cards.filter((card) => card.id !== cardId),
      items: prev.items.filter((item) => item.cardId !== cardId),
    }));
  }, [edit]);

  const reorderCards = useCallback((column: LayoutColumn, orderedIds: string[]) => {
    edit((prev) => ({
      ...prev,
      cards: prev.cards.map((card) => {
        if (card.column !== column) return card;
        const next = orderedIds.indexOf(card.id);
        return next === -1 ? card : { ...card, sortOrder: next };
      }),
    }));
  }, [edit]);

  const resetLayout = useCallback(
    () => edit(() => registry.createDefault()),
    [edit, registry]
  );

  const save = useCallback(async () => {
    if (!dirtyRef.current) return;

    await saveMutation.mutateAsync(layout);
    dirtyRef.current = false;
    setDirty(false);
  }, [layout, saveMutation]);

  return {
    layout: normalized,
    isLoading,
    isSaving: saveMutation.isLoading,
    isDirty: dirty,
    save,
    editableCards,
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
    resetLayout,
  };
};

/** Раскладка формы сотрудника — самый частый вызов, поэтому отдельной обёрткой. */
export const useEmployeeFormLayout = (dynamicFieldIds: string[]) =>
  useFormLayout(EMPLOYEE_FORM_ENTITY, dynamicFieldIds, EMPLOYEE_FORM_REGISTRY);
