import { useQuery } from "react-query";
import httpRequest from "../httpRequest";

const debtService = {
  getList: (params: any) => httpRequest.get('/v2/items/debts', { params }),
  getByGuid: (guid: string) => httpRequest.get(`/v2/items/debts/${guid}`),
}

export const useDebtsQuery = ({ params, querySettings = {} }: { params: any; querySettings?: any }) => {
  return useQuery({
    queryKey: ['DEBTS', params],
    queryFn: () => debtService.getList(params),
    ...querySettings,
  })
}

export const useDebtQuery = ({ guid, querySettings = {} }: { guid: string; querySettings?: any }) => {
  return useQuery({
    queryKey: ['DEBT', guid],
    queryFn: () => debtService.getByGuid(guid),
    enabled: !!guid,
    ...querySettings,
  })
}

export default debtService;
