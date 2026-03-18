import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";
import encodeJsonToUrlParam from "../../utils/encodeJsonToUrlParam";
import { COMPANY_ID } from "./settingsDirectory.service";

const ABSENCES_COLLECTION = "absences";

export type AbsenceRequestStatus = "pending" | "approved" | "rejected";

export interface Absence {
  guid: string;
  companies_id?: string;
  user_base_id: string;
  absence_policies_id: string;
  absence_policies_id_data?: {
    guid?: string;
    title?: string;
    icon?: string;
    color?: string;
    [key: string]: unknown;
  } | null;
  date_from: string;
  date_to: string;
  requested_days?: number;
  requested_breakdown?:
    | Array<{
        date: string;
        value: number;
      }>
    | string;
  note?: string | null;
  attachments?: string[] | string;
  status?: string | string[];
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  reject_reason?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

type AbsenceRequestsFilterData = {
  user_base_id?: string;
  absence_policies_id?: string;
  status?: string | string[];
  limit?: number;
  offset?: number;
  [key: string]: unknown;
};

const absenceService = {
  getList: (data: AbsenceRequestsFilterData) =>
    httpRequest.get(`/v2/items/${ABSENCES_COLLECTION}`, {
      params: { data: encodeJsonToUrlParam(data) },
    }),

  create: (data: Partial<Absence>) =>
    httpRequest.post(`/v2/items/${ABSENCES_COLLECTION}`, {
      data: {
        companies_id: COMPANY_ID,
        ...data,
      },
    }),

  update: async (guid: string, data: Partial<Absence>) => {
    const payload = {
      ...data,
      guid,
    };

    try {
      return await httpRequest.put(`/v2/items/${ABSENCES_COLLECTION}/${guid}`, {
        data: payload,
      });
    } catch {
      // Fallback for APIs expecting ids-based update on collection endpoint
      return httpRequest.put(`/v2/items/${ABSENCES_COLLECTION}`, {
        data: {
          ids: [guid],
          ...payload,
        },
      });
    }
  },
};

export const useAbsencesQuery = ({
  data,
  querySettings = {},
}: {
  data: AbsenceRequestsFilterData;
  querySettings?: Record<string, unknown>;
}) => {
  return useQuery({
    queryKey: ["absences", data],
    queryFn: () => absenceService.getList(data),
    enabled: Boolean(data?.user_base_id),
    ...querySettings,
  });
};

export const useCreateAbsence = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Absence>) => absenceService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["absences"]);
    },
  });
};

export const useUpdateAbsence = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      guid,
      data,
    }: {
      guid: string;
      data: Partial<Absence>;
    }) => absenceService.update(guid, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["absences"]);
    },
  });
};

// Backward-compatible aliases for old imports
export type AbsenceRequest = Absence;
export const useAbsenceRequestsQuery = useAbsencesQuery;
export const useCreateAbsenceRequest = useCreateAbsence;
export const useUpdateAbsenceRequest = useUpdateAbsence;

export default absenceService;
