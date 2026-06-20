// Context bridging the BlockNote editor and the Knowledge Base data/router.
//
// The custom "pageLink" block and the slash-menu item are rendered deep inside
// BlockNote, so they read these callbacks via context instead of props.

import { createContext, useContext } from "react";
import type { KbArticleSummary } from "../../types";

export interface KbEditorContextValue {
  /** Resolve a child article (for the sub-page card title/icon). */
  resolveArticle: (articleId: string) => KbArticleSummary | undefined;
  /** Navigate to an article (open a sub-page). */
  openArticle: (articleId: string) => void;
  /** Create a new sub-article under the current one; returns its id. */
  createSubArticle: () => Promise<{ id: string }>;
}

const KbEditorContext = createContext<KbEditorContextValue | null>(null);

export const KbEditorProvider = KbEditorContext.Provider;

export const useKbEditor = (): KbEditorContextValue => {
  const ctx = useContext(KbEditorContext);
  if (!ctx) throw new Error("useKbEditor must be used within KbEditorProvider");
  return ctx;
};
