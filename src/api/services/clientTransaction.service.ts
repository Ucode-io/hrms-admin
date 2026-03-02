import { useQuery } from "react-query";
import httpRequest from "../httpRequest";
import encodeJsonToUrlParam from "../../utils/encodeJsonToUrlParam";

const clientTransactionService = {
  getList: (params: any) => httpRequest.get('/v2/items/client_transactions', { params }),
  getByGuid: (guid: string) => httpRequest.get(`/v2/items/client_transactions/${guid}`),
}

export const useClientTransactionsQuery = ({ data, querySettings = {} }: { data: any; querySettings?: any }) => {
  return useQuery({
    queryKey: ['CLIENT_TRANSACTIONS', data],
    queryFn: () => httpRequest.get('/v2/items/client_transactions', { params: { data: encodeJsonToUrlParam(data) } }),
    ...querySettings,
  })
}

export const useClientTransactionQuery = ({ guid, querySettings = {} }: { guid: string; querySettings?: any }) => {
  return useQuery({
    queryKey: ['CLIENT_TRANSACTION', guid],
    queryFn: () => clientTransactionService.getByGuid(guid),
    enabled: !!guid,
    ...querySettings,
  })
}

export default clientTransactionService;
