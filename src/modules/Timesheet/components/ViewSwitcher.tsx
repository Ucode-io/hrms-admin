import { GanttChartSquare, Table2 } from "lucide-react";
import SharedViewSwitcher from "../../../components/common/ViewSwitcher";
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

export default function ViewSwitcher({ value, onChange }: ViewSwitcherProps) {
  return (
    <SharedViewSwitcher
      value={value}
      onChange={onChange}
      items={VIEW_ORDER.map((view) => ({
        key: view,
        label: VIEW_META[view].label,
        icon: VIEW_ICONS[view],
      }))}
    />
  );
}
