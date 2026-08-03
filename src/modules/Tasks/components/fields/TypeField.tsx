import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { findDirectoryItem } from "../../constants";
import type { TaskDirectoryItem } from "../../types";
import Popover from "../ui/Popover";
import OptionPicker, { type PickerOption } from "../ui/OptionPicker";
import { ControlButton, type ControlVariant } from "../ui/controls";
import { TypeIcon } from "../badges";

interface TypeFieldProps {
  value: string | null;
  types: TaskDirectoryItem[];
  onChange: (typeId: string) => void;
  variant: ControlVariant;
}

export default function TypeField({ value, types, onChange, variant }: TypeFieldProps) {
  const [open, setOpen] = useState(false);
  const current = findDirectoryItem(types, value);

  const options: PickerOption[] = types.map((type) => ({
    value: type.id,
    label: type.title,
    icon: <TypeIcon type={type} />,
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
          <TypeIcon type={current} />
          <span className="min-w-0 flex-1 truncate text-left">{current.title}</span>
          <ChevronDown size={14} className="shrink-0 text-gray-400" />
        </ControlButton>
      )}
    </Popover>
  );
}
