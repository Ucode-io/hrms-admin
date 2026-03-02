import { useQuery, useMutation, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";

const merchantTransactionService = {
  getList: (params: any) => httpRequest.get('/v2/items/merchant_transactions', { params }),
  getByGuid: (guid: string) => httpRequest.get(`/v2/items/merchant_transactions/${guid}`),
  create: (data: any) => httpRequest.post('/v2/items/merchant_transactions', data),
  update: (guid: string, data: any) => httpRequest.patch(`/v2/items/merchant_transactions/${guid}`, data),
  delete: (guid: string) => httpRequest.delete(`/v2/items/merchant_transactions/${guid}`),
}

export const useMerchantTransactionsQuery = ({ params, querySettings = {} }: { params: any; querySettings?: any }) => {
  return useQuery({
    queryKey: ['MERCHANT_TRANSACTIONS', params],
    queryFn: () => merchantTransactionService.getList(params),
    ...querySettings,
  })
}

export const useMerchantTransactionQuery = ({ guid, querySettings = {} }: { guid: string; querySettings?: any }) => {
  return useQuery({
    queryKey: ['MERCHANT_TRANSACTION', guid],
    queryFn: () => merchantTransactionService.getByGuid(guid),
    enabled: !!guid,
    ...querySettings,
  })
}

export const useCreateMerchantTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => merchantTransactionService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['MERCHANT_TRANSACTIONS']);
    },
  });
};

export const useUpdateMerchantTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guid, data }: { guid: string; data: any }) => merchantTransactionService.update(guid, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['MERCHANT_TRANSACTIONS']);
      queryClient.invalidateQueries(['MERCHANT_TRANSACTION']);
    },
  });
};

export const useDeleteMerchantTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (guid: string) => merchantTransactionService.delete(guid),
    onSuccess: () => {
      queryClient.invalidateQueries(['MERCHANT_TRANSACTIONS']);
    },
  });
};

export default merchantTransactionService;
