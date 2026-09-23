import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";
import encodeJsonToUrlParam from "../../utils/encodeJsonToUrlParam";
import { translate } from "../../i18n";

const NOTIFICATIONS_COLLECTION = "news";
const COMPANY_ID = "0de6b2b6-0777-4184-a620-aca70c294111";

export interface NotificationItem {
  guid: string;
  title: string;
  text: string;
  photo: string;
  published_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  companies_id?: string;
}

interface NotificationsListResponse {
  count: number;
  response: NotificationItem[];
}

type NotificationsQueryParams = {
  limit?: number;
  offset?: number;
  search?: string;
  is_active?: boolean;
};

type NotificationPayload = {
  title: string;
  text: string;
  photo?: string | null;
  is_active?: boolean;
  companies_id?: string;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const toBoolean = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return fallback;
};

const toStringValue = (value: unknown) => (typeof value === "string" ? value : "");

const normalizeNotification = (item: unknown): NotificationItem => {
  const source = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;

  const guidCandidate = source.guid ?? source.id;
  const guid = isNonEmptyString(guidCandidate) ? guidCandidate : "";

  const title = toStringValue(source.title).trim() || translate("notifications.fallback.no_title");
  const text =
    toStringValue(source.text).trim() ||
    toStringValue(source.description).trim() ||
    toStringValue(source.content).trim();
  const photo =
    toStringValue(source.photo).trim() ||
    toStringValue(source.image).trim() ||
    toStringValue(source.cover).trim();
  const publishedAt =
    toStringValue(source.published_at).trim() || toStringValue(source.created_at).trim();

  return {
    guid,
    title,
    text,
    photo,
    published_at: publishedAt,
    is_active: toBoolean(source.is_active, true),
    created_at: toStringValue(source.created_at),
    updated_at: toStringValue(source.updated_at),
    companies_id: toStringValue(source.companies_id),
  };
};

const normalizeListResponse = (response: unknown): NotificationsListResponse => {
  const source = (response && typeof response === "object" ? response : {}) as Record<string, unknown>;
  const rawItems = Array.isArray(source.response)
    ? source.response
    : Array.isArray(response)
      ? response
      : [];

  const items = rawItems.map(normalizeNotification).filter((item) => item.guid);
  const count = typeof source.count === "number" ? source.count : items.length;

  return { count, response: items };
};

const byPublishedDateDesc = (a: NotificationItem, b: NotificationItem) => {
  const aDate = a.published_at ? Date.parse(a.published_at) : 0;
  const bDate = b.published_at ? Date.parse(b.published_at) : 0;
  return bDate - aDate;
};

const notificationService = {
  getList: async (params: NotificationsQueryParams = {}): Promise<NotificationsListResponse> => {
    const payload = {
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
      ...(isNonEmptyString(params.search) ? { search: params.search.trim() } : {}),
      ...(typeof params.is_active === "boolean" ? { is_active: params.is_active } : {}),
    };

    const response = await httpRequest.get(`/v2/items/${NOTIFICATIONS_COLLECTION}`, {
      params: {
        data: encodeJsonToUrlParam(payload),
      },
    });

    const normalized = normalizeListResponse(response);
    const sorted = [...normalized.response].sort(byPublishedDateDesc);

    return {
      count: normalized.count,
      response: sorted,
    };
  },

  create: (data: NotificationPayload) =>
    httpRequest.post(`/v2/items/${NOTIFICATIONS_COLLECTION}`, {
      data: {
        companies_id: COMPANY_ID,
        ...data,
      },
    }),

  getByGuid: async (guid: string): Promise<NotificationItem | null> => {
    const response = await httpRequest.get(`/v2/items/${NOTIFICATIONS_COLLECTION}/${guid}`);
    const source = (response && typeof response === "object" ? response : {}) as Record<string, unknown>;
    const rawItem = source.response && typeof source.response === "object" ? source.response : source;
    const normalized = normalizeNotification(rawItem);
    return normalized.guid ? normalized : null;
  },

  update: (guid: string, data: NotificationPayload) =>
    httpRequest.put(`/v2/items/${NOTIFICATIONS_COLLECTION}/${guid}`, {
      data: {
        guid,
        ...data,
      },
    }),

  delete: async (guid: string) => {
    try {
      return await httpRequest.delete(`/v2/items/${NOTIFICATIONS_COLLECTION}`, {
        data: { ids: [guid] },
      });
    } catch {
      return httpRequest.delete(`/v2/items/${NOTIFICATIONS_COLLECTION}/${guid}`);
    }
  },
};

export const useNotificationsQuery = ({
  params,
  querySettings = {},
}: {
  params?: NotificationsQueryParams;
  querySettings?: Record<string, unknown>;
}) =>
  useQuery({
    queryKey: ["news", params],
    queryFn: () => notificationService.getList(params),
    ...querySettings,
  });

export const useNotificationItemQuery = ({
  guid,
  querySettings = {},
}: {
  guid?: string;
  querySettings?: Record<string, unknown>;
}) =>
  useQuery({
    queryKey: ["news-item", guid],
    queryFn: () => notificationService.getByGuid(String(guid)),
    enabled: Boolean(guid),
    ...querySettings,
  });

export const useCreateNotification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: NotificationPayload) => notificationService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["news"]);
    },
  });
};

export const useUpdateNotification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guid, data }: { guid: string; data: NotificationPayload }) =>
      notificationService.update(guid, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["news"]);
    },
  });
};

export const useDeleteNotification = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (guid: string) => notificationService.delete(guid),
    onSuccess: () => {
      queryClient.invalidateQueries(["news"]);
    },
  });
};

export default notificationService;
