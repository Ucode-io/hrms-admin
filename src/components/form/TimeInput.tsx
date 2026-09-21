// Поле времени — всегда 24 часа.
//
// Вместо `<input type="time">`. Нативное поле рисует браузер, и формат он
// выбирает по локали, а не по разметке: при системной en-US то же поле
// показывает «09:00 AM» и пикер с колонкой AM/PM. Атрибут `lang` спасает
// только Blink (`Element::GetLocale`), Safari и Firefox читают системные
// настройки и на разметку не смотрят — то есть у части людей формат смены
// зависел от настроек их ноутбука.
//
// Своего пикера сначала не писали — брали flatpickr, он в проекте уже есть.
// Не подошёл: со `static: true` его список позиционируется от обёртки, а в
// прокручиваемом теле модалки уезжал на соседнее поле, и правка этого свелась
// бы к переопределению его CSS поверх нашего. Здесь разметка своя и целиком
// на Tailwind, как остальные поля формы.
//
// Список раскрывается в `position: fixed` по рамке поля: любой родитель с
// `overflow` (тело модалки, скролл таблицы) иначе обрезал бы его, а всплытие
// над модалкой с `z-index: 99999` требовало бы числа ещё больше.
//
// Контракт совпадает с нативным полем: `value`/`onChange` — строка `HH:MM`,
// пустая строка значит «не задано». Поэтому замена по местам вызова была
// построчной.

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Иконка встроена, а не взята из `../../icons`: тот бочонок тянет за собой
// все svg проекта через `?react`, и вместе с ними — vite-плагин, из-за
// которого разбор времени не прогнать `selfCheck`-ом вне браузера.
const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
    <path
      d="M12 7.5V12l3 1.8"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Что человек набрал → `HH:MM`, или пусто, если это не время.
 *
 * Набирают без двоеточия («930»), одними часами («9») и с двоеточием —
 * принимаем всё три, потому что отказ показывать набранное ощущается как
 * сломанное поле. Мусор возвращает пустую строку, и поле откатывается к
 * прежнему значению, а не записывает «25:70».
 */
export const normalizeTimeInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, "");
  if (!digits || digits.length > 4) return "";

  const [hours, minutes] =
    digits.length <= 2
      ? [Number(digits), 0]
      : [Number(digits.slice(0, digits.length - 2)), Number(digits.slice(-2))];

  if (!Number.isFinite(hours) || hours > 23 || minutes > 59) return "";
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

/** Шаг списка. Смены назначают на полчаса; остальное набирают руками. */
const STEP_MINUTES = 30;

const OPTIONS = Array.from({ length: (24 * 60) / STEP_MINUTES }, (_, index) => {
  const total = index * STEP_MINUTES;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
});

type TimeInputProps = {
  /** `HH:MM`; пусто — время не задано. */
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
};

export default function TimeInput({
  value,
  onChange,
  disabled = false,
  className,
  placeholder = "ЧЧ:ММ",
}: TimeInputProps) {
  const [text, setText] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null);

  const fieldRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Значение приходит и снаружи: сброс формы при открытии, подстановка из
  // загруженной серии. Набранное наполовину при этом не трогаем.
  useEffect(() => {
    setText(value);
  }, [value]);

  /**
   * Куда лечь списку.
   *
   * Считаем перед отрисовкой, иначе список успевает мигнуть в левом верхнем
   * углу. Вниз, а у нижнего края экрана — вверх: список в 192px у поля в
   * последней трети окна иначе уезжает за край.
   */
  useLayoutEffect(() => {
    if (!isOpen || !fieldRef.current) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const height = 192;
    const below = window.innerHeight - rect.bottom;
    setBox({
      top: below < height + 8 ? rect.top - height - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, [isOpen]);

  // Прокрутка и ресайз уводят поле из-под списка. Пересчитывать позицию на
  // каждый кадр незачем — закрываем: список открывают, чтобы сразу выбрать.
  //
  // Слушать приходится в фазе перехвата: `scroll` не всплывает, и прокрутку
  // тела модалки на самом окне иначе не поймать. Отсюда же и проверка цели —
  // без неё список закрывался бы от собственной прокрутки, в том числе от той,
  // которой он сам подводит текущее значение под курсор.
  useEffect(() => {
    if (!isOpen) return;
    const close = (event: Event) => {
      if (event.target instanceof Node && listRef.current?.contains(event.target)) return;
      setIsOpen(false);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [isOpen]);

  // Клик мимо поля и списка закрывает. Слушаем `mousedown`, а не `click`:
  // иначе выбор в списке успевает отмениться раньше, чем сработает.
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (fieldRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isOpen]);

  // Текущее значение — в видимую часть списка, иначе 48 пунктов открываются
  // с полуночи и до «18:00» надо крутить.
  //
  // Через `scrollTop`, а не `scrollIntoView`: последний тянет за собой и
  // родителей, то есть прокручивает тело модалки под открытым списком.
  useEffect(() => {
    const list = listRef.current;
    if (!isOpen || !list) return;
    const current = list.querySelector<HTMLElement>("[data-selected='true']");
    if (current) {
      list.scrollTop = current.offsetTop - list.clientHeight / 2 + current.clientHeight / 2;
    }
  }, [isOpen]);

  /** Уход из поля фиксирует набранное — или откатывает, если это не время. */
  const commit = () => {
    const next = normalizeTimeInput(text);
    if (!next) {
      setText(value);
      return;
    }
    setText(next);
    if (next !== value) onChange(next);
  };

  const pick = (option: string) => {
    setText(option);
    setIsOpen(false);
    if (option !== value) onChange(option);
  };

  return (
    <div ref={fieldRef} className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={text}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => setText(event.target.value)}
        onFocus={() => setIsOpen(true)}
        // Выбрали пункт — фокус остался в поле, и повторный `focus` уже не
        // придёт. Без этого список больше не открыть, не уйдя из поля.
        onClick={() => setIsOpen(true)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
            setIsOpen(false);
          }
          if (event.key === "Escape") setIsOpen(false);
        }}
        className={className}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
        <ClockIcon />
      </span>

      {isOpen && box && (
        <div
          ref={listRef}
          style={{ top: box.top, left: box.left, width: box.width }}
          // Над модалкой (`z-index: 99999`) и над порталом мультиселекта.
          className="fixed z-[100001] max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          {OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              data-selected={option === value}
              // Без этого поле теряет фокус раньше клика, срабатывает `blur`,
              // и выбор в списке отменяется откатом набранного.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(option)}
              className={`block w-full px-3 py-1.5 text-left text-[13px] transition ${
                option === value
                  ? "bg-brand-50 font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
                  : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
