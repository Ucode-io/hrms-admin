// Поле даты — всегда ДД.ММ.ГГГГ, значение всегда ISO.
//
// Пара к `TimeInput` и по тем же причинам. Нативный `<input type="date">`
// рисует браузер, и порядок частей он берёт из локали системы: у одного и
// того же поля в en-US это «09/21/2026», в ru-RU — «21.09.2026». Кнопка
// календаря — тоже браузерная: в Firefox её вид и раскладка другие, в
// Safari до 14 пикера нет вовсе и поле вырождается в текстовое.
//
// Отсюда же и отказ от flatpickr (`date-picker.tsx`, он в проекте есть):
// со `static: true` его календарь позиционируется от обёртки и в
// прокручиваемом теле модалки уезжает на соседнее поле, а без `static`
// всплывает под модалкой. Разметка здесь своя и целиком на Tailwind, как
// остальные поля формы.
//
// Календарь раскрывается в `position: fixed` по рамке поля: любой родитель
// с `overflow` иначе обрезал бы его. Ширина — своя, не по полю: сетка из
// семи колонок в поле шириной 120px нечитаема.
//
// Контракт совпадает с нативным полем: `value`/`onChange` — строка
// `YYYY-MM-DD`, пустая строка значит «не задано», `min`/`max` — такие же
// строки. Поэтому замена по местам вызова была построчной.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation, monthNames, weekdayNames } from "../../i18n";

// Иконка встроена по той же причине, что в `TimeInput`: бочонок
// `../../icons` тянет все svg проекта через `?react` вместе с vite-плагином,
// и разбор даты тогда не прогнать `selfCheck`-ом вне браузера.
const CalendarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
    <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);


/** Семь колонок по 36px плюс поля. Меньше — числа переносятся. */
const POPUP_WIDTH = 276;

/**
 * `YYYY-MM-DD` → показ `ДД.ММ.ГГГГ`. Не дата — пустая строка, поле тогда
 * покажет плейсхолдер, а не половину ISO.
 */
export const formatDateValue = (iso: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return "";
  const [, year, month, day] = match;
  return `${day}.${month}.${year}`;
};

/**
 * Что человек набрал → `YYYY-MM-DD`, или пусто, если это не дата.
 *
 * Набирают с точками, слэшем и вовсе без разделителей («21092026»), а год
 * иногда двумя цифрами — принимаем всё, потому что отказ показывать
 * набранное ощущается как сломанное поле. Мусор и несуществующие числа
 * («31.02») возвращают пустую строку, и поле откатывается к прежнему
 * значению, а не записывает дату, которой нет.
 */
export const normalizeDateInput = (raw: string): string => {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 6 && digits.length !== 8) return "";

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const yearDigits = digits.slice(4);
  // Двузначный год — это текущий век: даты рождения так не набирают, а
  // сроки гарантии и действия сертификатов — только вперёд.
  const year = yearDigits.length === 2 ? 2000 + Number(yearDigits) : Number(yearDigits);

  if (month < 1 || month > 12 || day < 1) return "";
  // Через сам `Date`, а не таблицей длин месяцев: високосный год иначе
  // пришлось бы считать здесь же и ошибиться в 2100-м.
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return "";
  }
  return toIso(date);
};

/**
 * Дата → `YYYY-MM-DD` по местному времени.
 *
 * Не `toISOString()`: тот переводит в UTC, и в Ташкенте (UTC+5) любая дата
 * до 05:00 съезжала бы на день назад.
 */
const toIso = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** Понедельник недели, в которой лежит первое число месяца. */
const gridStart = (year: number, month: number): Date => {
  const first = new Date(year, month, 1);
  const shift = (first.getDay() + 6) % 7;
  return new Date(year, month, 1 - shift);
};

type DateInputProps = {
  /** `YYYY-MM-DD`; пусто — дата не задана. */
  value: string;
  onChange: (next: string) => void;
  /** Границы выбора, такие же строки. Вне них дни в календаре неактивны. */
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  id?: string;
};

