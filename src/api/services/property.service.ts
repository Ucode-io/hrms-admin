import { useMutation, useQuery, useQueryClient } from "react-query";
import axios from "axios";
import httpRequest, { injectCompaniesIdIntoInvokeFunctionRequest } from "../httpRequest";
import authStore from "../../store/auth.store";
import { retryWithFreshToken } from "../unauthorizedHandler";
import { COMPANY_ID } from "./settingsDirectory.service";
import encodeJsonToUrlParam from "../../utils/encodeJsonToUrlParam";
import {
  type PropertyHistoryEntry,
  type PropertyItem,
  type PropertyStatus,
} from "../../modules/Property/types";

const PROPERTIES_SLUG = "properties";
const PROPERTY_HISTORIES_SLUG = "property_histories";

const REPORTS_BASE_URL = "https://api.admin.u-code.io";
const REPORTS_FUNCTION_PATH =
  "/v2/invoke_function/udevs-hrms-reports?project-id=9a462573-ce11-4288-928a-a6ba754b6998";
const MOVE_PROPERTY_METHOD = "move_property";

// ───── Raw API row shapes ─────

interface EmployeeRelation {
  guid?: string;
  first_name?: string | null;
  second_name?: string | null;
  middle_name?: string | null;
  photo?: string | null;
}

export interface PropertyApiRow {
  guid: string;
  name?: string | null;
  property_categories_id?: string | null;
  property_categories_id_data?: { guid?: string; title?: string } | null;
  serial_number?: string | null;
  cost?: number | string | null;
  photo?: string | null;
  purchase_date?: string | null;
  warranty_until?: string | null;
  description?: string | null;
  status?: string[] | string | null;
  user_base_id?: string | null;
  user_base_id_data?: EmployeeRelation | null;
  assigned_date?: string | null;
  [key: string]: unknown;
}

interface PropertyHistoryApiRow {
  guid: string;
  created_at?: string | null;
  from_status?: string[] | string | null;
  to_status?: string[] | string | null;
  movement_date?: string | null;
  comment?: string | null;
  user_base_id?: string | null;
  user_base_id_data?: EmployeeRelation | null;
  user_base_id_2_data?: EmployeeRelation | null;
  [key: string]: unknown;
}

interface ListResponse<T> {
  count: number;
  response: T[];
}

// ───── Mappers ─────

const VALID_STATUSES: PropertyStatus[] = ["in_stock", "assigned", "repair", "written_off"];

const normalizeStatus = (value: PropertyApiRow["status"]): PropertyStatus => {
  const raw = Array.isArray(value) ? value[0] : value;
  return VALID_STATUSES.includes(raw as PropertyStatus) ? (raw as PropertyStatus) : "in_stock";
};

const employeeName = (employee?: EmployeeRelation | null): string | null => {
  if (!employee) return null;
  const name = [employee.second_name, employee.first_name]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" ");
  return name || null;
};

export const mapPropertyRow = (row: PropertyApiRow): PropertyItem => ({
  id: row.guid,
  name: row.name || "",
  categoryId: row.property_categories_id ?? null,
  categoryTitle: row.property_categories_id_data?.title || "—",
  serialNumber: row.serial_number || "",
  cost: Number(row.cost) || 0,
  photo: row.photo || null,
  purchaseDate: row.purchase_date || null,
  warrantyUntil: row.warranty_until || null,
  description: row.description || "",
  status: normalizeStatus(row.status),
  assignedToGuid: row.user_base_id ?? null,
  assignedToName: employeeName(row.user_base_id_data),
  assignedDate: row.assigned_date || null,
});

export const mapPropertyHistoryRow = (row: PropertyHistoryApiRow): PropertyHistoryEntry => {
  const fromRaw = Array.isArray(row.from_status) ? row.from_status[0] : row.from_status;
  const toRaw = Array.isArray(row.to_status) ? row.to_status[0] : row.to_status;
  return {
    id: row.guid,
    at: row.created_at || "",
    fromStatus: VALID_STATUSES.includes(fromRaw as PropertyStatus)
      ? (fromRaw as PropertyStatus)
      : null,
    toStatus: VALID_STATUSES.includes(toRaw as PropertyStatus)
      ? (toRaw as PropertyStatus)
      : "in_stock",
    assigneeName: employeeName(row.user_base_id_data),
    date: row.movement_date || null,
    comment: row.comment || "",
    author: employeeName(row.user_base_id_2_data) || "—",
  };
};

// ───── Items API CRUD ─────

export interface PropertiesQueryParams {
  limit: number;
  offset: number;
  search?: string;
  categoryId?: string;
  status?: PropertyStatus | "";
}

export interface PropertyWritePayload {
  name: string;
  property_categories_id: string | null;
  serial_number: string;
  cost: number;
  photo: string | null;
  purchase_date: string | null;
  warranty_until: string | null;
  description: string;
}

