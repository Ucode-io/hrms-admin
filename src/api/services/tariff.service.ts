import { useQuery, useMutation, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";

const tariffService = {
  getList: (params: any) => httpRequest.get('/v2/items/tarrifs', { params }), // Note: 'tarrifs' as per user request
  get: (id: string) => httpRequest.get(`/v2/items/tarrifs/${id}`),
  create: (data: any) => httpRequest.post('/v2/items/tarrifs', { data }),
  update: (id: string, data: any) => httpRequest.put(`/v2/items/tarrifs/${id}`, { data }),
  delete: (id: string) => httpRequest.delete('/v2/items/tarrifs', { data: { ids: [id] } }),
}

export const useTariffsQuery = ({ params, querySettings = {} }: { params: any; querySettings?: any }) => {
  return useQuery({
    queryKey: ['TARIFFS', params],
    queryFn: () => tariffService.getList(params),
    ...querySettings,
  })
}

export const useTariffQuery = ({ id, querySettings = {} }: { id: string; querySettings?: any }) => {
  return useQuery({
    queryKey: ['TARIFF', id],
    queryFn: () => tariffService.get(id),
    enabled: !!id,
    ...querySettings,
  })
}

export const useCreateTariff = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => tariffService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['TARIFFS']);
    }
  })
}

export const useUpdateTariff = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ guid, data }: { guid: string; data: any }) => tariffService.update(guid, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['TARIFFS']);
    }
  })
}

export const useDeleteTariff = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tariffService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['TARIFFS']);
    }
  })
}

export default tariffService;
