import { useQuery, useMutation, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";

const productCategoryService = {
  getList: (params: any) => httpRequest.get('/v2/items/product_categories', { params }),
  get: (id: string) => httpRequest.get(`/v2/items/product_categories/${id}`),
  create: (data: any) => httpRequest.post('/v2/items/product_categories', { data }),
  update: (id: string, data: any) => httpRequest.put(`/v2/items/product_categories/${id}`, { data }),
  delete: (id: string) => httpRequest.delete('/v2/items/product_categories', { data: { ids: [id] } }),
}

export const useProductCategoriesQuery = ({ params, querySettings = {} }: { params?: any; querySettings?: any }) => {
  return useQuery({
    queryKey: ['PRODUCT_CATEGORIES', params],
    queryFn: () => productCategoryService.getList(params),
    ...querySettings,
  })
}

export const useProductCategoryQuery = ({ id, querySettings = {} }: { id: string; querySettings?: any }) => {
  return useQuery({
    queryKey: ['PRODUCT_CATEGORY', id],
    queryFn: () => productCategoryService.get(id),
    enabled: !!id,
    ...querySettings,
  })
}

export const useCreateProductCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => productCategoryService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['PRODUCT_CATEGORIES']);
    }
  })
}

export const useUpdateProductCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ guid, data }: { guid: string; data: any }) => productCategoryService.update(guid, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['PRODUCT_CATEGORIES']);
    }
  })
}

export const useDeleteProductCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => productCategoryService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['PRODUCT_CATEGORIES']);
    }
  })
}

export default productCategoryService;
