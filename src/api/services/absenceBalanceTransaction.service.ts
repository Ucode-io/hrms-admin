import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";
import encodeJsonToUrlParam from "../../utils/encodeJsonToUrlParam";
import { COMPANY_ID } from "./settingsDirectory.service";

const ABSENCE_BALANCE_TRANSACTIONS_COLLECTION = "absence_balance_transactions";

export interface AbsenceBalanceTransaction {
  guid: string;
  companies_id?: string;
  user_base_id: string;
  absence_policies_id?: string | null;
  absences_id?: string | null;
  amount?: number;
  transaction_type?: string | string[];
  type?: string | string[];
  date?: string | null;
  occurred_at?: string | null;
  created_at?: string;
  updated_at?: string;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
  [key: string]: unknown;
}

type AbsenceBalanceTransactionsFilterData = {
  user_base_id?: string;
  absence_policies_id?: string;
  limit?: number;
  offset?: number;
  [key: string]: unknown;
};

const absenceBalanceTransactionService = {
  getList: (data: AbsenceBalanceTransactionsFilterData) =>
    httpRequest.get(`/v2/items/${ABSENCE_BALANCE_TRANSACTIONS_COLLECTION}`, {
      params: { data: encodeJsonToUrlParam(data) },
    }),

  create: (data: Partial<AbsenceBalanceTransaction>) =>
    httpRequest.post(`/v2/items/${ABSENCE_BALANCE_TRANSACTIONS_COLLECTION}`, {
      data: {
        companies_id: COMPANY_ID,
        ...data,
      },
    }),
};

export const useAbsenceBalanceTransactionsQuery = ({
  data,
  querySettings = {},
}: {
  data: AbsenceBalanceTransactionsFilterData;
  querySettings?: Record<string, unknown>;
}) => {
  return useQuery({
    queryKey: ["absence-balance-transactions", data],
    queryFn: () => absenceBalanceTransactionService.getList(data),
    enabled: Boolean(data?.user_base_id),
    ...querySettings,
  });
};

export const useCreateAbsenceBalanceTransaction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<AbsenceBalanceTransaction>) => absenceBalanceTransactionService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["absence-balance-transactions"]);
    },
  });
};

export default absenceBalanceTransactionService;
