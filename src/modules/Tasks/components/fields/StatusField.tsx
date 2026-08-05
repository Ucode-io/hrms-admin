import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { chipStyle, findDirectoryItem } from "../../constants";
import { STATUS_GROUP_META } from "../../statusGroups";
import type { TaskDirectoryItem } from "../../types";
import Popover from "../ui/Popover";
import OptionPicker, { type PickerOption } from "../ui/OptionPicker";
import { ControlButton, type ControlVariant } from "../ui/controls";
import { StatusDot } from "../badges";

interface StatusFieldProps {
  value: string | null;
  /** Статусы компании — приходят из справочника, а не из кода. */
  statuses: TaskDirectoryItem[];
  onChange: (statusId: string) => void;
  /** `lozenge` — крупная цветная кнопка статуса в детальной карточке. */
  variant: ControlVariant | "lozenge";
}

export default function StatusField({ value, statuses, onChange, variant }: StatusFieldProps) {
  const [open, setOpen] = useState(false);
  const current = findDirectoryItem(statuses, value);

  // Статусы приходят уже отсортированными по группе (сервис справочников), так
  // что заголовки секций расставляются по смене группы — переупорядочивать
  // здесь нечего.
  const options: PickerOption[] = statuses.map((status) => ({
    value: status.id,
    label: status.title,
    icon: <StatusDot status={status} />,
    group: { key: status.group, label: STATUS_GROUP_META[status.group].label },
  }));

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      width={220}
      content={({ close }) => (
        <OptionPicker
          options={options}
          selected={value ?? ""}
          onSelect={(next) => onChange(next)}
          close={close}
        />
      )}
    >
      {({ ref, props }) =>
        variant === "lozenge" ? (
          <button
            ref={ref}
            type="button"
            {...props}
            className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition hover:brightness-95 focus:outline-hidden focus:ring-3 focus:ring-brand-500/15"
            style={chipStyle(current.color)}
          >
            <StatusDot status={current} />
            {current.title}
            <ChevronDown size={14} className="opacity-60" />
          </button>
        ) : (
          <ControlButton ref={ref} variant={variant} open={open} active {...props}>
            <StatusDot status={current} />
            <span className="min-w-0 flex-1 truncate text-left">{current.title}</span>
            <ChevronDown size={14} className="shrink-0 text-gray-400" />
          </ControlButton>
        )
      }
    </Popover>
  );
}