export default function DateInput({
  value,
  onChange,
  min,
  max,
  disabled = false,
  className,
  placeholder,
  id,
}: DateInputProps) {
  const { t, locale } = useTranslation();
  placeholder ??= t("common.date_placeholder");
  const [text, setText] = useState(() => formatDateValue(value));
  const [isOpen, setIsOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);
  // Какой месяц показан. Отдельно от значения: календарь листают, не выбирая.
  const [view, setView] = useState(() => value.slice(0, 7) || toIso(new Date()).slice(0, 7));

  const fieldRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Значение приходит и снаружи: сброс формы при открытии, подстановка из
  // загруженной записи. Набранное наполовину при этом не трогаем.
  useEffect(() => {
    setText(formatDateValue(value));
  }, [value]);

  /**
   * Куда лечь календарю.
   *
   * Считаем перед отрисовкой, иначе он успевает мигнуть в левом верхнем
   * углу. Вниз, а у нижнего края экрана — вверх; вправо прижимаем к краю
   * окна: поле в последней колонке формы иначе уводит календарь за экран.
   */
  useLayoutEffect(() => {
    if (!isOpen || !fieldRef.current) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const height = 320;
    const below = window.innerHeight - rect.bottom;
    setBox({
      top: below < height + 8 ? Math.max(8, rect.top - height - 4) : rect.bottom + 4,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - POPUP_WIDTH - 8)),
    });
  }, [isOpen]);

  // Прокрутка и ресайз уводят поле из-под календаря. Пересчитывать позицию
  // на каждый кадр незачем — закрываем: календарь открывают, чтобы сразу
  // выбрать. Слушаем в фазе перехвата: `scroll` не всплывает, и прокрутку
  // тела модалки на самом окне иначе не поймать.
  useEffect(() => {
    if (!isOpen) return;
    const close = (event: Event) => {
      if (event.target instanceof Node && popupRef.current?.contains(event.target)) return;
      setIsOpen(false);
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [isOpen]);

  // Клик мимо поля и календаря закрывает. `mousedown`, а не `click`: иначе
  // выбор дня успевает отмениться раньше, чем сработает.
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (fieldRef.current?.contains(target) || popupRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [isOpen]);

  const open = () => {
    if (disabled) return;
    // Открываем на выбранном месяце, а не на том, где бросили листать.
    setView(value.slice(0, 7) || toIso(new Date()).slice(0, 7));
    setIsOpen(true);
  };

  /** Уход из поля фиксирует набранное — или откатывает, если это не дата. */
  const commit = () => {
    if (!text.trim()) {
      setText("");
      if (value) onChange("");
      return;
    }
    const next = normalizeDateInput(text);
    if (!next) {
      setText(formatDateValue(value));
      return;
    }
    setText(formatDateValue(next));
    if (next !== value) onChange(next);
  };

  const pick = (iso: string) => {
    setText(formatDateValue(iso));
    setIsOpen(false);
    if (iso !== value) onChange(iso);
  };

  const [viewYear, viewMonth] = view.split("-").map(Number);
  const shiftMonth = (delta: number) =>
    setView(toIso(new Date(viewYear, viewMonth - 1 + delta, 1)).slice(0, 7));

  const today = toIso(new Date());
  const start = gridStart(viewYear, viewMonth - 1);
  // Шесть недель всегда: сетка на 5 или 6 строк по месяцу прыгала бы в высоте
  // при листании, и кнопка «Сегодня» уезжала бы из-под курсора.
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const iso = toIso(date);
    return {
      iso,
      day: date.getDate(),
      isOutside: date.getMonth() !== viewMonth - 1,
      isDisabled: (min && iso < min) || (max && iso > max) || false,
    };
  });

  return (
    <div ref={fieldRef} className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={text}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => setText(event.target.value)}
        onFocus={open}
        // Выбрали день — фокус остался в поле, и повторный `focus` уже не
        // придёт. Без этого календарь больше не открыть, не уйдя из поля.
        onClick={open}
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
        <CalendarIcon />
      </span>

      {isOpen && box && (
        <div
          ref={popupRef}
          style={{ top: box.top, left: box.left, width: POPUP_WIDTH }}
          // Над модалкой (`z-index: 99999`) и над порталом мультиселекта —
          // тот же уровень, что у списка времени.
          className="fixed z-[100001] rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => shiftMonth(-1)}
              className="rounded-lg px-2 py-1 text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
              aria-label={t("common.prev_month")}
            >
              ‹
            </button>
            <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">
              {monthNames(locale)[viewMonth - 1]} {viewYear}
            </span>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => shiftMonth(1)}
              className="rounded-lg px-2 py-1 text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
              aria-label={t("common.next_month")}
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {/* Неделя с понедельника: рабочий календарь, выходные в конце. */}
            {weekdayNames(locale).map((weekday, index) => (
              <span
                key={index}
                className="py-1 text-center text-[11px] font-medium text-gray-400 dark:text-gray-500"
              >
                {weekday}
              </span>
            ))}
            {days.map(({ iso, day, isOutside, isDisabled }) => (
              <button
                key={iso}
                type="button"
                disabled={isDisabled}
                // Без этого поле теряет фокус раньше клика, срабатывает
                // `blur`, и выбор дня отменяется откатом набранного.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(iso)}
                className={`h-8 rounded-lg text-[13px] transition ${
                  iso === value
                    ? "bg-brand-500 font-semibold text-white"
                    : isDisabled
                      ? "cursor-not-allowed text-gray-300 dark:text-gray-700"
                      : iso === today
                        ? "font-semibold text-brand-600 hover:bg-gray-100 dark:text-brand-400 dark:hover:bg-white/5"
                        : isOutside
                          ? "text-gray-300 hover:bg-gray-50 dark:text-gray-600 dark:hover:bg-white/5"
                          : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                }`}
              >
                {day}
              </button>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 dark:border-gray-800">
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(today)}
              className="rounded-lg px-2 py-1 text-[12px] font-medium text-brand-600 transition hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
            >
              {t("common.today")}
            </button>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setText("");
                setIsOpen(false);
                if (value) onChange("");
              }}
              className="rounded-lg px-2 py-1 text-[12px] text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5"
            >
              {t("common.clear")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
