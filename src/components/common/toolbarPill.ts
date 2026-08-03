/**
 * Оформление «таблетки» тулбара — стрелки периода, переключатели масштаба,
 * переключатели представления.
 *
 * Эталон — `MonthNavigator` (отчёты, зарплата): один блок с рамкой, внутри
 * кнопки 30px, активная «всплывает» белым. Здесь только классы, а не готовый
 * компонент: наполнение у тулбаров разное (у одного месяцы, у другого
 * день/неделя/месяц, у третьего представления), общий у них ровно внешний вид.
 *
 * Тёмные варианты добавлены сверх MonthNavigator: он прибит к светлой теме,
 * но карточки, на которых живут эти тулбары, тему переключают.
 */

/** Корпус группы. Высота 38px — базовая высота элементов тулбара. */
export const PILL_GROUP =
  "inline-flex h-[38px] items-center rounded-[12px] border border-slate-200 bg-slate-50 p-[3px] dark:border-gray-700 dark:bg-white/5";

/** Кнопка-стрелка внутри корпуса. */
export const PILL_ICON_BUTTON =
  "inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-transparent text-slate-600 transition hover:border-slate-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-white/10";

/** Текстовая кнопка внутри корпуса (неактивная). */
export const PILL_BUTTON =
  "inline-flex h-[30px] items-center gap-1.5 rounded-[8px] border border-transparent px-3 text-[13px] font-semibold text-slate-600 transition hover:border-slate-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-white/10";

/** Та же кнопка в активном состоянии. */
export const PILL_BUTTON_ACTIVE =
  "inline-flex h-[30px] items-center gap-1.5 rounded-[8px] border border-slate-200 bg-white px-3 text-[13px] font-semibold text-brand-500 transition dark:border-gray-600 dark:bg-gray-900 dark:text-brand-400";

/** Подпись периода между стрелками. */
export const PILL_LABEL =
  "min-w-[170px] px-3 text-center text-[13px] font-semibold text-slate-700 dark:text-white/90";

export const pillButton = (isActive: boolean): string =>
  isActive ? PILL_BUTTON_ACTIVE : PILL_BUTTON;
