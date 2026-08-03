/** Ширина элемента внутри карточки (в колонках её сетки). */
export type LayoutWidth = "half" | "full";

/** Колонка страницы: слева основной поток, справа узкая колонка 400px. */
export type LayoutColumn = "left" | "right";

export type FormLayoutCard = {
  id: string;
  title: string;
  description: string;
  column: LayoutColumn;
  /** Системная карточка формы: удалить нельзя (поля из неё выносить можно). */
  system: boolean;
  /** Карточка не настраивается: в конструкторе её нет, поля перекладывать нельзя. */
  locked: boolean;
  sortOrder: number;
};

export type FormLayoutItem = {
  /** Для статичных полей — ключ из реестра, для динамических — id поля схемы. */
  id: string;
  kind: "static" | "dynamic";
  cardId: string;
  width: LayoutWidth;
  sortOrder: number;
};

export type EmployeeFormLayout = {
  cards: FormLayoutCard[];
  items: FormLayoutItem[];
};
