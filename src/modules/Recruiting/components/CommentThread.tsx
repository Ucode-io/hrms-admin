import { useRef, useState } from "react";
import { Bold, Italic, Link as LinkIcon, List, Paperclip, SendHorizonal } from "lucide-react";
import DOMPurify from "dompurify";
import Editor, { Toolbar, createButton } from "react-simple-wysiwyg";
import { toast } from "sonner";
import Avatar from "./Avatar";
import {
  formatDateTime,
  formatFileSize,
  type CandidateDocument,
  type StageComment,
} from "../types";

// Демо-режим хранит файлы в localStorage — поэтому жёсткий лимит на размер.
const MAX_FILE_SIZE = 1.5 * 1024 * 1024;

// Комментарий-вложение хранит метаданные файла за этим маркером, сам файл
// живёт в блоке «Документы». Рендерится как чип со ссылкой на документ.
export const FILE_COMMENT_MARKER = "@@file@@";

export interface AttachedFile {
  name: string;
  size: number;
  dataUrl: string;
}

const ALLOWED_TAGS = ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "a"];

const sanitizeHtml = (value: string) =>
  DOMPurify.sanitize(value, { ALLOWED_TAGS, ALLOWED_ATTR: ["href", "target", "rel"] });

const htmlToPlainText = (value: string) => {
  const cleaned = DOMPurify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  return cleaned.replace(/\s+/g, " ").trim();
};

const toolbarBtnClass =
  "inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-gray-500 transition hover:border-gray-200 hover:bg-white hover:text-gray-700 data-[active=true]:border-brand-200 data-[active=true]:bg-brand-50 data-[active=true]:text-brand-600";

const BtnBold = createButton("Жирный", <Bold size={14} />, "bold");
const BtnItalic = createButton("Курсив", <Italic size={14} />, "italic");
const BtnBulletList = createButton("Список", <List size={14} />, "insertUnorderedList");
const BtnLink = createButton("Ссылка", <LinkIcon size={14} />, ({ $selection }) => {
  if ($selection?.nodeName === "A") {
    document.execCommand("unlink");
    return;
  }
  const url = window.prompt("Введите URL", "https://");
  if (!url) return;
  document.execCommand("createLink", false, url);
});

interface CommentThreadProps {
  comments: StageComment[];
  /** Документы кандидата — нужны, чтобы связать комментарий-вложение со ссылкой. */
  documents: CandidateDocument[];
  onAdd: (html: string) => Promise<void> | void;
  /** Загружает файл: добавляется и в документы, и в ленту комментариев. */
  onAttach?: (file: AttachedFile) => Promise<void> | void;
  isSubmitting?: boolean;
}

/** Comment list + minimal rich-text composer for one stage evaluation. */
export default function CommentThread({
  comments,
  documents,
  onAdd,
  onAttach,
  isSubmitting = false,
}: CommentThreadProps) {
  const [html, setHtml] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEmpty = !htmlToPlainText(html);

  const submit = async () => {
    if (isEmpty || isSubmitting) return;
    await onAdd(sanitizeHtml(html));
    setHtml("");
  };

  const handleFilePick = (picked: File | undefined) => {
    if (!picked || !onAttach) return;
    if (picked.size > MAX_FILE_SIZE) {
      toast.error("В демо-режиме файлы до 1.5 МБ.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      await onAttach({ name: picked.name, size: picked.size, dataUrl: String(reader.result) });
    };
    reader.readAsDataURL(picked);
  };

  return (
    <div className="space-y-3">
      {comments.length > 0 && (
        <ul className="space-y-3">
          {comments.map((comment) => {
            const [first = "", last = ""] = comment.authorName.split(" ");
            return (
              <li key={comment.id} className="flex gap-2.5">
                <Avatar firstName={last} lastName={first} size={30} />
                <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm bg-gray-50 px-3.5 py-2.5">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[13px] font-semibold text-gray-800">
                      {comment.authorName}
                    </span>
                    <span className="text-[11px] text-gray-400">
                      {formatDateTime(comment.createdAt)}
                    </span>
                  </div>
                  <CommentBody comment={comment} documents={documents} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <div
          className={`flex-1 overflow-hidden rounded-xl border bg-white transition ${
            isFocused ? "border-brand-400 ring-2 ring-brand-100" : "border-gray-200"
          }`}
          onFocusCapture={() => setIsFocused(true)}
          onBlurCapture={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
            setIsFocused(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit();
            }
          }}
        >
          <Editor
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            disabled={isSubmitting}
            containerProps={{ style: { border: 0, borderRadius: 0 } }}
            style={{ minHeight: 40, padding: "8px 12px", fontSize: "14px", color: "rgb(31 41 55)" }}
          >
            <Toolbar className="flex flex-wrap items-center gap-0.5 border-t border-gray-100 bg-gray-50/70 px-1.5 py-1">
              <BtnBold className={toolbarBtnClass} />
              <BtnItalic className={toolbarBtnClass} />
              <BtnBulletList className={toolbarBtnClass} />
              <BtnLink className={toolbarBtnClass} />
              {onAttach && (
                <>
                  <div className="mx-0.5 h-5 w-px bg-gray-200" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting}
                    title="Прикрепить файл"
                    className={toolbarBtnClass}
                  >
                    <Paperclip size={14} />
                  </button>
                </>
              )}
            </Toolbar>
          </Editor>
          {onAttach && (
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => {
                handleFilePick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          )}
        </div>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={isEmpty || isSubmitting}
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white transition hover:bg-brand-600 disabled:opacity-40"
          title="Отправить (Ctrl+Enter)"
        >
          <SendHorizonal size={17} />
        </button>
      </div>
    </div>
  );
}

/** Renders a comment body: file chip for attachments, sanitized HTML otherwise. */
function CommentBody({
  comment,
  documents,
}: {
  comment: StageComment;
  documents: CandidateDocument[];
}) {
  if (comment.text.startsWith(FILE_COMMENT_MARKER)) {
    let meta: { name: string; size: number | null } = { name: "Файл", size: null };
    try {
      meta = JSON.parse(comment.text.slice(FILE_COMMENT_MARKER.length));
    } catch {
      /* fall back to defaults */
    }
    const doc = documents.find((d) => d.name === meta.name);
    const inner = (
      <span className="inline-flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-gray-500">
          <Paperclip size={14} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-gray-800">{meta.name}</span>
          {meta.size ? (
            <span className="text-[11px] text-gray-400">{formatFileSize(meta.size)}</span>
          ) : null}
        </span>
      </span>
    );
    return (
      <div className="mt-1.5">
        {doc ? (
          <a
            href={doc.url}
            target="_blank"
            rel="noreferrer"
            {...(doc.url.startsWith("data:") ? { download: meta.name } : {})}
            className="inline-flex max-w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 transition hover:border-brand-300 hover:bg-white"
          >
            {inner}
          </a>
        ) : (
          <span className="inline-flex max-w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5">
            {inner}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className="comment-body mt-0.5 text-sm text-gray-600"
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(comment.text) }}
    />
  );
}
