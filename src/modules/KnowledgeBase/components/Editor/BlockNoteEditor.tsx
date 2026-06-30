// Notion-style block editor (BlockNote) for Knowledge Base articles.
//
// Adds a "Подстатья" item to the slash menu that creates a nested article and
// drops a clickable sub-page card (the custom pageLink block) at the cursor.

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import "./editor.css";

import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from "@blocknote/core";
import { ru } from "@blocknote/core/locales";
import {
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
  useCreateBlockNote,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { FileText } from "lucide-react";

import { kbSchema, type KbBlock } from "./schema";
import { useKbEditor, type KbEditorContextValue } from "./KbEditorContext";
import { uploadFileToCdn } from "../../../../api/services/file-upload.service";

type KbEditor = typeof kbSchema.BlockNoteEditor;

const subArticleItem = (
  editor: KbEditor,
  ctx: KbEditorContextValue
): DefaultReactSuggestionItem => ({
  title: "Подстатья",
  subtext: "Вложенная статья (страница внутри страницы)",
  group: "Страница",
  icon: <FileText size={18} />,
  onItemClick: () => {
    void (async () => {
      const child = await ctx.createSubArticle();
      insertOrUpdateBlockForSlashMenu(editor, {
        type: "pageLink",
        props: { articleId: child.id },
      });
    })();
  },
});

interface BlockNoteEditorProps {
  initialContent?: KbBlock[];
  editable?: boolean;
  onChange?: (content: KbBlock[]) => void;
}

export default function BlockNoteEditor({
  initialContent,
  editable = true,
  onChange,
}: BlockNoteEditorProps) {
  const ctx = useKbEditor();

  const editor = useCreateBlockNote({
    schema: kbSchema,
    dictionary: ru,
    initialContent: initialContent && initialContent.length ? initialContent : undefined,
    // Enables the "Загрузить" tab for image/file/video/audio blocks. BlockNote
    // calls this with the picked File and embeds the returned CDN URL.
    uploadFile: (file: File) => uploadFileToCdn(file, { folder: "knowledge-base" }),
  });

  return (
    <div className="kb-editor">
      <BlockNoteView
        editor={editor}
        editable={editable}
        theme="light"
        slashMenu={false}
        // Don't grab focus on mount — when the editor remounts on article
        // navigation, focusing scrolls itself into view and drags the whole
        // window (and the sticky tree) down.
        autoFocus={false}
        onChange={() => onChange?.(editor.document)}
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) =>
            filterSuggestionItems(
              [subArticleItem(editor, ctx), ...getDefaultReactSlashMenuItems(editor)],
              query
            )
          }
        />
      </BlockNoteView>
    </div>
  );
}
