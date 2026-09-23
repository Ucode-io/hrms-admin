import { useMemo, useState } from "react";
import { Tag, X } from "lucide-react";
import { chipStyle, findDirectoryItem } from "../../constants";
import type { TaskDirectoryItem } from "../../types";
import Popover from "../ui/Popover";
import OptionPicker, { type PickerOption } from "../ui/OptionPicker";
import { ControlButton, type ControlVariant } from "../ui/controls";
import { useTranslation } from "../../../../i18n";

interface TagsFieldProps {
  /** Выбранные теги — id из справочника. */
  value: string[];
  tags: TaskDirectoryItem[];
  onChange: (tagIds: string[]) => void;
  /** Создание тега на лету: заводит его в справочнике и возвращает id. */
  onCreateTag?: (title: string) => Promise<string | null>;
  variant: ControlVariant;
}

export default function TagsField({
  value,
  tags,
  onChange,
  onCreateTag,
  variant,
}: TagsFieldProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const options = useMemo<PickerOption[]>(
    () =>
      tags.map((tag) => ({
        value: tag.id,
        label: tag.title,
        // Точка цвета — тег из справочника, цвет задаётся в настройках.
        icon: (
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: tag.color || "#94a3b8" }}
          />
        ),
      })),
    [tags]
  );

  const toggle = (tagId: string) => {
    onChange(value.includes(tagId) ? value.filter((item) => item !== tagId) : [...value, tagId]);
  };

  const selected = value.map((id) => findDirectoryItem(tags, id));

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      width={260}
      content={({ close }) => (
        <OptionPicker
          options={options}
          selected={value}
          onSelect={toggle}
          onCreate={
            onCreateTag
              ? async (label) => {
                  const id = await onCreateTag(label);
                  if (id) onChange([...value, id]);
                }
              : undefined
          }
          createLabel={(query) => t("tasks.tags.create_label", { query })}
          searchable
          searchPlaceholder={t("tasks.tags.search_placeholder")}
          emptyText={t("tasks.tags.empty_text")}
          closeOnSelect={false}
          close={close}
        />
      )}
    >
      {({ ref, props }) => (
        <ControlButton
          ref={ref}
          variant={variant}
          open={open}
          active={value.length > 0}
          muted={value.length === 0}
          className={variant === "row" ? "flex-wrap" : ""}
          {...props}
        >
          <Tag size={14} className="shrink-0 text-gray-400" />
          {value.length === 0 ? (
            <span className="flex-1 truncate text-left">{t("tasks.tags.add_tags")}</span>
          ) : variant === "row" ? (
            <span className="flex min-w-0 flex-1 flex-wrap gap-1">
              {selected.map((tag, index) => (
                <span
                  key={value[index]}
                  className="inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-theme-xs"
                  style={chipStyle(tag.color)}
                >
                  <span className="truncate">{tag.title}</span>
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={t("tasks.tags.remove_tag", { tag: tag.title })}
                    onClick={(event) => {
                      event.stopPropagation();
                      onChange(value.filter((item) => item !== value[index]));
                    }}
                    className="opacity-60 transition hover:opacity-100"
                  >
                    <X size={11} />
                  </span>
                </span>
              ))}
            </span>
          ) : (
            <span className="min-w-0 flex-1 truncate text-left">
              {selected.map((tag) => tag.title).join(", ")}
            </span>
          )}
        </ControlButton>
      )}
    </Popover>
  );
}
