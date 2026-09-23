// Knowledge Base data service.
//
// Hybrid backend (see AI guide + recruiting pattern):
//   • listArticles → custom reports method `get_knowledge_base_articles`
//     (light tree columns only, no `content` body — refetched on every autosave).
//   • get / create / update / delete → plain items API on `knowledge_base_articles`.
// Set KNOWLEDGE_USE_MOCK to fall back to the in-memory store.

import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";
import { COMPANY_ID } from "./settingsDirectory.service";
import { invokeRecruiting } from "./recruitingFunction";
import { KNOWLEDGE_USE_MOCK } from "../../modules/KnowledgeBase/mock/mockConfig";
import {
  mockCreateArticle,
  mockDeleteArticle,
  mockGetArticle,
  mockListArticles,
  mockUpdateArticle,
} from "../../modules/KnowledgeBase/mock/mockApi";
import type {
  ArticleContent,
  KbArticle,
  KbArticleDraft,
  KbArticleSummary,
  KbArticleUpdate,
} from "../../modules/KnowledgeBase/types";
import { translate } from "../../i18n";

const ARTICLES_SLUG = "knowledge_base_articles";
const LIST_METHOD = "get_knowledge_base_articles";
// u-code named the self-relation parent column this way; the backend list
// method aliases it to `parent_id`, but the items-API get/create/update paths
// use the real column name.
const PARENT_COLUMN = "knowledge_base_articles_id";

// ───── Raw row shape ─────

interface ArticleApiRow {
  guid: string;
  parent_id?: string | null;
  knowledge_base_articles_id?: string | null;
  title?: string | null;
  icon?: string | null;
  content?: unknown;
  position?: number | string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

interface ListResponse<T> {
  count: number;
  response: T[];
}

// Items API single-item GET wraps the row under `.response`; unwrap so the
// mappers always get the bare row (with guid).
const unwrapItem = <T>(res: unknown): T => {
  if (res && typeof res === "object" && !Array.isArray(res)) {
    const inner = (res as Record<string, unknown>).response;
    if (inner && typeof inner === "object" && !Array.isArray(inner)) return inner as T;
  }
  return res as T;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const toUuidOrNull = (value: string | null | undefined): string | null =>
  value && UUID_RE.test(value) ? value : null;

// ───── Mappers ─────

const parseContent = (value: unknown): ArticleContent => {
  if (Array.isArray(value)) return value as ArticleContent;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed as ArticleContent;
    } catch {
      // fall through
    }
  }
  return [];
};

// Parent comes back as `parent_id` from the list method, or as the raw
// relation column from the items API get.
const rowParentId = (row: ArticleApiRow): string | null =>
  row.parent_id ?? row.knowledge_base_articles_id ?? null;

const mapArticleSummary = (row: ArticleApiRow): KbArticleSummary => ({
  id: row.guid,
  parentArticleId: rowParentId(row),
  title: row.title || translate("common.untitled"),
  icon: row.icon || "📄",
  updatedAt: row.updated_at || row.created_at || "",
});

const mapArticle = (row: ArticleApiRow): KbArticle => ({
  ...mapArticleSummary(row),
  content: parseContent(row.content),
  author: "",
  createdAt: row.created_at || "",
});

// u-code stores JSON-ish fields as varchar (same as `vacancies.stages`), so the
// document must be serialized to a string on write; `parseContent` parses it back.
const serializeContent = (content: ArticleContent): string => JSON.stringify(content ?? []);

const articleDraftToPayload = (draft: KbArticleDraft): Record<string, unknown> => ({
  [PARENT_COLUMN]: toUuidOrNull(draft.parentArticleId),
  title: draft.title,
  icon: draft.icon,
  content: serializeContent([]),
});

const articleUpdateToPayload = (update: KbArticleUpdate): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  if (update.title !== undefined) payload.title = update.title;
  if (update.icon !== undefined) payload.icon = update.icon;
  if (update.content !== undefined) payload.content = serializeContent(update.content);
  return payload;
};

// ───── Service ─────

