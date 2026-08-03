import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { findDirectoryItem } from "../../constants";
import type { TaskDirectoryItem } from "../../types";
import Popover from "../ui/Popover";
import OptionPicker, { type PickerOption } from "../ui/OptionPicker";
import { ControlButton, type ControlVariant } from "../ui/controls";
import { PriorityIcon } from "../badges";

interface PriorityFieldProps {
  value: string | null;
  priorities: TaskDirectoryItem[];
  onChange: (priorityId: string) => void;
  variant: ControlVariant;
}

export default function PriorityField({
  value,
  priorities,
  onChange,
  variant,
}: PriorityFieldProps) {
  const [open, setOpen] = useState(false);
  const current = findDirectoryItem(priorities, value);

  const options: PickerOption[] = priorities.map((priority) => ({
    value: priority.id,
    label: priority.title,
    icon: <PriorityIcon priority={priority} />,
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
          onSelect={onChange}
          close={close}
        />
      )}
    >
      {({ ref, props }) => (
        <ControlButton ref={ref} variant={variant} open={open} active {...props}>
          <PriorityIcon priority={current} />
          <span className="min-w-0 flex-1 truncate text-left">{current.title}</span>
          <ChevronDown size={14} className="shrink-0 text-gray-400" />
        </ControlButton>
      )}
    </Popover>
  );
}
