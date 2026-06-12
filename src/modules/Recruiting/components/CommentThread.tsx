import { useState } from "react";
import { SendHorizonal } from "lucide-react";
import Avatar from "./Avatar";
import { formatDateTime, type StageComment } from "../types";

interface CommentThreadProps {
  comments: StageComment[];
  onAdd: (text: string) => Promise<void> | void;
  isSubmitting?: boolean;
}

/** Comment list + composer for one stage evaluation. */
export default function CommentThread({ comments, onAdd, isSubmitting = false }: CommentThreadProps) {
  const [text, setText] = useState("");

  const submit = async () => {
    const value = text.trim();
    if (!value || isSubmitting) return;
    await onAdd(value);
    setText("");
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
                    <span className="text-[13px] font-semibold text-gray-800">{comment.authorName}</span>
                    <span className="text-[11px] text-gray-400">{formatDateTime(comment.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-600">{comment.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="Добавить комментарий…"
          className="min-h-[42px] flex-1 resize-none rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 transition placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!text.trim() || isSubmitting}
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white transition hover:bg-brand-600 disabled:opacity-40"
          title="Отправить (Enter)"
        >
          <SendHorizonal size={17} />
        </button>
      </div>
    </div>
  );
}
