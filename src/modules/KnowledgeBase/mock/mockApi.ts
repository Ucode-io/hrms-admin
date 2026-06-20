// Mock CRUD layer for the Knowledge Base module (replaces the items API while
// KNOWLEDGE_USE_MOCK is on). A single article tree, all functions async so the
// service layer stays transport-agnostic.

import { getDb, nextId, nowIso, saveDb } from "./mockDb";
import type { Row } from "./seed";

const ok = <T>(value: T): Promise<T> => Promise.resolve(value);
const fail = (message: string): Promise<never> => Promise.reject(new Error(message));

export const mockListArticles = () => {
  const rows = [...getDb().articles].sort((a, b) =>
    String(a.created_at).localeCompare(String(b.created_at))
  );
  return ok({ count: rows.length, response: rows });
};

export const mockGetArticle = (guid: string) =>
  ok(getDb().articles.find((a) => a.guid === guid) ?? null);

export const mockCreateArticle = (payload: Row) => {
  const db = getDb();
  const guid = nextId("art");
  const now = nowIso();
  db.articles = [
    ...db.articles,
    {
      guid,
      parent_id: null,
      icon: "📄",
      content: [],
      created_at: now,
      updated_at: now,
      ...payload,
    },
  ];
  saveDb();
  return ok({ guid });
};

export const mockUpdateArticle = (guid: string, payload: Row) => {
  const db = getDb();
  const current = db.articles.find((a) => a.guid === guid);
  if (!current) return fail("Статья не найдена");
  db.articles = db.articles.map((a) =>
    a.guid === guid ? { ...a, ...payload, guid, updated_at: nowIso() } : a
  );
  saveDb();
  return ok({ guid });
};

/** Delete an article and all of its descendants (nested sub-articles). */
export const mockDeleteArticle = (guid: string) => {
  const db = getDb();
  const toRemove = new Set<string>([guid]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const a of db.articles) {
      const parent = a.parent_id ? String(a.parent_id) : null;
      if (parent && toRemove.has(parent) && !toRemove.has(String(a.guid))) {
        toRemove.add(String(a.guid));
        grew = true;
      }
    }
  }
  db.articles = db.articles.filter((a) => !toRemove.has(String(a.guid)));
  saveDb();
  return ok({ guid, removed: [...toRemove] });
};
