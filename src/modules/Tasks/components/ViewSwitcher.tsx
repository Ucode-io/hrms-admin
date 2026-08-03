import { CalendarDays, ChartGantt, LayoutGrid, Table2 } from "lucide-react";
import { PILL_GROUP, pillButton } from "../../../components/common/toolbarPill";
import { VIEW_META, VIEW_ORDER } from "../constants";
import type { TasksViewKey } from "../types";

const VIEW_ICONS: Record<TasksViewKey, React.ReactNode> = {
  board: <LayoutGrid size={16} />,
  table: <Table2 size={16} />,
  timeline: <ChartGantt size={16} />,
  calendar: <CalendarDays size={16} />,
};

interface ViewSwitcherProps {
  value: TasksViewKey;
  onChange: (view: TasksViewKey) => void;
}

export default function ViewSwitcher({ value, onChange }: ViewSwitcherProps) {
  return (
    <div className={PILL_GROUP}>
      {VIEW_ORDER.map((view) => (
        <button
          key={view}
          type="button"
          onClick={() => onChange(view)}
          className={pillButton(view === value)}
        >
          {VIEW_ICONS[view]}
          {VIEW_META[view].label}
        </button>
      ))}
    </div>
  );
}
