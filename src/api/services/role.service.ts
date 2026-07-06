// HRMS roles & module-access API.
//
// Application-level roles (NOT the ucode system `role`/permissions). Everything
// goes through the udevs-hrms-reports `hrms_role_*` / `hrms_user_access` cloud
// functions (PG-direct, transactional) — see ROLES_DB_SCHEMA.md. Mirrors the
// approval.service.ts gateway pattern.

import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { injectCompaniesIdIntoInvokeFunctionRequest } from "../httpRequest";
import authStore from "../../store/auth.store";
import { handleUnauthorizedError } from "../unauthorizedHandler";
import type { ModuleKey } from "../../modules/Settings/Roles/moduleCatalog";

const REPORTS_BASE_URL = "https://api.admin.u-code.io";
const REPORTS_FUNCTION_PATH =
  "/v2/invoke_function/udevs-hrms-reports?project-id=9a462573-ce11-4288-928a-a6ba754b6998";

const LIST_METHOD = "hrms_role_list";
const GET_METHOD = "hrms_role_get";
const SAVE_METHOD = "hrms_role_save";
const DELETE_METHOD = "hrms_role_delete";
const ASSIGN_METHOD = "hrms_role_assign";
const USER_ACCESS_METHOD = "hrms_user_access";

export interface Role {
  id: string;
  title: string;
  slug: string;
  description: string;
  color: string;
  isGlobal: boolean;
  isProtected: boolean;
  modules: ModuleKey[];
}

export interface RoleInput {
  title: string;
  slug?: string;
  description?: string;
  color?: string;
  modules: ModuleKey[];
}

export interface UserAccess {
  role: { id: string; slug: string; title: string; isGlobal: boolean } | null;
  modules: ModuleKey[];
}

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

// The invoke_function response nests the gateway result under a few envelopes;
// walk down until we find the node carrying our method's result.
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

const mapRole = (row: Record<string, unknown>): Role => ({
  id: String(row.id ?? ""),
  title: typeof row.title === "string" ? row.title : "",
  slug: typeof row.slug === "string" ? row.slug : "",
  description: typeof row.description === "string" ? row.description : "",
  color: typeof row.color === "string" ? row.color : "",
  isGlobal: Boolean(row.isGlobal),
  isProtected: Boolean(row.isProtected),
  modules: Array.isArray(row.modules) ? (row.modules as ModuleKey[]) : [],
});

const listRoles = async (): Promise<Role[]> => {
  const result = await invoke(LIST_METHOD, {});
  const roles = result && Array.isArray(result.roles) ? result.roles : [];
  return roles.filter(isRecord).map(mapRole);
};

const getRole = async (guid: string): Promise<Role | null> => {
  const result = await invoke(GET_METHOD, { guid });
  return result && isRecord(result.role) ? mapRole(result.role) : null;
};

const saveRole = (id: string | undefined, role: RoleInput) =>
  invoke(SAVE_METHOD, {
    ...(id ? { guid: id } : {}),
    title: role.title,
    ...(role.slug ? { slug: role.slug } : {}),
    description: role.description ?? "",
    color: role.color ?? "",
    modules: role.modules,
  });

const deleteRole = (guid: string) => invoke(DELETE_METHOD, { guid });

const assignRole = (userBaseId: string, roleId: string | null) =>
  invoke(ASSIGN_METHOD, {
    user_base_id: userBaseId,
    hrms_roles_id: roleId ?? "",
  });

const getCurrentUserBaseId = (): string =>
  (typeof authStore.user_data?.guid === "string" && authStore.user_data.guid) ||
  (typeof authStore.user?.guid === "string" && authStore.user.guid) ||
  "";

const getUserAccess = async (userBaseId: string): Promise<UserAccess> => {
  const result = await invoke(USER_ACCESS_METHOD, {
    user_base_id: userBaseId,
  });
  return {
    role:
      result && isRecord(result.role)
        ? {
            id: String(result.role.id ?? ""),
            slug: String((result.role as Record<string, unknown>).slug ?? ""),
            title: String((result.role as Record<string, unknown>).title ?? ""),
            isGlobal: Boolean(
              (result.role as Record<string, unknown>).isGlobal
            ),
          }
        : null,
    modules:
      result && Array.isArray(result.modules)
        ? (result.modules as ModuleKey[])
        : [],
  };
};

export const roleService = {
  listRoles,
  getRole,
  saveRole,
  deleteRole,
  assignRole,
  getUserAccess,
};

// --- React Query hooks -----------------------------------------------------

export const ROLES_QUERY_KEY = ["hrms-roles"];

export const useRolesQuery = (querySettings: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: ROLES_QUERY_KEY,
    queryFn: listRoles,
    staleTime: 60_000,
    ...querySettings,
  });

export const useSaveRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id?: string; role: RoleInput }) =>
      saveRole(id, role),
    onSuccess: () => queryClient.invalidateQueries(ROLES_QUERY_KEY),
  });
};

export const useDeleteRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (guid: string) => deleteRole(guid),
    onSuccess: () => queryClient.invalidateQueries(ROLES_QUERY_KEY),
  });
};

export const useAssignRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userBaseId,
      roleId,
    }: {
      userBaseId: string;
      roleId: string | null;
    }) => assignRole(userBaseId, roleId),
    onSuccess: () => queryClient.invalidateQueries(["current-user-access"]),
  });
};

/** Effective access for a specific employee (e.g. the detail page). */
export const useUserAccessQuery = (
  userBaseId: string,
  querySettings: Record<string, unknown> = {}
) =>
  useQuery({
    queryKey: ["user-access", userBaseId],
    queryFn: () => getUserAccess(userBaseId),
    enabled: Boolean(userBaseId),
    staleTime: 60_000,
    ...querySettings,
  });

/** Effective module access for the logged-in user (sidebar / route guard). */
export const useCurrentUserAccess = (
  querySettings: Record<string, unknown> = {}
) => {
  const guid = getCurrentUserBaseId();
  return useQuery({
    queryKey: ["current-user-access", guid],
    queryFn: () => getUserAccess(guid),
    enabled: Boolean(guid),
    staleTime: 5 * 60_000,
    ...querySettings,
  });
};
