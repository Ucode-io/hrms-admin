import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  GripVertical,
  Lock,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { Modal } from "../../../../components/ui/modal";
import Button from "../../../../components/ui/button/Button";
import DateInput from "../../../../components/form/DateInput";
import { FieldControl } from "./FieldControl";
import {
  DIRECTORY_SLUGS,
  FIELD_TYPES,
  FIELD_TYPE_GROUPS,
  FIELD_TYPE_MAP,
  OPTION_COLORS,
} from "../constants";
import type { CustomField, FieldOption, FieldType } from "../types";
import { createOption, isValidKey, slugifyKey, typeSupportsOptions } from "../utils";
import {
  EditorSection,
  FormRow,
  ToggleRow,
  compactInputClass,
  inputClass,
  textareaClass,
} from "./Controls";

type FieldEditorModalProps = {
  isOpen: boolean;
  field: CustomField | null;
  usedKeys: string[];
  onClose: () => void;
  onSave: (field: CustomField) => void;
};

type EditorTab = "main" | "rules";

const TABS: { value: EditorTab; label: string }[] = [
  { value: "main", label: "Основное" },
  { value: "rules", label: "Правила" },
];

const toNullableNumber = (value: string): number | null => {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export default function FieldEditorModal({
  isOpen,
  field,
  usedKeys,
  onClose,
  onSave,
}: FieldEditorModalProps) {
  const [draft, setDraft] = useState<CustomField | null>(field);
  const [activeTab, setActiveTab] = useState<EditorTab>("main");
  const [errors, setErrors] = useState<Record<string, string>>({});
  /** Шаг «выберите тип»: открыт для новых полей; canGoBack — можно вернуться к настройкам. */
  const [typePicker, setTypePicker] = useState({ open: false, canGoBack: false });
  const keyTouchedRef = useRef(false);
  /** Создание нового поля (мастер из 2 шагов) или настройка существующего. */
  const isNewFieldRef = useRef(false);

  useEffect(() => {
    setDraft(field);
    setActiveTab("main");
    setErrors({});
    keyTouchedRef.current = Boolean(field?.key);

    const isNewField = Boolean(field) && !field?.label.trim() && !field?.key.trim();
    isNewFieldRef.current = isNewField;
    setTypePicker({ open: isNewField, canGoBack: false });
  }, [field]);

  const typeMeta = draft ? FIELD_TYPE_MAP[draft.type] : null;

  const groupedTypes = useMemo(
    () =>
      FIELD_TYPE_GROUPS.map((group) => ({
        group,
        items: FIELD_TYPES.filter((meta) => meta.group === group),
      })),
    []
  );

  if (!isOpen || !draft) return null;

  const patch = (changes: Partial<CustomField>) => {
    setDraft((prev) => (prev ? { ...prev, ...changes } : prev));
  };

  const patchRules = (changes: Partial<CustomField["rules"]>) => {
    setDraft((prev) =>
      prev ? { ...prev, rules: { ...prev.rules, ...changes } } : prev
    );
  };

  const handleLabelChange = (label: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      if (prev.system || keyTouchedRef.current) return { ...prev, label };
      return { ...prev, label, key: slugifyKey(label) };
    });
  };

  const handleTypeChange = (type: FieldType) => {
    setDraft((prev) => {
      if (!prev) return prev;

      const nextOptions =
        typeSupportsOptions(type) && prev.options.length === 0
          ? [createOption(0), createOption(1)]
          : prev.options;

      return {
        ...prev,
        type,
        options: typeSupportsOptions(type) ? nextOptions : prev.options,
        directorySlug: type === "directory" ? prev.directorySlug : "",
      };
    });
    setTypePicker({ open: false, canGoBack: true });
  };

  const patchOption = (optionId: string, changes: Partial<FieldOption>) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            options: prev.options.map((option) =>
              option.id === optionId ? { ...option, ...changes } : option
            ),
          }
        : prev
    );
  };

  const removeOption = (optionId: string) => {
    setDraft((prev) =>
      prev
        ? { ...prev, options: prev.options.filter((o) => o.id !== optionId) }
        : prev
    );
  };

  const addOption = () => {
    setDraft((prev) =>
      prev ? { ...prev, options: [...prev.options, createOption(prev.options.length)] } : prev
    );
  };

  const handleSubmit = () => {
    const nextErrors: Record<string, string> = {};

    if (!draft.label.trim()) {
      nextErrors.label = "Укажите название поля";
    }

    if (!draft.key.trim()) {
      nextErrors.key = "Укажите системный ключ";
    } else if (!isValidKey(draft.key)) {
      nextErrors.key =
        "Только латиница в нижнем регистре, цифры и «_», начиная с буквы";
    } else if (usedKeys.includes(draft.key)) {
      nextErrors.key = "Такой ключ уже используется в этой таблице";
    }

    const normalizedOptions = draft.options.map((option, index) => ({
      ...option,
      value: option.value.trim() || slugifyKey(option.label) || `option_${index + 1}`,
    }));

    if (typeSupportsOptions(draft.type)) {
      if (normalizedOptions.filter((option) => option.label.trim()).length < 1) {
        nextErrors.options = "Добавьте хотя бы один вариант";
      }
    }

    if (draft.type === "directory" && !draft.directorySlug) {
      nextErrors.directorySlug = "Выберите справочник";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      if (nextErrors.label || nextErrors.key || nextErrors.options || nextErrors.directorySlug) {
        setActiveTab("main");
      }
      return;
    }

    onSave({
      ...draft,
      label: draft.label.trim(),
      key: draft.key.trim(),
      options: typeSupportsOptions(draft.type)
        ? normalizedOptions.filter((option) => option.label.trim())
        : [],
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={false}
      className="mx-4 w-full max-w-[900px] overflow-hidden rounded-2xl border border-gray-200 shadow-xl"
    >
      <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
        <div className="flex min-w-0 items-start gap-2.5">
          {typePicker.open && typePicker.canGoBack && (
            <button
              type="button"
              onClick={() => setTypePicker({ open: false, canGoBack: true })}
              className="mt-0.5 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="Назад к настройкам"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">
              {typePicker.open
                ? isNewFieldRef.current
                  ? "Какое поле добавить?"
                  : "Изменить тип поля"
                : field?.label
                  ? "Изменение поля"
                  : "Новое поле"}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">
              {typePicker.open
                ? isNewFieldRef.current
                  ? "Шаг 1 из 2 — выберите тип: от него зависят правила и вид поля"
                  : "Выберите новый тип — введённые настройки сохранятся"
                : isNewFieldRef.current
                  ? "Шаг 2 из 2 — название, ключ и правила"
                  : "Название, ключ и правила"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          aria-label="Закрыть"
        >
          <X size={18} />
        </button>
      </div>

      {!typePicker.open && (
        <div className="border-b border-gray-100 px-6">
          <div className="flex gap-6">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`-mb-px border-b-2 py-3 text-sm font-medium transition ${
                  activeTab === tab.value
                    ? "border-brand-500 text-brand-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modal рендерит children внутри своей обёртки, поэтому скроллим сам блок, а не flex-колонку. */}
      <div className={`overflow-y-auto px-6 py-5 ${typePicker.open ? "max-h-[65vh]" : "max-h-[48vh]"}`}>
        {typePicker.open ? (
          <div className="space-y-5">
            {groupedTypes.map(({ group, items }) => (
              <div key={group}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {group}
                </p>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {items.map((meta) => {
                    const Icon = meta.icon;
                    const isActive = draft.type === meta.type && typePicker.canGoBack;

                    return (
                      <button
                        key={meta.type}
                        type="button"
                        onClick={() => handleTypeChange(meta.type)}
                        className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition ${
                          isActive
                            ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                            : "border-gray-200 hover:border-brand-300 hover:bg-brand-50/40"
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                            isActive ? "bg-brand-500 text-white" : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          <Icon size={15} />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-gray-800">
                            {meta.title}
                          </span>
                          <span className="block truncate text-xs text-gray-500">
                            {meta.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
        {activeTab === "main" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormRow label="Название" required error={errors.label}>
                <input
                  className={inputClass}
                  value={draft.label}
                  onChange={(event) => handleLabelChange(event.target.value)}
                  placeholder="Например: Серия и номер паспорта"
                />
              </FormRow>

              <FormRow
                label="Системный ключ"
                required
                error={errors.key}
                hint={draft.system ? "Статичное поле — ключ изменить нельзя" : "Имя колонки в таблице"}
              >
                <div className="relative">
                  <input
                    className={`${inputClass} font-mono ${draft.system ? "pr-10" : ""}`}
                    value={draft.key}
                    disabled={draft.system}
                    onChange={(event) => {
                      keyTouchedRef.current = true;
                      patch({ key: event.target.value.toLowerCase() });
                    }}
                    placeholder="passport_series"
                  />
                  {draft.system && (
                    <Lock
                      size={15}
                      className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                  )}
                </div>
              </FormRow>
            </div>

            {typeMeta && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white">
                    <typeMeta.icon size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {typeMeta.title}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {typeMeta.description}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTypePicker({ open: true, canGoBack: true })}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-brand-300 hover:text-brand-600"
                >
                  Изменить тип
                </button>
              </div>
            )}

            {draft.type === "directory" && (
              <FormRow label="Справочник" required error={errors.directorySlug}>
                <select
                  className={inputClass}
                  value={draft.directorySlug}
                  onChange={(event) => patch({ directorySlug: event.target.value })}
                >
                  <option value="">Выберите справочник</option>
                  {DIRECTORY_SLUGS.map((directory) => (
                    <option key={directory.value} value={directory.value}>
                      {directory.label}
                    </option>
                  ))}
                  {draft.directorySlug &&
                    !DIRECTORY_SLUGS.some((d) => d.value === draft.directorySlug) && (
                      <option value={draft.directorySlug}>{draft.directorySlug}</option>
                    )}
                </select>
              </FormRow>
            )}

            {typeSupportsOptions(draft.type) && (
              <EditorSection
                title="Варианты"
                description="Значение подставится автоматически из названия, если оставить пустым"
              >
                <div className="space-y-2">
                  {draft.options.map((option, index) => (
                    <div
                      key={option.id}
                      className="flex items-center gap-2 rounded-xl border border-gray-200 p-2"
                    >
                      <GripVertical size={16} className="shrink-0 text-gray-300" />
                      <input
                        className={`${compactInputClass} min-w-0 flex-1`}
                        value={option.label}
                        onChange={(event) =>
                          patchOption(option.id, { label: event.target.value })
                        }
                        placeholder={`Вариант ${index + 1}`}
                      />
                      <input
                        className={`${compactInputClass} w-36 shrink-0 font-mono text-xs`}
                        value={option.value}
                        onChange={(event) =>
                          patchOption(option.id, { value: event.target.value })
                        }
                        placeholder="value"
                      />
                      <div className="flex shrink-0 items-center gap-1">
                        {OPTION_COLORS.slice(0, 6).map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => patchOption(option.id, { color })}
                            style={{ backgroundColor: color }}
                            className={`h-4.5 w-4.5 rounded-full transition ${
                              option.color === color
                                ? "ring-2 ring-gray-900 ring-offset-1"
                                : "opacity-60 hover:opacity-100"
                            }`}
                            aria-label={`Цвет ${color}`}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOption(option.id)}
                        className="rounded-lg p-2 text-gray-400 transition hover:bg-error-50 hover:text-error-500"
                        aria-label="Удалить вариант"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>

                {errors.options && (
                  <p className="text-xs text-error-500">{errors.options}</p>
                )}

                <button
                  type="button"
                  onClick={addOption}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition hover:border-brand-300 hover:text-brand-600"
                >
                  <Plus size={15} /> Добавить вариант
                </button>
              </EditorSection>
            )}

            <EditorSection title="Подсказки для сотрудника">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormRow label="Плейсхолдер">
                  <input
                    className={inputClass}
                    value={draft.placeholder}
                    onChange={(event) => patch({ placeholder: event.target.value })}
                    placeholder="Текст внутри поля"
                  />
                </FormRow>

                <FormRow label="Значение по умолчанию">
                  <input
                    className={inputClass}
                    value={draft.defaultValue}
                    onChange={(event) => patch({ defaultValue: event.target.value })}
                    placeholder="Подставляется при создании"
                  />
                </FormRow>
              </div>

              <FormRow label="Подсказка под полем">
                <textarea
                  className={textareaClass}
                  rows={2}
                  value={draft.hint}
                  onChange={(event) => patch({ hint: event.target.value })}
                  placeholder="Короткое пояснение для сотрудника"
                />
              </FormRow>
            </EditorSection>
          </div>
        )}

        {activeTab === "rules" && (
          <div className="space-y-6">
            <EditorSection title="Общие правила">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ToggleRow
                  title="Обязательное"
                  description="Нельзя сохранить форму без значения"
                  checked={draft.rules.required}
                  onChange={(required) => patchRules({ required })}
                />
                <ToggleRow
                  title="Уникальное"
                  description="Значение не должно повторяться"
                  checked={draft.rules.unique}
                  onChange={(unique) => patchRules({ unique })}
                />
                <ToggleRow
                  title="Только чтение"
                  description="Заполняется системой или интеграцией"
                  checked={draft.rules.readOnly}
                  onChange={(readOnly) => patchRules({ readOnly })}
                />
                {(draft.type === "employee" || draft.type === "directory" || draft.type === "file") && (
                  <ToggleRow
                    title="Несколько значений"
                    description="Разрешить выбрать больше одного"
                    checked={draft.rules.multiple}
                    onChange={(multiple) => patchRules({ multiple })}
                  />
                )}
              </div>
            </EditorSection>

            {typeMeta?.hasTextRules && (
              <EditorSection title="Текст">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormRow label="Минимальная длина">
                    <input
                      type="number"
                      className={inputClass}
                      value={draft.rules.minLength ?? ""}
                      onChange={(event) =>
                        patchRules({ minLength: toNullableNumber(event.target.value) })
                      }
                      placeholder="Без ограничения"
                    />
                  </FormRow>
                  <FormRow label="Максимальная длина">
                    <input
                      type="number"
                      className={inputClass}
                      value={draft.rules.maxLength ?? ""}
                      onChange={(event) =>
                        patchRules({ maxLength: toNullableNumber(event.target.value) })
                      }
                      placeholder="Без ограничения"
                    />
                  </FormRow>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormRow
                    label="Регулярное выражение"
                    hint="Например: ^[A-Z]{2}\d{7}$"
                  >
                    <input
                      className={`${inputClass} font-mono text-xs`}
                      value={draft.rules.pattern}
                      onChange={(event) => patchRules({ pattern: event.target.value })}
                      placeholder="^[A-Z]{2}\d{7}$"
                    />
                  </FormRow>
                  <FormRow label="Сообщение об ошибке">
                    <input
                      className={inputClass}
                      value={draft.rules.patternMessage}
                      onChange={(event) =>
                        patchRules({ patternMessage: event.target.value })
                      }
                      placeholder="Неверный формат"
                    />
                  </FormRow>
                </div>
              </EditorSection>
            )}

            {typeMeta?.hasNumberRules && (
              <EditorSection title="Число">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormRow label="Минимум">
                    <input
                      type="number"
                      className={inputClass}
                      value={draft.rules.min ?? ""}
                      onChange={(event) =>
                        patchRules({ min: toNullableNumber(event.target.value) })
                      }
                      placeholder="Без ограничения"
                    />
                  </FormRow>
                  <FormRow label="Максимум">
                    <input
                      type="number"
                      className={inputClass}
                      value={draft.rules.max ?? ""}
                      onChange={(event) =>
                        patchRules({ max: toNullableNumber(event.target.value) })
                      }
                      placeholder="Без ограничения"
                    />
                  </FormRow>
                </div>
              </EditorSection>
            )}

            {typeMeta?.hasDateRules && (
              <EditorSection title="Дата">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormRow label="Не раньше">
                    <DateInput
                      className={inputClass}
                      value={draft.rules.minDate}
                      max={draft.rules.maxDate || undefined}
                      onChange={(next) => patchRules({ minDate: next })}
                    />
                  </FormRow>
                  <FormRow label="Не позже">
                    <DateInput
                      className={inputClass}
                      value={draft.rules.maxDate}
                      min={draft.rules.minDate || undefined}
                      onChange={(next) => patchRules({ maxDate: next })}
                    />
                  </FormRow>
                </div>
              </EditorSection>
            )}

            {typeMeta?.hasFileRules && (
              <EditorSection title="Файл">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormRow
                    label="Разрешённые расширения"
                    hint="Через запятую: pdf, jpg, png"
                  >
                    <input
                      className={inputClass}
                      value={draft.rules.allowedExtensions.join(", ")}
                      onChange={(event) =>
                        patchRules({
                          allowedExtensions: event.target.value
                            .split(",")
                            .map((item) => item.trim().replace(/^\./, "").toLowerCase())
                            .filter(Boolean),
                        })
                      }
                      placeholder="pdf, jpg, png"
                    />
                  </FormRow>
                  <FormRow label="Максимальный размер, МБ">
                    <input
                      type="number"
                      className={inputClass}
                      value={draft.rules.maxFileSizeMb ?? ""}
                      onChange={(event) =>
                        patchRules({ maxFileSizeMb: toNullableNumber(event.target.value) })
                      }
                      placeholder="10"
                    />
                  </FormRow>
                </div>
              </EditorSection>
            )}
          </div>
        )}

          </>
        )}
      </div>

      {/* Живой предпросмотр: поле показывается так, как увидит его сотрудник */}
      {!typePicker.open && (
        <div className="border-t border-gray-100 bg-gray-50/70 px-6 py-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Так поле увидит сотрудник
          </p>
          <div
            key={`${draft.type}:${draft.defaultValue}:${draft.rules.readOnly}:${draft.options.map((o) => o.id + o.label + o.color).join(",")}`}
            className="max-w-[480px]"
          >
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {draft.label.trim() || "Название поля"}
              {draft.rules.required && <span className="ml-0.5 text-error-500">*</span>}
            </label>
            <FieldControl field={draft} />
            {draft.hint && <p className="mt-1 text-xs text-gray-500">{draft.hint}</p>}
          </div>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
        <Button variant="outline" className="h-11" onClick={onClose}>
          Отмена
        </Button>
        {!typePicker.open && (
          <Button className="h-11" onClick={handleSubmit}>
            Сохранить
          </Button>
        )}
      </div>
    </Modal>
  );
}
