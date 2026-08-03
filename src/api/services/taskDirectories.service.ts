// Справочники модуля «Задачи»: статусы, приоритеты, типы, теги, листы.
//
// Отдельный сервис от task.service.ts, потому что справочники живут дольше
// задач: их правят в настройках, а доска, таблица и календарь читают из одного
// кэша — без них не отрисуется ни одна колонка.

import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { injectCompaniesIdIntoInvokeFunctionRequest } from "../httpRequest";
import authStore from "../../store/auth.store";
import { handleUnauthorizedError } from "../unauthorizedHandler";
import type {
  TaskDirectories,
  TaskDirectoryItem,
  TaskDirectoryKind,
} from "../../modules/Tasks/types";

const REPORTS_BASE_URL = "https://api.admin.u-code.io";
const REPORTS_FUNCTION_PATH =
  "/v2/invoke_function/udevs-hrms-reports?project-id=9a462573-ce11-4288-928a-a6ba754b6998";

export const TASK_DIRECTORIES_KEY = ["task-directories"];

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

/** Общий вызов reports-шлюза — им же пользуется task.service.ts. */
export const invokeTasksMethod = async (
  method: string,
  data: Record<string, unknown> = {}
): Promise<Record<string, unknown> | null> => {
  const res = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
    data: { method, data },
  });
  return findGatewayResult(res.data, method);
};

const str = (value: unknown): string => (typeof value === "string" ? value : "");

const num = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const mapItem = (raw: unknown, index: number): TaskDirectoryItem | null => {
  if (!isRecord(raw) || !str(raw.id)) return null;

  return {
    id: str(raw.id),
    title: str(raw.title),
    color: str(raw.color),
    icon: str(raw.icon),
    isInitial: Boolean(raw.isInitial),
    isFinal: Boolean(raw.isFinal),
    isDefault: Boolean(raw.isDefault),
    sortOrder: num(raw.sortOrder, index),
  };
};

const mapList = (raw: unknown): TaskDirectoryItem[] =>
  Array.isArray(raw)
    ? raw
        .map(mapItem)
        .filter((item): item is TaskDirectoryItem => Boolean(item))
        .sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

export const EMPTY_DIRECTORIES: TaskDirectories = {
  statuses: [],
  priorities: [],
  types: [],
  tags: [],
  sheets: [],
};

const mapDirectories = (result: Record<string, unknown> | null): TaskDirectories => ({
  statuses: mapList(result?.statuses),
  priorities: mapList(result?.priorities),
  types: mapList(result?.types),
  tags: mapList(result?.tags),
  sheets: mapList(result?.sheets),
});

export type TaskDirectoryInput = {
  kind: TaskDirectoryKind;
  id?: string;
  title: string;
  color?: string;
  icon?: string;
  isInitial?: boolean;
  isFinal?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
};

export const taskDirectoriesService = {
  list: async (): Promise<TaskDirectories> =>
    mapDirectories(await invokeTasksMethod("task_directories_get")),

  save: async (input: TaskDirectoryInput): Promise<TaskDirectoryItem | null> => {
    const result = await invokeTasksMethod("task_directory_save", {
      kind: input.kind,
      guid: input.id,
      title: input.title,
      color: input.color,
      icon: input.icon,
      isInitial: input.isInitial,
      isFinal: input.isFinal,
      isDefault: input.isDefault,
      sortOrder: input.sortOrder,
    });
    return mapItem(result?.item, 0);
  },

  remove: async (kind: TaskDirectoryKind, id: string): Promise<string> => {
    await invokeTasksMethod("task_directory_delete", { kind, guid: id });
    return id;
  },
};

export const useTaskDirectoriesQuery = (querySettings: object = {}) =>
  useQuery({
    queryKey: TASK_DIRECTORIES_KEY,
    queryFn: taskDirectoriesService.list,
    staleTime: 5 * 60 * 1000,
    ...querySettings,
  });

export const useSaveTaskDirectory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TaskDirectoryInput) => taskDirectoriesService.save(input),
    // Флаги «по умолчанию» снимаются у соседей на сервере, поэтому точечное
    // обновление кэша тут не подойдёт — перечитываем справочники целиком.
    onSuccess: () => queryClient.invalidateQueries(TASK_DIRECTORIES_KEY),
  });
};

export const useDeleteTaskDirectory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ kind, id }: { kind: TaskDirectoryKind; id: string }) =>
      taskDirectoriesService.remove(kind, id),
    onSuccess: () => queryClient.invalidateQueries(TASK_DIRECTORIES_KEY),
  });
};
