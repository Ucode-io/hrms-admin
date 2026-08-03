import { SOURCE_META, avatarColor, getInitials } from "../constants";
import type { TimesheetSource } from "../types";

export const SourceBadge = ({ source }: { source: TimesheetSource }) => {
  const meta = SOURCE_META[source] ?? SOURCE_META.other;
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}
      title={meta.label}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
      {meta.short}
    </span>
  );
};

/**
 * Аватар сотрудника: фото из user_base, иначе инициалы на детерминированном
 * цвете. Битая ссылка на фото не должна ломать строку — при ошибке загрузки
 * картинка прячется и остаются инициалы под ней.
 */
export const EmployeeAvatar = ({
  name,
  photo,
  seed,
  size = 28,
  title,
}: {
  name: string;
  photo?: string;
  seed: string;
  size?: number;
  title?: string;
}) => (
  <span
    className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white"
    style={{
      width: size,
      height: size,
      fontSize: size * 0.36,
      backgroundColor: avatarColor(seed || name),
    }}
    title={title ?? name}
  >
    {getInitials(name)}
    {photo ? (
      <img
        src={photo}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
    ) : null}
  </span>
);

/** Легенда таймлайна — она же расшифровка цветов сегментов полосы. */
export const SourceLegend = ({ sources }: { sources: TimesheetSource[] }) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
    {sources.map((source) => {
      const meta = SOURCE_META[source];
      return (
        <span
          key={source}
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"
        >
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: meta.bar }} />
          {meta.short}
        </span>
      );
    })}
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
      <span className="h-2.5 w-2.5 rounded-sm bg-gray-200 dark:bg-white/15" />
      Не отработано
    </span>
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
      <span className="h-3.5 w-[3px] rounded-full bg-slate-800 dark:bg-white" />
      План
    </span>
  </div>
);
