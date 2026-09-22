import { translate } from "../../../i18n";
import { useCallback, useMemo } from "react";

import {
  useCustomFieldsSchemaQuery,
  useDeleteCustomField,
  useSaveCustomField,
} from "../../../api/services/customFields.service";
import type { CustomField, CustomFieldsSchema } from "./types";
import { createId, sortBySortOrder } from "./utils";

const EMPTY_SCHEMA: CustomFieldsSchema = { entities: [], fields: [] };

/**
 * Схема динамических полей компании: каталог таблиц + статичные и динамические
 * поля. Приходит одним запросом (`custom_fields_list`) и кэшируется react-query,
 * поэтому и страница настроек, и форма сотрудника читают её из одного кэша.
 */
export const useCustomFieldsSchema = () => {
  const { data, isLoading, isError, error, refetch } = useCustomFieldsSchemaQuery();
  const saveMutation = useSaveCustomField();
  const deleteMutation = useDeleteCustomField();

  const schema = data ?? EMPTY_SCHEMA;

  /** Все поля таблицы, включая статичные. */
  const getFields = useCallback(
    (entityId: string) =>
      sortBySortOrder(schema.fields.filter((field) => field.entityId === entityId)),
    [schema.fields]
  );

  const upsertField = useCallback(
    (field: CustomField) => saveMutation.mutateAsync(field),
    [saveMutation]
  );

  const deleteField = useCallback(
    (fieldId: string) => deleteMutation.mutateAsync(fieldId),
    [deleteMutation]
  );

  const duplicateField = useCallback(
    (fieldId: string) => {
      const source = schema.fields.find((field) => field.id === fieldId);
      if (!source) return Promise.resolve(null);

      return saveMutation.mutateAsync({
        ...source,
        // Новый id-заглушка: сервер поймёт, что это создание, а не изменение.
        id: createId("fld"),
        key: `${source.key}_copy`,
        label: `${source.label} ${translate("settings_custom_fields.copy_label")}`,
        system: false,
        options: source.options.map((option) => ({
          ...option,
          id: createId("opt"),
        })),
      });
    },
    [schema.fields, saveMutation]
  );

  const stats = useMemo(() => {
    const byEntity: Record<string, { total: number; custom: number }> = {};

    schema.entities.forEach((entity) => {
      const entityFields = schema.fields.filter(
        (field) => field.entityId === entity.id
      );

      byEntity[entity.id] = {
        total: entityFields.length,
        custom: entityFields.filter((field) => !field.system).length,
      };
    });

    return byEntity;
  }, [schema]);

  return {
    schema,
    stats,
    isLoading,
    isError,
    error,
    isSaving: saveMutation.isLoading || deleteMutation.isLoading,
    refetch,
    getFields,
    upsertField,
    deleteField,
    duplicateField,
  };
};
