import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import RichTextEditor from "../../../../components/form/RichTextEditor";
import { isRichTextEmpty, sanitizeRichText } from "../../../../components/form/richText";

interface RichTextFieldProps {
  value: string;
  onSave: (html: string) => void;
  placeholder: string;
  minHeight?: number;
}

/**
 * Jira-style description: a rendered read view that turns into a full editor on
 * click and commits when focus leaves it. Toolbar clicks blur the contenteditable,
 * so the commit is keyed on focus leaving the whole wrapper, not the input.
 */
export default function RichTextField({
  value,
  onSave,
  placeholder,
  minHeight = 160,
}: RichTextFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [justSaved, setJustSaved] = useState(false);
  const savedTimer = useRef(0);
  const editorRef = useRef<HTMLDivElement>(null);
  // Mirrors `draft` so the outside-click listener never commits a stale value.
  const draftRef = useRef(value);
  const valueRef = useRef(value);
  valueRef.current = value;

  const updateDraft = (html: string) => {
    draftRef.current = html;
    setDraft(html);
  };

  // React does not honour autoFocus on a contenteditable — focus it by hand and
  // drop the caret at the end of the existing text.
  useEffect(() => {
    if (!isEditing) return;
    const editable = editorRef.current?.querySelector<HTMLElement>(".rsw-ce");
    if (!editable) return;
    editable.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editable);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) {
      draftRef.current = value;
      setDraft(value);
    }
  }, [value, isEditing]);

  useEffect(() => () => window.clearTimeout(savedTimer.current), []);

  const commit = () => {
    setIsEditing(false);
    const next = sanitizeRichText(draftRef.current);
    if (next === sanitizeRichText(valueRef.current)) return;
    onSave(isRichTextEmpty(next) ? "" : next);
    setJustSaved(true);
    window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setJustSaved(false), 1600);
  };

  const commitRef = useRef(commit);
  commitRef.current = commit;

  // A click on non-focusable space (a heading, the modal padding) never blurs a
  // contenteditable — without this the editor would sit there unsaved.
  useEffect(() => {
    if (!isEditing) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (editorRef.current?.contains(event.target as Node)) return;
      commitRef.current();
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isEditing]);


  if (!isEditing) {
    const html = sanitizeRichText(value);
    return (
      <div className="relative">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsEditing(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              setIsEditing(true);
            }
          }}
          className="-mx-2 cursor-text rounded-lg border border-transparent px-2 py-1.5 transition hover:border-gray-200 dark:hover:border-gray-700"
        >
          {isRichTextEmpty(html) ? (
            <p className="text-sm text-gray-400">{placeholder}</p>
          ) : (
            <div
              className="comment-body text-sm leading-relaxed text-gray-600 dark:text-gray-400"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
        {justSaved && (
          <span className="pointer-events-none absolute -top-5 right-0 inline-flex items-center gap-1 text-theme-xs text-success-600">
            <Check size={12} />
            Сохранено
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      ref={editorRef}
      className="-mx-1"
      onBlur={(event) => {
        // Ignore focus moving between the toolbar and the text area.
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        commit();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          draftRef.current = value;
          setDraft(value);
          setIsEditing(false);
        }
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          commit();
        }
      }}
    >
      <RichTextEditor
        value={draft}
        onChange={updateDraft}
        minHeight={minHeight}
        placeholder={placeholder}
      />
      <p className="mt-1.5 px-1 text-theme-xs text-gray-400">
        Сохраняется автоматически · ⌘+Enter — сохранить · Esc — отмена
      </p>
    </div>
  );
}
