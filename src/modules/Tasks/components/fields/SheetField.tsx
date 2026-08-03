import { useMemo, useState } from "react";
import { ChevronDown, Layers } from "lucide-react";
import type { TaskSheet } from "../../sheets";
import Popover from "../ui/Popover";
import OptionPicker, { type PickerOption } from "../ui/OptionPicker";
import { ControlButton, type ControlVariant } from "../ui/controls";

interface SheetFieldProps {
  /** null — задача не привязана к листу. */
  value: string | null;
  sheets: TaskSheet[];
  onChange: (sheetId: string | null) => void;
  variant: ControlVariant;
}

/** Переносит задачу между листами — теми же, что показывает селектор в тулбаре. */
export default function SheetField({ value, sheets, onChange, variant }: SheetFieldProps) {
  const [open, setOpen] = useState(false);

  const options = useMemo<PickerOption[]>(
    () => sheets.map((sheet) => ({ value: sheet.id, label: sheet.name })),
    [sheets]
  );

  const active = sheets.find((sheet) => sheet.id === value) ?? null;

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      width={240}
      content={({ close }) => (
        <OptionPicker
          options={options}
          selected={value}
          onSelect={onChange}
          close={close}
          emptyText="Листов пока нет"
          footer={
            value
              ? ({ close: closePanel }) => (
                  <button
                    type="button"
                    onClick={() => {
                      onChange(null);
                      closePanel();
                    }}
                    className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-gray-500 transition hover:bg-gray-50 dark:hover:bg-white/5"
                  >
                    Убрать из листа
                  </button>
                )
              : undefined
          }
        />
      )}
    >
      {({ ref, props }) => (
        <ControlButton
          ref={ref}
          variant={variant}
          open={open}
          active={Boolean(active)}
          muted={!active}
          {...props}
        >
          <Layers size={14} className="shrink-0 text-gray-400" />
          <span className="min-w-0 flex-1 truncate text-left">
            {active?.name ?? "Без листа"}
          </span>
          <ChevronDown size={14} className="shrink-0 text-gray-400" />
        </ControlButton>
      )}
    </Popover>
  );
}
