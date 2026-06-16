import { useState } from "react";
import { Bold, Heading, Italic, Link as LinkIcon, List, ListOrdered, Underline } from "lucide-react";
import DOMPurify from "dompurify";
import Editor, { Toolbar, createButton } from "react-simple-wysiwyg";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "a",
  "h1",
  "h2",
  "h3",
];

export const sanitizeRichText = (value: string) =>
  DOMPurify.sanitize(value, { ALLOWED_TAGS, ALLOWED_ATTR: ["href", "target", "rel"] });

export const richTextToPlain = (value: string) =>
  DOMPurify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).replace(/\s+/g, " ").trim();

const btnCls =
  "inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-gray-500 transition hover:border-gray-200 hover:bg-white hover:text-gray-700 data-[active=true]:border-brand-200 data-[active=true]:bg-brand-50 data-[active=true]:text-brand-600";

const BtnBold = createButton("Жирный", <Bold size={15} />, "bold");
const BtnItalic = createButton("Курсив", <Italic size={15} />, "italic");
const BtnUnderline = createButton("Подчёркнутый", <Underline size={15} />, "underline");
const BtnHeading = createButton("Заголовок", <Heading size={15} />, ({ $selection }) => {
  const isHeading = $selection?.nodeName === "H3" || $selection?.parentElement?.nodeName === "H3";
  document.execCommand("formatBlock", false, isHeading ? "<p>" : "<h3>");
});
const BtnOrderedList = createButton("Нумерованный список", <ListOrdered size={15} />, "insertOrderedList");
const BtnBulletList = createButton("Маркированный список", <List size={15} />, "insertUnorderedList");
const BtnLink = createButton("Ссылка", <LinkIcon size={15} />, ({ $selection }) => {
  if ($selection?.nodeName === "A") {
    document.execCommand("unlink");
    return;
  }
  const url = window.prompt("Введите URL", "https://");
  if (!url) return;
  document.execCommand("createLink", false, url);
});

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  minHeight?: number;
}

/** Minimal block-level rich-text editor (react-simple-wysiwyg + DOMPurify). */
export default function RichTextEditor({
  value,
  onChange,
  disabled = false,
  minHeight = 220,
}: RichTextEditorProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-white transition ${
        isFocused ? "border-brand-400 ring-2 ring-brand-100" : "border-gray-200"
      }`}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setIsFocused(false);
      }}
    >
      <Editor
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        containerProps={{ style: { border: 0, borderRadius: 0 } }}
        style={{ minHeight, padding: "12px 14px", fontSize: "14px", color: "rgb(31 41 55)" }}
      >
        <Toolbar className="flex flex-wrap items-center gap-0.5 border-b border-gray-100 bg-gray-50/70 px-2 py-1.5">
          <BtnBold className={btnCls} />
          <BtnItalic className={btnCls} />
          <BtnUnderline className={btnCls} />
          <div className="mx-1 h-5 w-px bg-gray-200" />
          <BtnHeading className={btnCls} />
          <BtnBulletList className={btnCls} />
          <BtnOrderedList className={btnCls} />
          <div className="mx-1 h-5 w-px bg-gray-200" />
          <BtnLink className={btnCls} />
        </Toolbar>
      </Editor>
    </div>
  );
}
