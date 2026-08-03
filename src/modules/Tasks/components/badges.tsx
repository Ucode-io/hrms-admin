import {
  Bug,
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  CircleDot,
  Equal,
  FlaskConical,
  MapPin,
  SquareCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { chipStyle, dotStyle, getInitials } from "../constants";
import type { TaskDirectoryItem, TaskEmployee } from "../types";

/**
 * Иконки типов и приоритетов задаются в справочнике ключом (`icon`), а не
 * захардкожены: набор типов правят в настройках. Незнакомый ключ рисуем
 * нейтральной точкой, чтобы карточка не падала.
 */
const ICONS: Record<string, LucideIcon> = {
  "square-check": SquareCheck,
  bug: Bug,
  sparkles: Sparkles,
  users: Users,
  "flask-conical": FlaskConical,
  "chevron-down": ChevronDown,
  equal: Equal,
  "chevron-up": ChevronUp,
  "chevrons-up": ChevronsUp,
};

const DirectoryIcon = ({
  item,
  size,
  strokeWidth,
}: {
  item: TaskDirectoryItem;
  size: number;
  strokeWidth?: number;
}) => {
  const Icon = ICONS[item.icon] ?? CircleDot;
  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      className="shrink-0"
      style={{ color: item.color || "#94a3b8" }}
    />
  );
};

export const TypeIcon = ({ type, size = 15 }: { type: TaskDirectoryItem; size?: number }) => (
  <DirectoryIcon item={type} size={size} />
);

export const TypeBadge = ({ type }: { type: TaskDirectoryItem }) => (
  <span
    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
    style={chipStyle(type.color)}
  >
    <TypeIcon type={type} size={13} />
    {type.title}
  </span>
);

/** Плашка локации — ничего, если место не указано. */
export const LocationBadge = ({ location }: { location: string }) => {
  if (!location) return null;
  return (
    <span
      className="inline-flex max-w-full items-center gap-1 text-theme-xs text-gray-500 dark:text-gray-400"
      title={location}
    >
      <MapPin size={12} className="shrink-0 text-gray-400" />
      <span className="truncate">{location}</span>
    </span>
  );
};

/** Отдельная стрелка приоритета — там, где плашка была бы слишком громкой. */
export const PriorityIcon = ({
  priority,
  size = 15,
}: {
  priority: TaskDirectoryItem;
  size?: number;
}) => <DirectoryIcon item={priority} size={size} strokeWidth={2.5} />;

export const StatusDot = ({ status }: { status: TaskDirectoryItem }) => (
  <span className="h-2 w-2 shrink-0 rounded-full" style={dotStyle(status.color)} />
);

export const StatusBadge = ({ status }: { status: TaskDirectoryItem }) => (
  <span
    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
    style={chipStyle(status.color)}
  >
    <span className="h-1.5 w-1.5 rounded-full" style={dotStyle(status.color)} />
    {status.title}
  </span>
);

export const PriorityBadge = ({ priority }: { priority: TaskDirectoryItem }) => (
  <span
    className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
    style={chipStyle(priority.color)}
  >
    {priority.title}
  </span>
);

/** Плашка тега — цвет задаётся в справочнике тегов. */
export const TagBadge = ({ tag }: { tag: TaskDirectoryItem }) => (
  <span
    className="inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-theme-xs font-medium"
    style={chipStyle(tag.color)}
    title={tag.title}
  >
    {tag.title}
  </span>
);

/** Overlapping avatars for a shared task; overflow collapses into "+N". */
export const AvatarStack = ({
  employees,
  size = 24,
  max = 3,
}: {
  employees: TaskEmployee[];
  size?: number;
  max?: number;
}) => {
  if (employees.length === 0) return <EmployeeAvatar employee={null} size={size} />;

  const shown = employees.slice(0, max);
  const rest = employees.length - shown.length;

  return (
    <span className="flex shrink-0 items-center">
      {shown.map((employee, index) => (
        <span
          key={employee.id}
          className="rounded-full ring-2 ring-white dark:ring-gray-900"
          style={{ marginLeft: index === 0 ? 0 : -size * 0.3, zIndex: shown.length - index }}
        >
          <EmployeeAvatar employee={employee} size={size} />
        </span>
      ))}
      {rest > 0 && (
        <span
          className="inline-flex items-center justify-center rounded-full bg-gray-200 font-semibold text-gray-600 ring-2 ring-white dark:bg-white/15 dark:text-gray-200 dark:ring-gray-900"
          style={{ width: size, height: size, fontSize: size * 0.36, marginLeft: -size * 0.3 }}
          title={employees
            .slice(max)
            .map((employee) => employee.name)
            .join(", ")}
        >
          +{rest}
        </span>
      )}
    </span>
  );
};

export const EmployeeAvatar = ({
  employee,
  size = 24,
}: {
  employee: TaskEmployee | null | undefined;
  size?: number;
}) => {
  if (!employee) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400 dark:border-gray-600"
        style={{ width: size, height: size, fontSize: size * 0.42 }}
        title="Без исполнителя"
      >
        —
      </span>
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38, backgroundColor: employee.color }}
      title={`${employee.name} · ${employee.position}`}
    >
      {getInitials(employee.name)}
    </span>
  );
};
