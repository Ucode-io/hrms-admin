import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  PILL_GROUP,
  PILL_ICON_BUTTON,
  PILL_LABEL,
  pillButton,
} from "../../../components/common/toolbarPill";
import {
  SCALE_META,
  SCALE_ORDER,
  formatRangeLabel,
  rangeForScale,
  shiftAnchor,
} from "../constants";
import type { TimelineScale } from "../types";

interface PeriodNavigatorProps {
  scale: TimelineScale;
  anchor: string;
  onScaleChange: (scale: TimelineScale) => void;
  onAnchorChange: (anchor: string) => void;
}

/**
 * Навигация по периоду — общая для таблицы и таймлайна.
 *
 * Период задаётся якорной датой плюс масштабом, а не парой «от/до»: так кнопки
 * «назад/вперёд» всегда шагают ровно на период, и переключение день↔месяц не
 * теряет то, что человек уже отлистал.
 *
 * Оформление — общие классы `toolbarPill` (эталон — MonthNavigator в отчётах и
 * зарплате). Сам MonthNavigator переиспользовать нельзя: он умеет только
 * месяцы, а здесь ещё день и неделя.
 *
 * Разбит на две части: в шапке карточки масштаб стоит слева, а даты — справа,
 * как строка периодов в KPI. Целиком компонент остаётся для случаев, где обе
 * части идут подряд.
 */

/** Масштаб периода: день / неделя / месяц. */
export function PeriodScaleTabs({
  scale,
  onScaleChange,
}: Pick<PeriodNavigatorProps, "scale" | "onScaleChange">) {
  return (
    <div className={PILL_GROUP}>
      {SCALE_ORDER.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onScaleChange(item)}
          className={pillButton(item === scale)}
        >
          {SCALE_META[item].label}
        </button>
      ))}
    </div>
  );
}

/** Стрелки и подпись периода. */
export function PeriodRangeNavigator({
  scale,
  anchor,
  onAnchorChange,
}: Pick<PeriodNavigatorProps, "scale" | "anchor" | "onAnchorChange">) {
  const range = rangeForScale(scale, anchor);

  return (
    <div className={PILL_GROUP}>
      <button
        type="button"
        onClick={() => onAnchorChange(shiftAnchor(scale, anchor, -1))}
        className={PILL_ICON_BUTTON}
        aria-label="Предыдущий период"
      >
        <ChevronLeft size={16} />
      </button>
      <span className={PILL_LABEL}>{formatRangeLabel(scale, range)}</span>
      <button
        type="button"
        onClick={() => onAnchorChange(shiftAnchor(scale, anchor, 1))}
        className={PILL_ICON_BUTTON}
        aria-label="Следующий период"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

export default function PeriodNavigator({
  scale,
  anchor,
  onScaleChange,
  onAnchorChange,
}: PeriodNavigatorProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <PeriodScaleTabs scale={scale} onScaleChange={onScaleChange} />
      <PeriodRangeNavigator scale={scale} anchor={anchor} onAnchorChange={onAnchorChange} />
    </div>
  );
}
