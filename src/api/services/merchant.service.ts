import { useQuery, useMutation, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";



const merchantService = {
  getList: (params: any) => httpRequest.get('/v2/items/merchants', { params }),
  getByGuid: (guid: string) => httpRequest.get(`/v2/items/merchants/${guid}`),
  create: (data: any) => httpRequest.post('/v2/items/merchants', { data }),
  update: (guid: string, data: any) => httpRequest.put(`/v2/items/merchants/${guid}`, { data }),
  delete: (guid: string) => httpRequest.delete(`/v2/items/merchants`, { data: { ids: [guid] } }),
}


export const useMerchantsQuery = ({ params, querySettings = {} }: { params: any; querySettings?: any }) => {
  return useQuery({
    queryKey: ['MERCHANTS', params],
    queryFn: () => merchantService.getList(params),
    ...querySettings,
  })
}

export const useMerchantQuery = ({ guid, querySettings = {} }: { guid: string; querySettings?: any }) => {
  return useQuery({
    queryKey: ['MERCHANT', guid],
    queryFn: () => merchantService.getByGuid(guid),
    enabled: !!guid,
    ...querySettings,
  })
}

export const useCreateMerchant = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => merchantService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['MERCHANTS']);
    },
  });
}

export const useUpdateMerchant = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guid, data }: { guid: string; data: any }) => merchantService.update(guid, data),
    onSuccess: (_, variables: { guid: string; data: any }) => {
      queryClient.invalidateQueries(['MERCHANTS']);
      queryClient.invalidateQueries(['MERCHANT', variables.guid]);
    },
  });
}

export const useDeleteMerchant = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (guid: string) => merchantService.delete(guid),
    onSuccess: () => {
      queryClient.invalidateQueries(['MERCHANTS']);
    },
  });
}

export default merchantService;