import { useCallback, useMemo, useState } from "react";

import {
  dynamicFieldDefault,
  validateDynamicValue,
} from "../../Employees/Form/layout/DynamicFieldControl";
import { useCustomFieldsSchema } from "./useCustomFieldsSchema";

/**
 * Значения динамических полей одной таблицы в форме на обычном `useState`
 * (модалки KPI, компенсаций, формы вакансии и кандидата — все устроены так).
 *
 * Собирает в одном месте то, что иначе пришлось бы повторять в каждой форме:
 * подстановку значений записи, дефолты по типу, проверку правил и сборку
 * контейнера для payload.
 */

/** Контейнер приходит строкой — поле типа JSON в u-code. */
export const parseCustomData = (raw: unknown): Record<string, unknown> => {
  if (!raw) return {};

  if (typeof raw !== "string") {
    return typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.error("Failed to parse custom_data:", error);
    return {};
  }
};

export const useDynamicValues = (entitySlug: string) => {
  const { schema, getFields } = useCustomFieldsSchema();

  const fields = useMemo(
    () => getFields(entitySlug).filter((field) => !field.system),
    [getFields, entitySlug]
  );

  /** Ключ поля-контейнера или null, если его ещё не завели в u-code. */
  const valuesField = useMemo(
    () => schema.entities.find((entity) => entity.id === entitySlug)?.valuesField ?? null,
    [schema.entities, entitySlug]
  );

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  /** Значения записи + дефолты для полей, которых в ней ещё нет. */
  const reset = useCallback(
    (raw?: unknown) => {
      const stored = parseCustomData(raw);
      const next: Record<string, unknown> = { ...stored };

      fields.forEach((field) => {
        if (next[field.key] === undefined) next[field.key] = dynamicFieldDefault(field);
      });

      setValues(next);
      setErrors({});
    },
    [fields]
  );

  const setValue = useCallback((key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    // Ошибку убираем сразу, как только поле тронули.
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const rest = { ...prev };
      delete rest[key];
      return rest;
    });
  }, []);

  /** true — всё в порядке; иначе подсвечивает поля и возвращает false. */
  const validate = useCallback(() => {
    const next: Record<string, string> = {};

    fields.forEach((field) => {
      const message = validateDynamicValue(field, values[field.key]);
      if (message) next[field.key] = message;
    });

    setErrors(next);
    return Object.keys(next).length === 0;
  }, [fields, values]);

  /**
   * Кусок payload с контейнером значений. Пустой объект, пока поле не заведено
   * в u-code: items API всё равно вырезал бы незнакомый ключ.
   *
   * `keyOverride` — для форм, чей черновик хранит контейнер под своим именем
   * (например `customData` у вакансии и кандидата, сервис сам переложит его в
   * `custom_data`).
   */
  const toPayload = useCallback((keyOverride?: string): Record<string, string> => {
    if (!valuesField) return {};

    const collected: Record<string, unknown> = {};
    fields.forEach((field) => {
      const value = values[field.key];
      if (value === undefined || value === null || value === "") return;
      if (Array.isArray(value) && value.length === 0) return;
      collected[field.key] = value;
    });

    return { [keyOverride ?? valuesField]: JSON.stringify(collected) };
  }, [fields, values, valuesField]);

  return { fields, valuesField, values, errors, setValue, reset, validate, toPayload };
};
