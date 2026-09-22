// Article view — Notion-like page with a left article tree (the whole base),
// an emoji + multiline title header, and the BlockNote editor. Title/icon/content
// autosave (debounced). The "Подстатья" slash item and the "+" in the tree create
// nested articles (page inside a page).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useQueryClient } from "react-query";
import { ChevronRight, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../components/common/PageMeta";
import Button from "../../../components/ui/button/Button";
import { Modal } from "../../../components/ui/modal";
import { useHeaderBreadcrumbItems } from "../../../context/HeaderBreadcrumbContext";
import knowledgeBaseService, {
  useKbArticleQuery,
  useKbArticlesQuery,
} from "../../../api/services/knowledgeBase.service";
import {
  articleAncestors,
  articleDescendantIds,
  buildArticleTree,
  type ArticleContent,
  type KbArticle,
  type KbArticleSummary,
} from "../types";
import ArticleTree from "../components/ArticleTree";
import EmojiPicker from "../components/EmojiPicker";
import BlockNoteEditor from "../components/Editor/BlockNoteEditor";
import { KbEditorProvider } from "../components/Editor/KbEditorContext";
import type { KbBlock } from "../components/Editor/schema";
import { useTranslation } from "../../../i18n";

const formatDate = (iso: string) =>
  iso
    ? new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
    : "";

export default function KnowledgeBaseArticle() {
  const { t } = useTranslation();
  const { articleId } = useParams<{ articleId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: article, isLoading } = useKbArticleQuery(articleId);
  const { data: articles } = useKbArticlesQuery();

  // Local title/icon state mirrors the article; autosaved separately from body.
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("📄");
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const autosizeTitle = useCallback(() => {
    const el = titleRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    if (article) {
      setTitle(article.title);
      setIcon(article.icon);
    }
  }, [article?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Start each article at the top of the editor pane (the tree pane is fixed,
  // so this only moves the content column).
  useEffect(() => {
    if (!articleId) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [articleId]);

  // Re-fit the title height after it (re)populates or the window resizes.
  useEffect(() => {
    autosizeTitle();
  }, [title, autosizeTitle]);
  useEffect(() => {
    window.addEventListener("resize", autosizeTitle);
    return () => window.removeEventListener("resize", autosizeTitle);
  }, [autosizeTitle]);

  const invalidateArticles = useCallback(() => {
    queryClient.invalidateQueries(["kb-articles"]);
  }, [queryClient]);

  // Keep the cached article in sync with what we just saved, so navigating away
  // and back (React Query serves the cache) shows the latest title/icon/body
  // instead of a stale copy that only a later background refetch would replace.
  const patchArticleCache = useCallback(
    (patch: Partial<KbArticle>) => {
      if (!articleId) return;
      queryClient.setQueryData<KbArticle | null>(["kb-article", articleId], (old) =>
        old ? { ...old, ...patch } : old
      );
    },
    [articleId, queryClient]
  );

  // ── Autosave ──
  const saveMeta = useCallback(
    (next: { title?: string; icon?: string }) => {
      if (!articleId) return;
      patchArticleCache(next);
      void knowledgeBaseService.updateArticle(articleId, next).then(invalidateArticles);
    },
    [articleId, patchArticleCache, invalidateArticles]
  );

  const saveContent = useCallback(
    (content: KbBlock[]) => {
      if (!articleId) return;
      patchArticleCache({ content: content as unknown as ArticleContent });
      void knowledgeBaseService.updateArticle(articleId, { content });
    },
    [articleId, patchArticleCache]
  );

  // ── Editor bridge: resolve / open / create sub-article ──
  const resolveArticle = useCallback(
    (id: string): KbArticleSummary | undefined => articles?.find((a) => a.id === id),
    [articles]
  );

  const openArticle = useCallback(
    (id: string) => navigate(`/knowledge-base/articles/${id}`),
    [navigate]
  );

  const createSubArticle = useCallback(async () => {
    if (!articleId) throw new Error("Нет активной статьи");
    const res = await knowledgeBaseService.createArticle({
      parentArticleId: articleId,
      title: "Новая подстатья",
      icon: "📄",
    });
    invalidateArticles();
    return { id: res.guid };
  }, [articleId, invalidateArticles]);

  const editorCtx = useMemo(
    () => ({ resolveArticle, openArticle, createSubArticle }),
    [resolveArticle, openArticle, createSubArticle]
  );

  // ── Tree + breadcrumbs ──
  const tree = useMemo(() => buildArticleTree(articles ?? []), [articles]);
  const ancestors = useMemo(
    () => (articles && articleId ? articleAncestors(articles, articleId) : []),
    [articles, articleId]
  );
  const expandedIds = useMemo(() => new Set(ancestors.map((a) => a.id)), [ancestors]);

  // Full path (root → … → current) shown as a breadcrumb inside the page.
  const pageBreadcrumbs = useMemo(
    () =>
      ancestors.map((a) => ({
        label: a.title || "Без названия",
        to: `/knowledge-base/articles/${a.id}`,
        icon: a.icon,
      })),
    [ancestors]
  );

  // Keep the global header crumb minimal — the in-page breadcrumb carries the path.
  const headerBreadcrumbs = useMemo(
    () => [{ label: "База знаний", to: "/knowledge-base" }],
    []
  );
  useHeaderBreadcrumbItems(headerBreadcrumbs);

  // ── Delete (from the sidebar tree) with confirmation ──
  const [pendingDelete, setPendingDelete] = useState<KbArticleSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const requestRemove = useCallback(
    (id: string) => {
      const target = articles?.find((a) => a.id === id);
      if (target) setPendingDelete(target);
    },
    [articles]
  );

  const confirmRemove = useCallback(async () => {
    if (!pendingDelete) return;
    const removedId = pendingDelete.id;
    const parentId = pendingDelete.parentArticleId;
    // Deleting the active article or any of its ancestors removes the page we're on
    // (delete cascades to descendants), so navigate away to a surviving page.
    const affectsCurrent = ancestors.some((a) => a.id === removedId);
    const descendantIds = articles ? articleDescendantIds(articles, removedId) : [];
    setIsDeleting(true);
    try {
      await knowledgeBaseService.deleteArticle(removedId, descendantIds);
      invalidateArticles();
      setPendingDelete(null);
      if (affectsCurrent) {
        navigate(parentId ? `/knowledge-base/articles/${parentId}` : "/knowledge-base", {
          replace: true,
        });
      }
    } catch {
      toast.error("Не удалось удалить страницу");
    } finally {
      setIsDeleting(false);
    }
  }, [pendingDelete, ancestors, articles, invalidateArticles, navigate]);

  return (
    <>
      <PageMeta title={title || "Статья"} description="База знаний" />
      {/* Fixed-height two-pane shell. We cancel the layout wrapper's padding
          (-m-3/-m-4) and pin the height to the viewport minus the 64px header so
          the WINDOW never scrolls on this view — only the editor pane does. That
          keeps the tree pane physically fixed at the top: it can no longer be
          dragged down by editor focus/scroll on article navigation. */}
      <div className="-m-3 md:-m-4 flex h-[calc(100vh-4rem)] w-auto overflow-hidden bg-white">
        {/* Left article tree (whole base) */}
        <aside className="hidden h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-gray-100 bg-gray-50/50 px-2 pb-4 pt-5 lg:flex">
          <ArticleTree
            nodes={tree}
            activeId={articleId ?? ""}
            expandedIds={expandedIds}
            onOpen={openArticle}
            onRemove={requestRemove}
          />
        </aside>

        {/* Main editor area — the only scroll container of this view */}
        <div ref={scrollRef} className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-5 xl:px-8">
            {/* In-page breadcrumb — the full path to this article */}
            <nav
              aria-label="Хлебные крошки"
              className="mb-5 flex items-center gap-1 overflow-hidden px-6 text-sm text-gray-400"
            >
              {pageBreadcrumbs.map((crumb, index) => {
                const isLast = index === pageBreadcrumbs.length - 1;
                return (
                  <span
                    key={`${crumb.to}-${index}`}
                    className={`inline-flex min-w-0 items-center gap-1 ${isLast ? "shrink" : "shrink-0"}`}
                  >
                    {index > 0 && <ChevronRight size={14} className="shrink-0 text-gray-300" />}
                    <Link
                      to={crumb.to}
                      title={crumb.label}
                      className={`inline-flex min-w-0 items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-gray-100 ${
                        isLast ? "font-medium text-gray-700" : "hover:text-gray-600"
                      }`}
                      aria-current={isLast ? "page" : undefined}
                    >
                      <span className="shrink-0 leading-none">{crumb.icon}</span>
                      <span className={`truncate ${isLast ? "max-w-[320px]" : "max-w-[160px]"}`}>
                        {crumb.label}
                      </span>
                    </Link>
                  </span>
                );
              })}
            </nav>

            {/* Content column only: loader while the article body loads, the
                not-found state, or the actual header + editor. The tree pane and
                breadcrumb above stay mounted the whole time. */}
            {isLoading ? (
              <div className="px-6 pt-2">
                <div className="h-16 w-16 animate-pulse rounded-2xl bg-gray-100" />
                <div className="mt-4 h-10 w-2/3 animate-pulse rounded bg-gray-100" />
                <div className="mt-8 space-y-3">
                  <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
                  <div className="h-4 w-11/12 animate-pulse rounded bg-gray-100" />
                  <div className="h-4 w-4/6 animate-pulse rounded bg-gray-100" />
                </div>
              </div>
            ) : !article ? (
              <div className="px-6 py-16 text-center text-gray-500">
                Статья не найдена.
                <button
                  onClick={() => navigate("/knowledge-base")}
                  className="ml-2 text-brand-600 hover:underline"
                >
                  К базе знаний
                </button>
              </div>
            ) : (
              <>
                {/* Header — aligned to BlockNote's text gutter */}
                <div className="px-6">
                  <EmojiPicker
                    value={icon}
                    size="text-6xl"
                    onChange={(next) => {
                      setIcon(next);
                      saveMeta({ icon: next });
                    }}
                  />
                  <textarea
                    ref={titleRef}
                    value={title}
                    rows={1}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      saveMeta({ title: e.target.value });
                    }}
                    placeholder="Без названия"
                    className="mt-2 w-full resize-none overflow-hidden border-none bg-transparent text-[40px] font-bold leading-tight text-gray-900 placeholder-gray-300 focus:outline-none"
                  />
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                    <span>Обновлено {formatDate(article.updatedAt)}</span>
                  </div>
                  <div className="mt-5 border-t border-gray-100" />
                </div>

                <KbEditorProvider value={editorCtx}>
                  <BlockNoteEditor
                    key={article.id}
                    initialContent={article.content as KbBlock[]}
                    onChange={saveContent}
                  />
                </KbEditorProvider>
              </>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={pendingDelete !== null}
        onClose={() => !isDeleting && setPendingDelete(null)}
        showCloseButton={false}
        className="mx-4 w-full max-w-[360px] overflow-hidden rounded-2xl border border-gray-200 p-0 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="text-base font-semibold text-gray-900">Удалить страницу</h3>
          <button
            type="button"
            onClick={() => !isDeleting && setPendingDelete(null)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Закрыть"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4 text-center">
          <p className="text-sm text-gray-700">
            Вы уверены, что хотите удалить{" "}
            <span className="font-medium">
              «{pendingDelete?.title || "Без названия"}»
            </span>
            ?
          </p>
          <p className="text-xs text-error-600">
            Вложенные подстраницы также будут удалены. Это действие необратимо.
          </p>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={isDeleting}
              className="w-full justify-center px-3 py-2 text-sm"
            >
              Отмена
            </Button>
            <Button
              onClick={confirmRemove}
              disabled={isDeleting}
              className="w-full justify-center bg-error-600 px-3 py-2 text-sm hover:bg-error-700"
            >
              {isDeleting ? "Удаление..." : "Удалить"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
