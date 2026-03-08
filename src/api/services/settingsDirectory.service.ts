import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";

export const COMPANY_ID = "0de6b2b6-0777-4184-a620-aca70c294111";

export interface SettingsDirectoryItem {
  guid: string;
  title: string;
  description?: string;
  file?: string;
  companies_id: string;
  created_at: string;
  updated_at: string;
  duration?: number;
  [key: string]: unknown;
}

export interface SettingsDirectoryListResponse {
  count: number;
  response: SettingsDirectoryItem[];
}

export interface SettingsDirectoryListParams {
  limit?: number;
  offset?: number;
  search?: string;
}

const settingsDirectoryService = {
  getList: async (
    slug: string,
    params?: SettingsDirectoryListParams
  ): Promise<SettingsDirectoryListResponse> => {
    const res = await httpRequest.get(`/v2/items/${slug}`, { params });

    return {
      count: Number(res?.count || 0),
      response: Array.isArray(res?.response)
        ? (res.response as SettingsDirectoryItem[])
        : [],
    };
  },

  create: (
    slug: string,
    data: { title: string; companies_id?: string; [key: string]: unknown }
  ) =>
    httpRequest.post(`/v2/items/${slug}`, {
      data: {
        companies_id: COMPANY_ID,
        ...data,
      },
    }),

  getByGuid: async (
    slug: string,
    guid: string
  ): Promise<SettingsDirectoryItem | null> => {
    const res = await httpRequest.get(`/v2/items/${slug}/${guid}`);
    if (res?.response && typeof res.response === "object") {
      return res.response as SettingsDirectoryItem;
    }
    if (res && typeof res === "object" && "guid" in res) {
      return res as SettingsDirectoryItem;
    }
    return null;
  },

  update: (slug: string, guid: string, data: Partial<SettingsDirectoryItem>) =>
    httpRequest.put(`/v2/items/${slug}/${guid}`, { data }),

  delete: async (slug: string, guid: string) => {
    try {
      return await httpRequest.delete(`/v2/items/${slug}`, {
        data: { ids: [guid] },
      });
    } catch {
      return httpRequest.delete(`/v2/items/${slug}/${guid}`);
    }
  },
};

export const useSettingsDirectoryQuery = ({
  slug,
  params,
  querySettings = {},
}: {
  slug: string;
  params?: SettingsDirectoryListParams;
  querySettings?: any;
}) => {
  return useQuery({
    queryKey: ["SETTINGS_DIRECTORY", slug, params],
    queryFn: () => settingsDirectoryService.getList(slug, params),
    ...querySettings,
  });
};

export const useCreateSettingsDirectoryItem = (slug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { title: string; companies_id?: string; [key: string]: unknown }) =>
      settingsDirectoryService.create(slug, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["SETTINGS_DIRECTORY", slug]);
    },
  });
};

export const useSettingsDirectoryItemQuery = ({
  slug,
  guid,
  querySettings = {},
}: {
  slug: string;
  guid: string;
  querySettings?: any;
}) => {
  return useQuery({
    queryKey: ["SETTINGS_DIRECTORY_ITEM", slug, guid],
    queryFn: () => settingsDirectoryService.getByGuid(slug, guid),
    enabled: Boolean(slug && guid),
    ...querySettings,
  });
};

export const useUpdateSettingsDirectoryItem = (slug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      guid,
      data,
    }: {
      guid: string;
      data: Partial<SettingsDirectoryItem>;
    }) => settingsDirectoryService.update(slug, guid, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["SETTINGS_DIRECTORY", slug]);
    },
  });
};

export const useDeleteSettingsDirectoryItem = (slug: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (guid: string) => settingsDirectoryService.delete(slug, guid),
    onSuccess: () => {
      queryClient.invalidateQueries(["SETTINGS_DIRECTORY", slug]);
    },
  });
};

export default settingsDirectoryService;
