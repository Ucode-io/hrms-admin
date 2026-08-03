import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import Popover from "../ui/Popover";
import OptionPicker, { type PickerOption } from "../ui/OptionPicker";
import { ClearButton, ControlButton, FieldSlot, type ControlVariant } from "../ui/controls";

/** Локация — существующий справочник HRMS, поэтому только выбор, без создания. */
export interface LocationOption {
  id: string;
  title: string;
}

interface LocationFieldProps {
  value: string | null;
  locations: LocationOption[];
  onChange: (locationId: string | null) => void;
  variant: ControlVariant;
  placeholder?: string;
}

export default function LocationField({
  value,
  locations,
  onChange,
  variant,
  placeholder = "Локация",
}: LocationFieldProps) {
  const [open, setOpen] = useState(false);

  const options = useMemo<PickerOption[]>(
    () => locations.map((location) => ({ value: location.id, label: location.title })),
    [locations]
  );

  const title = locations.find((location) => location.id === value)?.title ?? "";

  return (
    <FieldSlot>
      <Popover
        open={open}
        onOpenChange={setOpen}
        width={260}
        content={({ close }) => (
          <OptionPicker
            options={options}
            selected={value || null}
            onSelect={(next) => onChange(next)}
            searchable
            searchPlaceholder="Найти локацию..."
            emptyText="Локаций нет — заведите их в настройках"
            close={close}
            footer={
              value
                ? ({ close: closePanel }) => (
                    <button
                      type="button"
                      onClick={() => {
                        onChange(null);
                        closePanel();
                      }}
                      className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-gray-500 transition hover:bg-gray-50 hover:text-error-600 dark:hover:bg-white/5"
                    >
                      Очистить локацию
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
            active={Boolean(value)}
            muted={!value}
            hasClear={Boolean(value)}
            {...props}
          >
            <MapPin size={15} className="shrink-0 text-gray-400" />
            <span className="min-w-0 flex-1 truncate text-left">{title || placeholder}</span>
          </ControlButton>
        )}
      </Popover>
      {value && <ClearButton onClick={() => onChange(null)} label="Очистить локацию" />}
    </FieldSlot>
  );
}
