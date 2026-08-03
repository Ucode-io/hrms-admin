import { GanttChartSquare, Table2 } from "lucide-react";
import { PILL_GROUP, pillButton } from "../../../components/common/toolbarPill";
import { VIEW_META, VIEW_ORDER } from "../constants";
import type { TimesheetView } from "../types";

const VIEW_ICONS: Record<TimesheetView, React.ReactNode> = {
  table: <Table2 size={16} />,
  timeline: <GanttChartSquare size={16} />,
};

interface ViewSwitcherProps {
  value: TimesheetView;
  onChange: (view: TimesheetView) => void;
}

/** Тот же корпус, что у навигатора периода: тулбар должен читаться одной
 *  строкой одинаковой высоты. */
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
