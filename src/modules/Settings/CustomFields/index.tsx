import { useEffect, useMemo, useState } from "react";
import { Database, Loader2, Lock, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

import PageMeta from "../../../components/common/PageMeta";
import Button from "../../../components/ui/button/Button";
import { Modal } from "../../../components/ui/modal";
import FieldEditorModal from "./components/FieldEditorModal";
import FieldRow from "./components/FieldRow";
import { ENTITY_ICONS } from "./constants";
import type { CustomField } from "./types";
import { useCustomFieldsSchema } from "./useCustomFieldsSchema";
import { createEmptyField } from "./utils";

export default function CustomFieldsSettingsPage() {
  const {
    schema,
    stats,
    isLoading,
    isError,
    isSaving,
    getFields,
    upsertField,
    deleteField,
    duplicateField,
  } = useCustomFieldsSchema();

  const [activeEntityId, setActiveEntityId] = useState("");
  const [search, setSearch] = useState("");

  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [fieldToDelete, setFieldToDelete] = useState<CustomField | null>(null);

  const activeEntity = schema.entities.find(
    (entity) => entity.id === activeEntityId
  );

  // Каталог таблиц приходит с сервера — открываем первую подключённую.
  useEffect(() => {
    if (activeEntity || schema.entities.length === 0) return;
    const firstEnabled = schema.entities.find((entity) => entity.enabled);
    setActiveEntityId((firstEnabled ?? schema.entities[0]).id);
  }, [activeEntity, schema.entities]);

  const entityFields = useMemo(
    () => getFields(activeEntityId),
    [getFields, activeEntityId]
  );

  const customFields = useMemo(
    () => entityFields.filter((field) => !field.system),
    [entityFields]
  );

  const normalizedSearch = search.trim().toLowerCase();

  /** Статичные поля таблицы показываем первыми — их видно, но менять нельзя. */
  const visibleFields = useMemo(() => {
    const matches = normalizedSearch
      ? entityFields.filter(
          (field) =>
            field.label.toLowerCase().includes(normalizedSearch) ||
            field.key.toLowerCase().includes(normalizedSearch)
        )
      : entityFields;

    return [
      ...matches.filter((field) => field.system),
      ...matches.filter((field) => !field.system),
    ];
  }, [entityFields, normalizedSearch]);

  const usedKeys = useMemo(
    () =>
      entityFields
        .filter((field) => field.id !== editingField?.id)
        .map((field) => field.key),
    [entityFields, editingField]
  );

  const summary = useMemo(
    () => ({
      custom: customFields.length,
      system: entityFields.length - customFields.length,
      required: customFields.filter((field) => field.rules.required).length,
    }),
    [customFields, entityFields]
  );

  /** Сообщение сервера («ключ уже используется» и т.п.) полезнее общей ошибки. */
  const describeError = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback;

  const handleAddField = () => {
    setEditingField(createEmptyField(activeEntityId, entityFields.length));
  };

  const handleSaveField = async (field: CustomField) => {
    try {
      await upsertField(field);
      setEditingField(null);
      toast.success("Поле сохранено.");
    } catch (error) {
      toast.error(describeError(error, "Не удалось сохранить поле."));
    }
  };

  const handleDuplicateField = async (fieldId: string) => {
    try {
      await duplicateField(fieldId);
      toast.success("Копия поля создана.");
    } catch (error) {
      toast.error(describeError(error, "Не удалось скопировать поле."));
    }
  };

  const confirmDeleteField = async () => {
    if (!fieldToDelete) return;

    try {
      await deleteField(fieldToDelete.id);
      setFieldToDelete(null);
      toast.success("Поле удалено.");
    } catch (error) {
      toast.error(describeError(error, "Не удалось удалить поле."));
    }
  };

  return (
    <>
      <PageMeta
        title="Динамические поля | Настройки"
        description="Дополнительные поля для таблиц HRMS"
      />

      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-gray-900">
              Динамические поля
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Добавляйте собственные поля к таблицам HRMS
            </p>
          </div>

          <Button
            size="sm"
            className="h-10"
            startIcon={<Plus size={15} />}
            disabled={!activeEntity?.enabled || isSaving}
            onClick={handleAddField}
          >
            Новое поле
          </Button>
        </div>

        {/* Выбор таблицы — горизонтальные вкладки, чтобы не отъедать ширину у контента */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {schema.entities.map((entity) => {
            const Icon = ENTITY_ICONS[entity.icon] ?? Database;
            const isActive = entity.id === activeEntityId;
            const entityStats = stats[entity.id];

            return (
              <button
                key={entity.id}
                type="button"
                disabled={!entity.enabled}
                onClick={() => {
                  setActiveEntityId(entity.id);
                  setSearch("");
                }}
                title={entity.enabled ? entity.slug : "Подключим на следующем этапе"}
                className={`flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition ${
                  isActive
                    ? "border-brand-500 bg-brand-50 text-brand-600"
                    : entity.enabled
                      ? "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                      : "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400"
                }`}
              >
                <Icon size={15} className={isActive ? "text-brand-500" : "text-gray-400"} />
                {entity.title}
                {entity.enabled ? (
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                      isActive
                        ? "bg-brand-500 text-white"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {entityStats?.custom ?? 0}
                  </span>
                ) : (
                  <Lock size={13} className="text-gray-400" />
                )}
              </button>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-gray-900">
                {activeEntity?.title ?? "Таблица"}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                {activeEntity && (
                  <>
                    <code className="rounded bg-gray-50 px-1.5 py-0.5 font-mono text-[11px] text-gray-500">
                      {activeEntity.slug}
                    </code>
                    <span className="text-gray-300">·</span>
                  </>
                )}
                <span>
                  динамических: <b className="text-gray-800">{summary.custom}</b>
                </span>
                <span className="text-gray-300">·</span>
                <span>
                  обязательных: <b className="text-gray-800">{summary.required}</b>
                </span>
                <span className="text-gray-300">·</span>
                <span>
                  статичных: <b className="text-gray-800">{summary.system}</b>
                </span>
              </p>
            </div>

            <label className="relative block w-full max-w-64 sm:w-64">
              <Search
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Поиск по полям..."
                className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
              />
            </label>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-gray-500">
              <Loader2 size={16} className="animate-spin" />
              Загружаем схему полей...
            </div>
          ) : isError ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-error-500">
                Не удалось загрузить схему полей. Обновите страницу.
              </p>
            </div>
          ) : visibleFields.length > 0 ? (
            <div>
              {visibleFields.map((field) => (
                <FieldRow
                  key={field.id}
                  field={field}
                  onEdit={setEditingField}
                  onDuplicate={handleDuplicateField}
                  onDelete={setFieldToDelete}
                />
              ))}
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <p className="text-sm text-gray-500">
                {normalizedSearch
                  ? "Ничего не найдено — попробуйте другой запрос"
                  : "У этой таблицы пока нет полей"}
              </p>
            </div>
          )}

          {activeEntity?.enabled && !isLoading && !isError && (
            <div className="border-t border-gray-100 p-3">
              <button
                type="button"
                onClick={handleAddField}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-3 text-sm font-medium text-gray-500 transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-600"
              >
                <Plus size={16} />
                {customFields.length === 0
                  ? "Добавить первое динамическое поле"
                  : "Добавить поле"}
              </button>
            </div>
          )}
        </div>
      </div>

      <FieldEditorModal
        isOpen={Boolean(editingField)}
        field={editingField}
        usedKeys={usedKeys}
        onClose={() => setEditingField(null)}
        onSave={handleSaveField}
      />

      <Modal
        isOpen={Boolean(fieldToDelete)}
        onClose={() => setFieldToDelete(null)}
        showCloseButton={false}
        className="mx-4 w-full max-w-[440px] overflow-hidden rounded-2xl border border-gray-200 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
          <h2 className="text-lg font-semibold text-gray-900">Удалить поле?</h2>
          <button
            type="button"
            onClick={() => setFieldToDelete(null)}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>
        <p className="px-6 pb-5 text-sm text-gray-500">
          Поле «{fieldToDelete?.label}» будет удалено из формы. Ранее сохранённые
          значения останутся в базе.
        </p>
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <Button variant="outline" className="h-11" onClick={() => setFieldToDelete(null)}>
            Отмена
          </Button>
          <Button
            className="h-11 !bg-error-500 hover:!bg-error-600"
            disabled={isSaving}
            onClick={confirmDeleteField}
          >
            Удалить
          </Button>
        </div>
      </Modal>
    </>
  );
}
