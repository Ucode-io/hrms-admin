// Динамические поля (Custom fields) — справочник определений полей.
//
// Идёт через cloud-функции udevs-hrms-reports (custom_fields_*), а не через
// items API: ключ поля должен быть уникален внутри пары (компания, таблица) на
// уровне БД, а список статичных колонок таблицы и зарезервированных ключей
// знает только сервер. Зеркалит careerSiteSettings.service.ts.
//
// Вся схема компании (каталог таблиц + статичные + динамические поля) приходит
// одним запросом и кэшируется целиком — переключение вкладок и форма сотрудника
// читают её из кэша, без похода на сервер.

import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { injectCompaniesIdIntoInvokeFunctionRequest } from "../httpRequest";
import authStore from "../../store/auth.store";
import { retryWithFreshToken } from "../unauthorizedHandler";
import type {
  CustomField,
  CustomFieldEntity,
  CustomFieldsSchema,
  FieldOption,
  FieldRules,
  FieldType,
} from "../../modules/Settings/CustomFields/types";
import { createEmptyRules } from "../../modules/Settings/CustomFields/utils";

const REPORTS_BASE_URL = "https://api.admin.u-code.io";
const REPORTS_FUNCTION_PATH =
  "/v2/invoke_function/udevs-hrms-reports?project-id=9a462573-ce11-4288-928a-a6ba754b6998";

const LIST_METHOD = "custom_fields_list";
const SAVE_METHOD = "custom_fields_save";
const DELETE_METHOD = "custom_fields_delete";

export const CUSTOM_FIELDS_QUERY_KEY = ["custom-fields-schema"];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const reportsRequest = axios.create({
  baseURL: REPORTS_BASE_URL,
  timeout: 100_000,
  headers: { "Content-Type": "application/json" },
});

reportsRequest.interceptors.request.use((config) => {
  const token = authStore.token ?? localStorage.getItem("auth_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return injectCompaniesIdIntoInvokeFunctionRequest(config);
});

reportsRequest.interceptors.response.use(
  (response) => response,
  retryWithFreshToken(reportsRequest)
);

// Ответ invoke_function завёрнут в несколько конвертов — спускаемся до узла с
// результатом нашего метода. Ошибка валидации приходит как `server_error`.
const findGatewayResult = (
  raw: unknown,
  method: string,
  depth = 0
): Record<string, unknown> | null => {
  if (depth > 6 || !isRecord(raw)) return null;
  if (typeof raw.server_error === "string" && raw.server_error) {
    throw new Error(raw.server_error);
  }
  if (raw.method === method && isRecord(raw.result)) {
    return raw.result as Record<string, unknown>;
  }
  for (const key of ["data", "result", "response"]) {
    const found = findGatewayResult(raw[key], method, depth + 1);
    if (found) return found;
  }
  return null;
};

const invoke = async (
  method: string,
  data: Record<string, unknown>
): Promise<Record<string, unknown> | null> => {
  const res = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
    data: { method, data },
  });
  return findGatewayResult(res.data, method);
};

const str = (value: unknown): string => (typeof value === "string" ? value : "");

const num = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
};

const mapOptions = (raw: unknown): FieldOption[] => {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).map((option) => ({
    id: str(option.id),
    value: str(option.value),
    label: str(option.label),
    color: str(option.color),
  }));
};

const mapRules = (raw: unknown): FieldRules => {
  const base = createEmptyRules();
  if (!isRecord(raw)) return base;

  return {
    ...base,
    required: Boolean(raw.required),
    unique: Boolean(raw.unique),
    readOnly: Boolean(raw.readOnly),
    multiple: Boolean(raw.multiple),
    minLength: num(raw.minLength),
    maxLength: num(raw.maxLength),
    min: num(raw.min),
    max: num(raw.max),
    maxFileSizeMb: num(raw.maxFileSizeMb),
    pattern: str(raw.pattern),
    patternMessage: str(raw.patternMessage),
    minDate: str(raw.minDate),
    maxDate: str(raw.maxDate),
    allowedExtensions: Array.isArray(raw.allowedExtensions)
      ? raw.allowedExtensions.map(str).filter(Boolean)
      : [],
  };
};

