import { useQuery, useMutation, useQueryClient } from "react-query";
import axios from "axios";
import authStore from "../../store/auth.store";
import httpRequest, { injectCompaniesIdIntoItemsRequest } from "../httpRequest";
import encodeJsonToUrlParam from "../../utils/encodeJsonToUrlParam";



const clientService = {
  getList: (params: any) => httpRequest.get('/v2/items/clients', { params }),
  getByGuid: (guid: string) => httpRequest.get(`/v2/items/clients/${guid}`),
  create: (data: any) => httpRequest.post('/v2/items/clients', { data }),
  update: (guid: string, data: any) => httpRequest.put(`/v2/items/clients/${guid}`, { data }),
  delete: (guid: string) => httpRequest.delete(`/v2/items/clients`, { data: { ids: [guid] } }),
}


export const useClientsQuery = ({ data, querySettings = {} }: { data: any; querySettings?: any }) => {
  return useQuery({
    queryKey: ['CLIENTS', data],
    queryFn: () => clientService.getList({ data: encodeJsonToUrlParam(data) }),
    ...querySettings,
  })
}

export const useClientQuery = ({ guid, querySettings = {} }: { guid: string; querySettings?: any }) => {
  return useQuery({
    queryKey: ['CLIENT', guid],
    queryFn: () => clientService.getByGuid(guid),
    enabled: !!guid,
    ...querySettings,
  })
}

export const useCreateClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => clientService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['CLIENTS']);
    },
  });
}

export const useUpdateClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guid, data }: { guid: string; data: any }) => clientService.update(guid, data),
    onSuccess: (_, variables: { guid: string; data: any }) => {
      queryClient.invalidateQueries(['CLIENTS']);
      queryClient.invalidateQueries(['CLIENT', variables.guid]);
    },
  });
}

export const useDeleteClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (guid: string) => clientService.delete(guid),
    onSuccess: () => {
      queryClient.invalidateQueries(['CLIENTS']);
    },
  });
}

// Get client cards
export const useClientCardsQuery = ({ data, querySettings = {} }: { data: any, querySettings: any }) => {
  return useQuery(
    ["client-cards", data],
    () => httpRequest.get(`/v2/items/clients_cards`, { params: { data: encodeJsonToUrlParam(data) } }),
    querySettings
  );
};

// Get client phone numbers
export const useClientPhoneNumbersQuery = ({ data, querySettings = {} }: { data: any, querySettings: any }) => {
  return useQuery(
    ["client-phone-numbers", data],
    () => httpRequest.get(`/v2/items/clients_phone_numbers`, { params: { data: encodeJsonToUrlParam(data) } }),
    querySettings
  );
};

// Get card reports
export const useCardReportsQuery = ({ data, querySettings = {} }: { data: any, querySettings?: any }) => {
  return useQuery({
    queryKey: ["card-reports", data],
    queryFn: () => httpRequest.get(`/v2/items/card_reports`, { params: { data: encodeJsonToUrlParam(data) } }),
    enabled: !!data?.clients_cards_id,
    ...querySettings,
  });
};

// Get INPS reports
export const useINPSReportsQuery = ({ data, querySettings = {} }: { data: any, querySettings?: any }) => {
  return useQuery({
    queryKey: ["inps-reports", data],
    queryFn: () => httpRequest.get(`/v2/items/inps_reports`, { params: { data: encodeJsonToUrlParam(data) } }),
    enabled: !!data?.clients_id,
    ...querySettings,
  });
};

// Get KATM reports
export const useKATMReportsQuery = ({ data, querySettings = {} }: { data: any, querySettings?: any }) => {
  return useQuery({
    queryKey: ["katm-reports", data],
    queryFn: () => httpRequest.get(`/v2/items/katm_reports`, { params: { data: encodeJsonToUrlParam(data) } }),
    enabled: !!data?.clients_id,
    ...querySettings,
  });
};

// Get scorings
export const useScoringsQuery = ({ data, querySettings = {} }: { data: any, querySettings?: any }) => {
  return useQuery({
    queryKey: ["scorings", data],
    queryFn: () => httpRequest.get(`/v2/items/scorings`, { params: { data: encodeJsonToUrlParam(data) } }),
    enabled: !!data?.clients_id,
    ...querySettings,
  });
};

export default clientService;

// ------------- Server Hooks for generic module List/Form -------------

const BASE_URL = "https://api.admin.u-code.io";
const PROJECT_ID = "84f1983d-5095-490e-ba9c-d2618b164c99";

const serverInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

serverInstance.interceptors.request.use((config) => {
  const token = authStore.token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return injectCompaniesIdIntoItemsRequest(config);
});

export interface ServerClient {
  guid: string;
  company_name: string;
  name: string;
  phone: string;
  manager: string;
  current_account: number;
  created_at: string;
  updated_at: string;
}

export const useServerClientsQuery = (params: { limit?: number; offset?: number; search?: string } = {}) => {
  return useQuery(["server-clients", params], async () => {
    const queryParams: Record<string, string> = { "project-id": PROJECT_ID };
    if (params.limit) queryParams["limit"] = String(params.limit);
    if (params.offset) queryParams["offset"] = String(params.offset);
    if (params.search) queryParams["search"] = params.search;

    const res = await serverInstance.get("/v2/items/clients", { params: queryParams });
    return res.data?.data?.data as { count: number; response: ServerClient[] };
  });
};

export const useServerClientQuery = (guid: string) => {
  return useQuery(["server-client", guid], async () => {
    const res = await serverInstance.get(`/v2/items/clients/${guid}`, {
      params: { "project-id": PROJECT_ID },
    });
    return res.data?.data?.data?.response as ServerClient;
  }, { enabled: !!guid });
};

export const useServerCreateClientMutation = () => {
  const qc = useQueryClient();

  return useMutation(
    async (data: Partial<ServerClient>) => {
      const res = await serverInstance.post("/v2/items/clients", { data }, {
        params: { "project-id": PROJECT_ID },
      });
      return res.data;
    },
    { onSuccess: () => qc.invalidateQueries("server-clients") }
  );
};

export const useServerUpdateClientMutation = () => {
  const qc = useQueryClient();

  return useMutation(
    async (data: Partial<ServerClient> & { guid: string }) => {
      const res = await serverInstance.put("/v2/items/clients", { data }, {
        params: { "project-id": PROJECT_ID },
      });
      return res.data;
    },
    {
      onSuccess: (_, variables) => {
        qc.invalidateQueries("server-clients");
        qc.invalidateQueries(["server-client", variables.guid]);
      },
    }
  );
};
