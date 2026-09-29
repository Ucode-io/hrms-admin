// Late Permission (ADR-0015): заявки на опоздание. Пишет только reports —
// у админки на late_permissions только чтение, решение идёт через
// late_permission_review, который сам проверяет этапы согласования.

import { useMutation, useQuery, useQueryClient } from "react-query";
import { invoke } from "./approval.service";

export type LatePermissionStatus = "pending" | "approved" | "rejected" | "withdrawn";

export interface LatePermission {
  guid: string;
  user_base_id: string;
  date: string;
  arrive_by: string;
  reason: string;
  status: LatePermissionStatus;
  reject_reason: string | null;
  after_check_in: boolean;
  first_name: string | null;
  second_name: string | null;
  photo: string | null;
  departments_id: string | null;
  approval_processes_id: string | null;
  /** Начало дня по плану — уже с одобренным разрешением. */
  day_start: string | null;
}

export interface ReviewResult {
  recalculated: number | null;
  recalc_error: string | null;
}

export const LATE_PERMISSION_ENTITY_TYPE = "late_permission";
const QUERY_KEY = "late-permissions";

/** Код отказа сервера (`LATE_PERMISSION:day_closed`) или null. */
export const latePermissionErrorCode = (error: unknown): string | null => {
  const text = error instanceof Error ? error.message : JSON.stringify(error ?? "");
  return /LATE_PERMISSION:(\w+)/.exec(text)?.[1] ?? null;
};

export const useLatePermissionsQuery = (params: {
  dateFrom: string;
  dateTo: string;
  status?: string;
}) =>
  useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: async () => {
      const result = await invoke("late_permission_list", {
        date_from: params.dateFrom,
        date_to: params.dateTo,
        ...(params.status ? { status: params.status } : {}),
      });
      return (Array.isArray(result?.items) ? result.items : []) as LatePermission[];
    },
    keepPreviousData: true,
  });

export const useReviewLatePermission = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      guid: string;
      status: "approved" | "rejected";
      rejectReason?: string;
    }) =>
      ((await invoke("late_permission_review", {
        guid: input.guid,
        status: input.status,
        reject_reason: input.rejectReason ?? "",
      })) ?? {}) as unknown as ReviewResult,
    onSuccess: () => queryClient.invalidateQueries([QUERY_KEY]),
  });
};
