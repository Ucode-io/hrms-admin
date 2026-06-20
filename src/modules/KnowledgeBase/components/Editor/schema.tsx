// BlockNote schema extended with a custom "pageLink" block — the Notion-style
// "page inside a page". It stores only a child articleId; title/icon are
// resolved live from the data store so they stay in sync when renamed.

import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { ChevronRight } from "lucide-react";
import { useKbEditor } from "./KbEditorContext";

// createReactBlockSpec returns a factory `(options?) => BlockSpec` — call it
// to get the spec that BlockNoteSchema.create expects.
export const PageLinkBlock = createReactBlockSpec(
  {
    type: "pageLink",
    propSchema: {
      articleId: { default: "" },
    },
    content: "none",
  },
  {
    render: (props) => {
      const articleId = props.block.props.articleId;
      const ctx = useKbEditor();
      const article = articleId ? ctx.resolveArticle(articleId) : undefined;

      return (
        <div
          contentEditable={false}
          draggable={false}
          onClick={() => {
            if (articleId) ctx.openArticle(articleId);
          }}
          className="my-1 flex w-full cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm transition-colors hover:bg-gray-50"
        >
          <span className="text-base leading-none">{article?.icon ?? "📄"}</span>
          <span className="font-medium text-gray-800 underline decoration-gray-300 underline-offset-2">
            {article?.title ?? "Подстатья удалена"}
          </span>
          <ChevronRight size={15} className="ml-auto text-gray-400" />
        </div>
      );
    },
  }
);

export const kbSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    pageLink: PageLinkBlock(),
  },
});

export type KbBlock = typeof kbSchema.Block;
