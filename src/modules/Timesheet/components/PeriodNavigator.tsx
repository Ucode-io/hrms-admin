import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  PILL_GROUP,
  PILL_ICON_BUTTON,
  PILL_LABEL,
  PILL_BUTTON,
  pillButton,
} from "../../../components/common/toolbarPill";
import {
  SCALE_META,
  SCALE_ORDER,
  formatRangeLabel,
  rangeForScale,
  shiftAnchor,
  toIsoDate,
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
 */
export default function PeriodNavigator({
  scale,
  anchor,
  onScaleChange,
  onAnchorChange,
}: PeriodNavigatorProps) {
  const range = rangeForScale(scale, anchor);
  const today = toIsoDate(new Date());
  const isCurrent = today >= range.from && today <= range.to;

  return (
    <div className="flex flex-wrap items-center gap-2">
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

      {/* «Сегодня» в собственном корпусе: отдельная кнопка другой высоты
          ломала бы линию тулбара. */}
      <div className={PILL_GROUP}>
        <button
          type="button"
          onClick={() => onAnchorChange(today)}
          disabled={isCurrent}
          className={PILL_BUTTON}
        >
          Сегодня
        </button>
      </div>

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
    </div>
  );
}
