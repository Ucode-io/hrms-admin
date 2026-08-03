import { useRef, useState } from "react";
import { Copy, Lock, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { Dropdown } from "../../../../components/ui/dropdown/Dropdown";
import { DropdownItem } from "../../../../components/ui/dropdown/DropdownItem";
import { FIELD_TYPE_MAP } from "../constants";
import type { CustomField } from "../types";
import { describeRules } from "../utils";

export type FieldRowActions = {
  onEdit: (field: CustomField) => void;
  onDuplicate: (fieldId: string) => void;
  onDelete: (field: CustomField) => void;
};

type FieldRowProps = FieldRowActions & {
  field: CustomField;
};

/**
 * Строка поля в списке. Динамическое — кликабельно и с меню действий,
 * статичное (`system`) — защищённое: только просмотр, без правки и удаления.
 */
export default function FieldRow({
  field,
  onEdit,
  onDuplicate,
  onDelete,
}: FieldRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  const meta = FIELD_TYPE_MAP[field.type];
  const Icon = meta?.icon;
  const ruleChips = describeRules(field);
  const isProtected = field.system;

  return (
    <div
      title={
        isProtected
          ? "Статичное поле таблицы — редактировать и удалять нельзя"
          : "Нажмите, чтобы изменить поле"
      }
      onClick={(event) => {
        if (isProtected) return;
        // Кнопки внутри строки не открывают редактор.
        if ((event.target as HTMLElement).closest("button")) return;
        onEdit(field);
      }}
      className={`group border-b border-gray-100 px-4 py-3 transition last:border-b-0 ${
        isProtected ? "bg-gray-50/40" : "cursor-pointer hover:bg-gray-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            isProtected ? "bg-gray-100 text-gray-400" : "bg-brand-50 text-brand-500"
          }`}
        >
          {Icon ? <Icon size={16} /> : null}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p
              className={`truncate text-sm font-medium ${
                isProtected ? "text-gray-600" : "text-gray-900"
              }`}
            >
              {field.label || "Без названия"}
            </p>
            {field.rules.required && <span className="text-error-500">*</span>}
            {isProtected && (
              <span className="flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                <Lock size={9} /> статичное
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <code className="rounded bg-gray-50 px-1.5 py-0.5 font-mono text-[11px] text-gray-500">
              {field.key}
            </code>
            <span className="text-[11px] text-gray-400">{meta?.title}</span>
            {ruleChips.map((chip) => (
              <span
                key={chip}
                className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>

        {isProtected ? (
          <span className="mt-1 flex shrink-0 items-center gap-1 text-[11px] font-medium text-gray-400">
            <Lock size={13} /> защищено
          </span>
        ) : (
          <div className="relative shrink-0">
            <button
              type="button"
              ref={menuButtonRef}
              onClick={() => setMenuOpen((prev) => !prev)}
              className="dropdown-toggle rounded-md p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="Действия с полем"
            >
              <MoreHorizontal size={16} />
            </button>
            <Dropdown
              isOpen={menuOpen}
              onClose={() => setMenuOpen(false)}
              className="w-44 p-1"
              usePortal
              anchorEl={menuButtonRef.current}
            >
              <DropdownItem
                onClick={() => {
                  setMenuOpen(false);
                  onEdit(field);
                }}
                baseClassName=""
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              >
                <Pencil size={14} /> Изменить
              </DropdownItem>
              <DropdownItem
                onClick={() => {
                  setMenuOpen(false);
                  onDuplicate(field.id);
                }}
                baseClassName=""
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              >
                <Copy size={14} /> Дублировать
              </DropdownItem>
              <DropdownItem
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(field);
                }}
                baseClassName=""
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-error-500 hover:bg-error-50"
              >
                <Trash2 size={14} /> Удалить
              </DropdownItem>
            </Dropdown>
          </div>
        )}
      </div>
    </div>
  );
}