const knowledgeBaseService = {
  listArticles: async (): Promise<KbArticleSummary[]> => {
    if (KNOWLEDGE_USE_MOCK) {
      const res = (await mockListArticles()) as unknown as ListResponse<ArticleApiRow>;
      return res.response.map(mapArticleSummary);
    }
    const res = await invokeRecruiting<ListResponse<ArticleApiRow>>(LIST_METHOD);
    return (res.response ?? []).map(mapArticleSummary);
  },

  getArticle: async (guid: string): Promise<KbArticle | null> => {
    if (KNOWLEDGE_USE_MOCK) {
      const row = (await mockGetArticle(guid)) as ArticleApiRow | null;
      return row ? mapArticle(row) : null;
    }
    const res = await httpRequest.get(`/v2/items/${ARTICLES_SLUG}/${guid}`);
    const row = unwrapItem<ArticleApiRow | null>(res);
    return row && row.guid ? mapArticle(row) : null;
  },

  createArticle: async (draft: KbArticleDraft): Promise<{ guid: string }> => {
    if (KNOWLEDGE_USE_MOCK) {
      return (await mockCreateArticle(articleDraftToPayload(draft))) as { guid: string };
    }
    const res = await httpRequest.post(`/v2/items/${ARTICLES_SLUG}`, {
      data: { companies_id: COMPANY_ID, ...articleDraftToPayload(draft) },
    });
    const row = unwrapItem<{ guid: string }>(res);
    return { guid: row.guid };
  },

  updateArticle: (guid: string, update: KbArticleUpdate) => {
    if (KNOWLEDGE_USE_MOCK) {
      return mockUpdateArticle(guid, articleUpdateToPayload(update));
    }
    return httpRequest.put(`/v2/items/${ARTICLES_SLUG}/${guid}`, {
      data: { ...articleUpdateToPayload(update), guid },
    });
  },

  // Soft-delete the article together with its whole descendant subtree.
  // `descendantIds` is computed on the client from the already-loaded tree.
  deleteArticle: async (guid: string, descendantIds: string[] = []) => {
    if (KNOWLEDGE_USE_MOCK) return mockDeleteArticle(guid);
    const ids = [guid, ...descendantIds];
    return httpRequest.delete(`/v2/items/${ARTICLES_SLUG}`, { data: { ids } });
  },
};

export default knowledgeBaseService;

// ───── React Query hooks ─────

/** All article summaries — powers the nested tree and breadcrumbs. */
export const useKbArticlesQuery = () =>
  useQuery({
    queryKey: ["kb-articles"],
    queryFn: () => knowledgeBaseService.listArticles(),
  });

export const useKbArticleQuery = (guid: string | undefined) =>
  useQuery({
    queryKey: ["kb-article", guid],
    queryFn: () => knowledgeBaseService.getArticle(guid as string),
    enabled: Boolean(guid),
    // The autosave path keeps this cache authoritative (patchArticleCache); a
    // short window avoids a remount refetch racing an uncommitted save and
    // briefly restoring stale content.
    staleTime: 30_000,
  });

export const useCreateKbArticle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: KbArticleDraft) => knowledgeBaseService.createArticle(draft),
    onSuccess: () => queryClient.invalidateQueries(["kb-articles"]),
  });
};

export const useUpdateKbArticle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guid, update }: { guid: string; update: KbArticleUpdate }) =>
      knowledgeBaseService.updateArticle(guid, update),
    onSuccess: (_, { guid, update }) => {
      queryClient.invalidateQueries(["kb-article", guid]);
      // Content-only autosaves don't change the tree (title/icon do) — skip the
      // list refetch so every keystroke-save doesn't reload the whole sidebar.
      if (update.title !== undefined || update.icon !== undefined) {
        queryClient.invalidateQueries(["kb-articles"]);
      }
    },
  });
};

export const useDeleteKbArticle = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guid, descendantIds }: { guid: string; descendantIds?: string[] }) =>
      knowledgeBaseService.deleteArticle(guid, descendantIds),
    onSuccess: () => queryClient.invalidateQueries(["kb-articles"]),
  });
};