const propertyService = {
  getList: (params: PropertiesQueryParams) => {
    const data: Record<string, unknown> = { limit: params.limit, offset: params.offset };
    if (params.search) data.search = params.search;
    if (params.categoryId) data.property_categories_id = params.categoryId;
    if (params.status) data.status = [params.status];
    return httpRequest.get(`/v2/items/${PROPERTIES_SLUG}`, {
      params: { with_relations: true, data: encodeJsonToUrlParam(data) },
    }) as unknown as Promise<ListResponse<PropertyApiRow>>;
  },

  getOne: (guid: string) =>
    httpRequest.get(`/v2/items/${PROPERTIES_SLUG}/${guid}`, {
      params: { with_relations: true },
    }) as unknown as Promise<{ response?: PropertyApiRow; data?: PropertyApiRow }>,

  getHistory: (propertiesId: string) =>
    httpRequest.get(`/v2/items/${PROPERTY_HISTORIES_SLUG}`, {
      params: {
        with_relations: true,
        data: encodeJsonToUrlParam({ properties_id: propertiesId, limit: 200, offset: 0 }),
      },
    }) as unknown as Promise<ListResponse<PropertyHistoryApiRow>>,

  create: (payload: PropertyWritePayload) =>
    httpRequest.post(`/v2/items/${PROPERTIES_SLUG}`, {
      data: { companies_id: COMPANY_ID, status: ["in_stock"], ...payload },
    }),

  update: (guid: string, payload: PropertyWritePayload) =>
    httpRequest.put(`/v2/items/${PROPERTIES_SLUG}/${guid}`, {
      data: { ...payload, guid },
    }),

  delete: async (guid: string) => {
    try {
      return await httpRequest.delete(`/v2/items/${PROPERTIES_SLUG}`, {
        data: { ids: [guid] },
      });
    } catch {
      return httpRequest.delete(`/v2/items/${PROPERTIES_SLUG}/${guid}`);
    }
  },
};

// ───── invoke_function client (for the transactional movement) ─────

const invokeRequest = axios.create({
  baseURL: REPORTS_BASE_URL,
  timeout: 100_000,
  headers: { "Content-Type": "application/json" },
});

invokeRequest.interceptors.request.use((config) => {
  const token = authStore.token ?? localStorage.getItem("auth_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return injectCompaniesIdIntoInvokeFunctionRequest(config);
});

invokeRequest.interceptors.response.use(
  (response) => response,
  retryWithFreshToken(invokeRequest)
);

export interface MovePropertyPayload {
  properties_id: string;
  to_status: PropertyStatus;
  user_base_id: string | null;
  movement_date: string | null;
  comment: string;
  author_user_base_id: string | null;
}

const findServerError = (node: unknown, seen = new Set<unknown>()): string | null => {
  if (!node || typeof node !== "object" || seen.has(node)) return null;
  seen.add(node);
  const record = node as Record<string, unknown>;
  if (typeof record.server_error === "string" && record.server_error) return record.server_error;
  for (const key of ["data", "result", "response", "body"]) {
    const nested = findServerError(record[key], seen);
    if (nested) return nested;
  }
  return null;
};

const moveProperty = async (payload: MovePropertyPayload) => {
  const response = await invokeRequest.post(REPORTS_FUNCTION_PATH, {
    data: { method: MOVE_PROPERTY_METHOD, data: payload },
  });
  const serverError = findServerError(response.data);
  if (serverError) throw new Error(serverError);
  return response.data;
};

// ───── React Query hooks ─────

export const usePropertiesQuery = (params: PropertiesQueryParams) =>
  useQuery({
    queryKey: ["properties", params],
    queryFn: () => propertyService.getList(params),
    keepPreviousData: true,
  });

export const usePropertyQuery = (guid: string | undefined) =>
  useQuery({
    queryKey: ["property", guid],
    queryFn: () => propertyService.getOne(guid as string),
    enabled: Boolean(guid),
  });

export const usePropertyHistoryQuery = (propertiesId: string | null, enabled: boolean) =>
  useQuery({
    queryKey: ["property-histories", propertiesId],
    queryFn: () => propertyService.getHistory(propertiesId as string),
    enabled: Boolean(propertiesId) && enabled,
  });

export const useCreateProperty = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PropertyWritePayload) => propertyService.create(payload),
    onSuccess: () => queryClient.invalidateQueries(["properties"]),
  });
};

export const useUpdateProperty = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guid, payload }: { guid: string; payload: PropertyWritePayload }) =>
      propertyService.update(guid, payload),
    onSuccess: () => queryClient.invalidateQueries(["properties"]),
  });
};

export const useDeleteProperty = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (guid: string) => propertyService.delete(guid),
    onSuccess: () => queryClient.invalidateQueries(["properties"]),
  });
};

export const useMoveProperty = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MovePropertyPayload) => moveProperty(payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries(["properties"]);
      queryClient.invalidateQueries(["property-histories", variables.properties_id]);
    },
  });
};
