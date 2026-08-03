import { useMemo, useState } from "react";
import { GitBranch } from "lucide-react";
import { descendantIds, findDirectoryItem } from "../../constants";
import type { Task, TaskDirectoryItem } from "../../types";
import Popover from "../ui/Popover";
import OptionPicker, { type PickerOption } from "../ui/OptionPicker";
import { ClearButton, ControlButton, FieldSlot, type ControlVariant } from "../ui/controls";
import { TypeIcon } from "../badges";

interface ParentFieldProps {
  value: string | null;
  /** Every task in the board — the picker filters out the invalid ones itself. */
  tasks: Task[];
  /** Task being edited; null while creating (nothing to exclude yet). */
  taskId: string | null;
  /** Типы задач — из них берётся иконка в списке выбора. */
  types: TaskDirectoryItem[];
  onChange: (parentId: string | null) => void;
  variant: ControlVariant;
  placeholder?: string;
}

export default function ParentField({
  value,
  types,
  tasks,
  taskId,
  onChange,
  variant,
  placeholder = "Родительская задача",
}: ParentFieldProps) {
  const [open, setOpen] = useState(false);

  // Self and everything below it are out: either would create a cycle.
  const options = useMemo<PickerOption[]>(() => {
    const excluded = taskId ? descendantIds(tasks, taskId) : new Set<string>();
    return tasks
      .filter((task) => !excluded.has(task.id))
      .map((task) => ({
        value: task.id,
        label: task.title,
        hint: task.code,
        icon: <TypeIcon type={findDirectoryItem(types, task.typeId)} size={14} />,
      }));
  }, [tasks, taskId, types]);

  const parent = value ? tasks.find((task) => task.id === value) ?? null : null;

  return (
    <FieldSlot>
      <Popover
        open={open}
        onOpenChange={setOpen}
        width={340}
        content={({ close }) => (
          <OptionPicker
            options={options}
            selected={value}
            onSelect={(next) => onChange(next)}
            searchable
            searchPlaceholder="Найти задачу по названию или коду..."
            emptyText="Подходящих задач нет"
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
                      Открепить от родителя
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
            active={Boolean(parent)}
            muted={!parent}
            hasClear={Boolean(parent)}
            {...props}
          >
            <GitBranch size={15} className="shrink-0 text-gray-400" />
            {parent ? (
              <span className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                <span className="shrink-0 text-theme-xs font-semibold uppercase tracking-wide text-gray-400">
                  {parent.code}
                </span>
                <span className="min-w-0 flex-1 truncate">{parent.title}</span>
              </span>
            ) : (
              <span className="min-w-0 flex-1 truncate text-left">{placeholder}</span>
            )}
          </ControlButton>
        )}
      </Popover>
      {parent && <ClearButton onClick={() => onChange(null)} label="Открепить от родителя" />}
    </FieldSlot>
  );
}
