// Domain types for the Knowledge Base module.
//
// The module is a single tree of articles (Notion-like). Every article may have
// a parent article (nested "page inside a page"); top-level articles have
// parentArticleId === null. The body is stored as a BlockNote document.

import type { Block } from "@blocknote/core";

/** A BlockNote document. Kept loose so the data layer stays editor-agnostic. */
export type ArticleContent = Block[];

/** Lightweight article shape for trees, cards and breadcrumbs. */
export interface KbArticleSummary {
  id: string;
  parentArticleId: string | null;
  title: string;
  icon: string; // emoji
  updatedAt: string;
}

export interface KbArticle extends KbArticleSummary {
  content: ArticleContent;
  author: string;
  createdAt: string;
}

export interface KbArticleDraft {
  parentArticleId: string | null;
  title: string;
  icon: string;
}

export interface KbArticleUpdate {
  title?: string;
  icon?: string;
  content?: ArticleContent;
}

/** Build a tree of article summaries from a flat list (by parentArticleId). */
export interface KbArticleNode extends KbArticleSummary {
  children: KbArticleNode[];
}

export const buildArticleTree = (
  articles: KbArticleSummary[],
  parentId: string | null = null
): KbArticleNode[] =>
  articles
    .filter((a) => a.parentArticleId === parentId)
    .map((a) => ({ ...a, children: buildArticleTree(articles, a.id) }));

/** All descendant ids of an article (children, grandchildren, …) — for cascade delete. */
export const articleDescendantIds = (
  articles: KbArticleSummary[],
  articleId: string
): string[] => {
  const childrenByParent = new Map<string, string[]>();
  for (const a of articles) {
    if (!a.parentArticleId) continue;
    const list = childrenByParent.get(a.parentArticleId) ?? [];
    list.push(a.id);
    childrenByParent.set(a.parentArticleId, list);
  }
  const result: string[] = [];
  const stack = [...(childrenByParent.get(articleId) ?? [])];
  while (stack.length) {
    const id = stack.pop() as string;
    result.push(id);
    const children = childrenByParent.get(id);
    if (children) stack.push(...children);
  }
  return result;
};

/** Ancestor chain (root → … → article) for breadcrumbs and tree expansion. */
export const articleAncestors = (
  articles: KbArticleSummary[],
  articleId: string
): KbArticleSummary[] => {
  const byId = new Map(articles.map((a) => [a.id, a]));
  const chain: KbArticleSummary[] = [];
  let current = byId.get(articleId);
  while (current) {
    chain.unshift(current);
    current = current.parentArticleId ? byId.get(current.parentArticleId) : undefined;
  }
  return chain;
};
