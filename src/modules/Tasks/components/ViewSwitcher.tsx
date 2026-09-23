import { CalendarDays, ChartGantt, LayoutGrid, Table2 } from "lucide-react";
import SharedViewSwitcher from "../../../components/common/ViewSwitcher";
import { VIEW_META, VIEW_ORDER } from "../constants";
import type { TasksViewKey } from "../types";
import { useTranslation } from "../../../i18n";

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
  const { t } = useTranslation();
  return (
    <SharedViewSwitcher
      value={value}
      onChange={onChange}
      items={VIEW_ORDER.map((view) => ({
        key: view,
        label: t(VIEW_META[view].labelKey),
        icon: VIEW_ICONS[view],
      }))}
    />
  );
}
