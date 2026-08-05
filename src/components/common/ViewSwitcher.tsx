// Переключатель представлений тулбара — один на все страницы.
//
// До этого каждая страница рисовала его сама инлайновыми стилями, и они
// разъехались: у задач и табеля был корпус из `toolbarPill` (12px, высота 38),
// у KPI — `rounded-2xl` с другой рамкой активной кнопки, у сотрудников — третий
// набор значений. Теперь оформление берётся из общих классов, а страницы
// задают только состав пунктов.

import type { ReactNode } from "react";
import { PILL_GROUP, pillButton } from "./toolbarPill";

export type ViewSwitcherItem<T extends string> = {
  key: T;
  label: string;
  icon?: ReactNode;
};

interface ViewSwitcherProps<T extends string> {
  value: T;
  items: ViewSwitcherItem<T>[];
  onChange: (view: T) => void;
  /** Проброс id на кнопки — их используют тесты и подсказки онбординга. */
  buttonId?: (view: T) => string | undefined;
}

export default function ViewSwitcher<T extends string>({
  value,
  items,
  onChange,
  buttonId,
}: ViewSwitcherProps<T>) {
  return (
    <div className={PILL_GROUP}>
      {items.map((item) => (
        <button
          key={item.key}
          id={buttonId?.(item.key)}
          type="button"
          onClick={() => onChange(item.key)}
          className={pillButton(item.key === value)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
