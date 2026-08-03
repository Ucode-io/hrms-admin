// Раскладка формы (карточки и расположение полей).
//
// Документ на пару (компания, таблица), читается и пишется целиком — по частям
// он не нужен ни разу. Идёт через cloud-функции udevs-hrms-reports
// (`form_layout_*`), как и справочник динамических полей.

import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { injectCompaniesIdIntoInvokeFunctionRequest } from "../httpRequest";
import authStore from "../../store/auth.store";
import { handleUnauthorizedError } from "../unauthorizedHandler";
import type {
  EmployeeFormLayout,
  FormLayoutCard,
  FormLayoutItem,
  LayoutColumn,
  LayoutWidth,
} from "../../modules/Employees/Form/layout/types";

const REPORTS_BASE_URL = "https://api.admin.u-code.io";
const REPORTS_FUNCTION_PATH =
  "/v2/invoke_function/udevs-hrms-reports?project-id=9a462573-ce11-4288-928a-a6ba754b6998";

const GET_METHOD = "form_layout_get";
const SAVE_METHOD = "form_layout_save";

/** Пока настраивается только форма сотрудника. */
export const EMPLOYEE_FORM_ENTITY = "user_base";

export const formLayoutQueryKey = (entitySlug: string) => ["form-layout", entitySlug];

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
  (error) => {
    handleUnauthorizedError(error);
    return Promise.reject(error);
  }
);

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

const int = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
};

const mapCard = (raw: unknown, index: number): FormLayoutCard | null => {
  if (!isRecord(raw) || !str(raw.id)) return null;

  return {
    id: str(raw.id),
    title: str(raw.title),
    description: str(raw.description),
    column: (raw.column === "right" ? "right" : "left") as LayoutColumn,
    system: Boolean(raw.system),
    locked: Boolean(raw.locked),
    sortOrder: int(raw.sortOrder, index),
  };
};

const mapItem = (raw: unknown, index: number): FormLayoutItem | null => {
  if (!isRecord(raw) || !str(raw.id) || !str(raw.cardId)) return null;

  return {
    id: str(raw.id),
    kind: raw.kind === "dynamic" ? "dynamic" : "static",
    cardId: str(raw.cardId),
    width: (raw.width === "full" ? "full" : "half") as LayoutWidth,
    sortOrder: int(raw.sortOrder, index),
  };
};

const mapLayout = (raw: unknown): EmployeeFormLayout | null => {
  if (!isRecord(raw) || !Array.isArray(raw.cards)) return null;

  const cards = raw.cards
    .map(mapCard)
    .filter((card): card is FormLayoutCard => Boolean(card));
  if (cards.length === 0) return null;

  const items = Array.isArray(raw.items)
    ? raw.items.map(mapItem).filter((item): item is FormLayoutItem => Boolean(item))
    : [];

  return { cards, items };
};

const formLayoutService = {
  get: async (entitySlug: string): Promise<EmployeeFormLayout | null> => {
    const result = await invoke(GET_METHOD, { entity_slug: entitySlug });
    return mapLayout(result?.layout);
  },

  save: async (
    entitySlug: string,
    layout: EmployeeFormLayout
  ): Promise<EmployeeFormLayout | null> => {
    const result = await invoke(SAVE_METHOD, {
      entity_slug: entitySlug,
      layout,
    });
    return mapLayout(result?.layout);
  },
};

export const useFormLayoutQuery = (entitySlug: string, querySettings: object = {}) =>
  useQuery({
    queryKey: formLayoutQueryKey(entitySlug),
    queryFn: () => formLayoutService.get(entitySlug),
    staleTime: 5 * 60 * 1000,
    ...querySettings,
  });

export const useSaveFormLayout = (entitySlug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (layout: EmployeeFormLayout) =>
      formLayoutService.save(entitySlug, layout),
    onSuccess: (saved) => {
      if (saved) queryClient.setQueryData(formLayoutQueryKey(entitySlug), saved);
    },
  });
};

export default formLayoutService;