const mapField = (raw: unknown): CustomField | null => {
  if (!isRecord(raw)) return null;

  const entityId = str(raw.entity_slug);
  const key = str(raw.field_key);
  const system = Boolean(raw.system);

  return {
    // Статичные поля живут только в ответе сервера — синтетический id.
    id: system ? `sys_${entityId}_${key}` : str(raw.guid),
    entityId,
    key,
    label: str(raw.label),
    type: str(raw.field_type) as FieldType,
    placeholder: str(raw.placeholder),
    hint: str(raw.hint),
    defaultValue: str(raw.default_value),
    options: mapOptions(raw.options),
    directorySlug: str(raw.directory_slug),
    rules: mapRules(raw.rules),
    system,
    sortOrder: num(raw.sort_order) ?? 0,
  };
};

const mapSchema = (result: Record<string, unknown> | null): CustomFieldsSchema => {
  const rawEntities = Array.isArray(result?.entities) ? result?.entities : [];
  const rawFields = Array.isArray(result?.fields) ? result?.fields : [];

  const entities: CustomFieldEntity[] = [];
  const fields: CustomField[] = [];

  rawEntities.filter(isRecord).forEach((entity) => {
    const slug = str(entity.slug);

    entities.push({
      id: slug,
      slug,
      title: str(entity.title),
      description: str(entity.description),
      icon: str(entity.icon),
      enabled: Boolean(entity.enabled),
      valuesField: str(entity.values_field) || null,
    });

    // Статичные поля таблицы приходят вместе с ней и идут первыми в списке.
    if (Array.isArray(entity.system_fields)) {
      entity.system_fields.forEach((raw) => {
        const field = mapField(raw);
        if (field) fields.push(field);
      });
    }
  });

  rawFields.forEach((raw) => {
    const field = mapField(raw);
    if (field) {
      // Динамические поля всегда после статичных — sort_order у них свой.
      const systemCount = fields.filter(
        (item) => item.entityId === field.entityId && item.system
      ).length;
      fields.push({ ...field, sortOrder: systemCount + field.sortOrder });
    }
  });

  return { entities, fields };
};

/** Поле формы → payload метода сохранения. */
const toSavePayload = (field: CustomField): Record<string, unknown> => ({
  // Новое поле во фронте имеет временный id вида `fld_ab12cd` — это не guid.
  guid: UUID_PATTERN.test(field.id) ? field.id : undefined,
  entity_slug: field.entityId,
  field_key: field.key,
  label: field.label,
  field_type: field.type,
  placeholder: field.placeholder,
  hint: field.hint,
  default_value: field.defaultValue,
  directory_slug: field.directorySlug,
  options: field.options,
  rules: field.rules,
});

const customFieldsService = {
  list: async (): Promise<CustomFieldsSchema> => mapSchema(await invoke(LIST_METHOD, {})),

  save: async (field: CustomField): Promise<CustomField | null> => {
    const result = await invoke(SAVE_METHOD, toSavePayload(field));
    return mapField(result?.field);
  },

  remove: async (guid: string): Promise<string> => {
    await invoke(DELETE_METHOD, { guid });
    return guid;
  },
};

export const useCustomFieldsSchemaQuery = (querySettings: object = {}) =>
  useQuery({
    queryKey: CUSTOM_FIELDS_QUERY_KEY,
    queryFn: customFieldsService.list,
    staleTime: 5 * 60 * 1000,
    ...querySettings,
  });

export const useSaveCustomField = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (field: CustomField) => customFieldsService.save(field),
    // Обновляем кэш точечно вместо повторной загрузки всей схемы.
    onSuccess: (saved) => {
      if (!saved) return;

      queryClient.setQueryData<CustomFieldsSchema | undefined>(
        CUSTOM_FIELDS_QUERY_KEY,
        (previous) => {
          if (!previous) return previous;

          const exists = previous.fields.some((item) => item.id === saved.id);
          const systemCount = previous.fields.filter(
            (item) => item.entityId === saved.entityId && item.system
          ).length;
          const normalized = { ...saved, sortOrder: systemCount + saved.sortOrder };

          return {
            ...previous,
            fields: exists
              ? previous.fields.map((item) =>
                  item.id === normalized.id ? normalized : item
                )
              : [...previous.fields, normalized],
          };
        }
      );
    },
  });
};

export const useDeleteCustomField = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (guid: string) => customFieldsService.remove(guid),
    onSuccess: (guid) => {
      queryClient.setQueryData<CustomFieldsSchema | undefined>(
        CUSTOM_FIELDS_QUERY_KEY,
        (previous) =>
          previous
            ? { ...previous, fields: previous.fields.filter((item) => item.id !== guid) }
            : previous
      );
    },
  });
};

export default customFieldsService;
