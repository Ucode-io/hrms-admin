import { useQuery, useMutation, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";
import encodeJsonToUrlParam from "../../utils/encodeJsonToUrlParam";

// URLs
const CONTRACT_URL = '/v2/invoke_function/ayva-finance-ayva-finance?project-id=7cc1e0b8-47ed-4123-8ea1-1a592738aee9';
const APP_ID = 'P-9PT8lIid9wooLO3RqNwOpLYSdAZw8YV3';

// Interfaces for contract creation
interface ContactCreate {
  phone_number: string;
  full_name: string;
  relation_id: string;
}

interface ProductCreate {
  category_id: string;
  name: string;
  imei1: string;
  imei2: string;
  quantity: string;
  madeInKorea?: boolean;
  images: string[];
  price: string;
}

interface CreateContractData {
  clients_id?: string;
  client_phone_number?: string;
  merchants_id: string;
  payment_date: string;
  tariff_id: string;
  contacts: ContactCreate[];
  products: ProductCreate[];
}

interface CreateContractResponse {
  status: string;
  description: string;
  data: {
    status: string;
    data: {
      contract_guid: string;
      success: boolean;
    };
    attributes: unknown;
    server_error: string;
  };
  custom_message: string;
}

// Contract service with all methods
const contractService = {
  getList: (params: Record<string, unknown>) => httpRequest.get('/v2/items/contracts', { params }),
  get: (id: string) => httpRequest.get(`/v2/items/contracts/${id}`),
  delete: (id: string) => httpRequest.delete('/v2/items/contracts', { data: { ids: [id] } }),
  getPaymentSchedule: (data: { contracts_id: string }) => httpRequest.get('/v2/items/payment_schedule', {
    params: {
      data: encodeJsonToUrlParam(data)
    }
  }),
  getContractProducts: (params: Record<string, unknown>) => httpRequest.get('/v2/items/contract_products', { params }),
  getMerchantProducts: (params: Record<string, unknown>) => httpRequest.get('/v2/items/merchant_products', { params }),
  getMerchantProduct: (guid: string) => httpRequest.get(`/v2/items/merchant_products/${guid}`),
  createMerchantProduct: (data: any) => httpRequest.post('/v2/items/merchant_products', { data }),
  updateMerchantProduct: (guid: string, data: any) => httpRequest.put(`/v2/items/merchant_products/${guid}`, { data }),
  deleteMerchantProduct: (guid: string) => httpRequest.delete('/v2/items/merchant_products', { data: { ids: [guid] } }),
  getIkpuByProductName: (name: string) =>
    httpRequest.post('/v2/invoke_function/ayva-finance-ayva-finance', {
      data: {
        method: 'get_ikpu_by_product_name',
        object_data: { name },
      },
    }),
  create: (data: CreateContractData) =>
    httpRequest.post<CreateContractResponse>(CONTRACT_URL, {
      data: {
        method: 'contract_create',
        app_id: APP_ID,
        object_data: data,
      },
    }),
};

// Query hooks
export const useContractsQuery = ({ params, querySettings = {} }: { params: Record<string, unknown>; querySettings?: Record<string, unknown> }) => {
  return useQuery({
    queryKey: ['CONTRACTS', params],
    queryFn: () => contractService.getList(params),
    ...querySettings,
  });
};

export const useContractQuery = ({ id, querySettings = {} }: { id: string; querySettings?: Record<string, unknown> }) => {
  return useQuery({
    queryKey: ['CONTRACT', id],
    queryFn: () => contractService.get(id),
    enabled: !!id,
    ...querySettings,
  });
};

export const usePaymentScheduleQuery = ({ data, querySettings = {} }: { data: { contracts_id: string }; querySettings?: Record<string, unknown> }) => {
  return useQuery({
    queryKey: ['PAYMENT_SCHEDULE', data.contracts_id],
    queryFn: () => contractService.getPaymentSchedule(data),
    enabled: !!data.contracts_id,
    ...querySettings,
  });
};

export const useContractProductsQuery = ({ params, querySettings = {} }: { params: Record<string, unknown>; querySettings?: Record<string, unknown> }) => {
  return useQuery({
    queryKey: ['CONTRACT_PRODUCTS', params],
    queryFn: () => contractService.getContractProducts(params),
    ...querySettings,
  });
};

export const useMerchantProductsQuery = ({ params, querySettings = {} }: { params: Record<string, unknown>; querySettings?: Record<string, unknown> }) => {
  return useQuery({
    queryKey: ['MERCHANT_PRODUCTS', params],
    queryFn: () => contractService.getMerchantProducts(params),
    ...querySettings,
  });
};

export const useMerchantProductQuery = ({ guid, querySettings = {} }: { guid: string; querySettings?: Record<string, unknown> }) => {
  return useQuery({
    queryKey: ['MERCHANT_PRODUCT', guid],
    queryFn: () => contractService.getMerchantProduct(guid),
    enabled: !!guid,
    ...querySettings,
  });
};

export const useCreateMerchantProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => contractService.createMerchantProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['MERCHANT_PRODUCTS']);
    },
  });
};

export const useUpdateMerchantProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guid, data }: { guid: string; data: any }) => contractService.updateMerchantProduct(guid, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['MERCHANT_PRODUCTS']);
      queryClient.invalidateQueries(['MERCHANT_PRODUCT', variables.guid]);
    },
  });
};

export const useDeleteMerchantProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (guid: string) => contractService.deleteMerchantProduct(guid),
    onSuccess: () => {
      queryClient.invalidateQueries(['MERCHANT_PRODUCTS']);
    },
  });
};

// Mutation hooks
export const useCreateContract = () => {
  return useMutation({
    mutationFn: (data: CreateContractData) => contractService.create(data),
  });
};

export const useDeleteContract = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => contractService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['CONTRACTS']);
    }
  });
};

export default contractService;
