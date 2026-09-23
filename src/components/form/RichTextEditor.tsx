import { useRef, useState } from "react";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  RemoveFormatting,
  Strikethrough,
  Underline,
} from "lucide-react";
import { toast } from "sonner";
import Editor, {
  Toolbar,
  createButton,
  useEditorState,
  type EditorState,
} from "react-simple-wysiwyg";
import { useTranslation, translate } from "../../i18n";

const btnCls =
  "inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-gray-500 transition hover:border-gray-200 hover:bg-white hover:text-gray-700 data-[active=true]:border-brand-200 data-[active=true]:bg-brand-50 data-[active=true]:text-brand-600";

/**
 * Inline images are stored as data URLs, so they travel with the document —
 * fine for a screenshot, not for a 5 MP photo.
 */
export const MAX_INLINE_IMAGE_SIZE = 1.5 * 1024 * 1024;

const readImage = (file: File): Promise<string | null> =>
  new Promise((resolve) => {
    if (!file.type.startsWith("image/")) {
      toast.error(translate("rich_text.not_image", { name: file.name }));
      resolve(null);
      return;
    }
    if (file.size > MAX_INLINE_IMAGE_SIZE) {
      toast.error(translate("rich_text.image_too_large", { name: file.name }));
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => {
      toast.error(translate("rich_text.read_error", { name: file.name }));
      resolve(null);
    };
    reader.readAsDataURL(file);
  });

/** Inserts images at the caret; execCommand emits `input`, so onChange follows. */
const insertImages = async (editable: HTMLElement | undefined, files: File[]) => {
  if (!editable || files.length === 0) return;
  editable.focus();
  for (const file of files) {
    const dataUrl = await readImage(file);
    if (!dataUrl) continue;
    document.execCommand("insertImage", false, dataUrl);
  }
};

/** Toggles a block tag on the current selection, back to <p> when already set. */
const blockToggle =
  (tag: string) =>
  ({ $selection }: EditorState) => {
    // $selection can be a text node, so walk up to the nearest element first.
    const element =
      $selection instanceof Element ? $selection : ($selection?.parentElement ?? null);
    const isActive = Boolean(element?.closest(tag));
    document.execCommand("formatBlock", false, isActive ? "<p>" : `<${tag}>`);
  };

// Подписи здесь — только displayName: title переводится в месте использования.
const BtnBold = createButton("Bold", <Bold size={15} />, "bold");
const BtnItalic = createButton("Italic", <Italic size={15} />, "italic");
const BtnUnderline = createButton("Underline", <Underline size={15} />, "underline");
const BtnStrike = createButton("Strikethrough", <Strikethrough size={15} />, "strikeThrough");
const BtnHeading1 = createButton("Heading 1", <Heading1 size={15} />, blockToggle("h2"));
const BtnHeading2 = createButton("Heading 2", <Heading2 size={15} />, blockToggle("h3"));
const BtnQuote = createButton("Quote", <Quote size={15} />, blockToggle("blockquote"));
const BtnCode = createButton("Code block", <Code size={15} />, blockToggle("pre"));
const BtnClear = createButton(
  "Clear formatting",
  <RemoveFormatting size={15} />,
  "removeFormat"
);
const BtnOrderedList = createButton(
  "Numbered list",
  <ListOrdered size={15} />,
  "insertOrderedList"
);
const BtnBulletList = createButton(
  "Bulleted list",
  <List size={15} />,
  "insertUnorderedList"
);
const BtnLink = createButton("Link", <LinkIcon size={15} />, ({ $selection }) => {
  if ($selection?.nodeName === "A") {
    document.execCommand("unlink");
    return;
  }
  const url = window.prompt(translate("rich_text.enter_url"), "https://");
  if (!url) return;
  document.execCommand("createLink", false, url);
});

/** File-picker button — createButton only wires execCommand-style actions. */
function BtnImage({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { $el } = useEditorState();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        title={t("rich_text.image")}
        tabIndex={-1}
        // Keep the caret where it is — the picker must not steal the selection.
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className={className}
      >
        <ImagePlus size={15} />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          void insertImages($el, Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
    </>
  );
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  minHeight?: number;
  placeholder?: string;
  className?: string;
}

/** Minimal block-level rich-text editor (react-simple-wysiwyg + DOMPurify). */
export default function RichTextEditor({
  value,
  onChange,
  disabled = false,
  minHeight = 220,
  placeholder,
  className = "",
}: RichTextEditorProps) {
  const { t } = useTranslation();
  const [isFocused, setIsFocused] = useState(false);
  const [isDropping, setIsDropping] = useState(false);

  const imagesFrom = (list: FileList | null | undefined) =>
    Array.from(list ?? []).filter((file) => file.type.startsWith("image/"));

  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-white transition ${
        isFocused ? "border-brand-400 ring-2 ring-brand-100" : "border-gray-200"
      } ${className}`}
      onFocusCapture={() => setIsFocused(true)}
      onBlurCapture={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setIsFocused(false);
      }}
      // Pasting or dropping a screenshot is how images usually arrive.
      onPaste={(event) => {
        const files = imagesFrom(event.clipboardData?.files);
        if (files.length === 0) return;
        event.preventDefault();
        void insertImages(event.currentTarget.querySelector<HTMLElement>(".rsw-ce") ?? undefined, files);
      }}
      onDragOver={(event) => {
        if (imagesFrom(event.dataTransfer?.files).length === 0) return;
        event.preventDefault();
        setIsDropping(true);
      }}
      onDragLeave={() => setIsDropping(false)}
      onDrop={(event) => {
        const files = imagesFrom(event.dataTransfer?.files);
        setIsDropping(false);
        if (files.length === 0) return;
        event.preventDefault();
        void insertImages(event.currentTarget.querySelector<HTMLElement>(".rsw-ce") ?? undefined, files);
      }}
    >
      <Editor
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        containerProps={{ style: { border: 0, borderRadius: 0 } }}
        style={{ minHeight, padding: "12px 14px", fontSize: "14px", color: "rgb(31 41 55)" }}
      >
        <Toolbar className="flex flex-wrap items-center gap-0.5 border-b border-gray-100 bg-gray-50/70 px-2 py-1.5">
          <BtnBold className={btnCls} title={t("rich_text.bold")} />
          <BtnItalic className={btnCls} title={t("rich_text.italic")} />
          <BtnUnderline className={btnCls} title={t("rich_text.underline")} />
          <BtnStrike className={btnCls} title={t("rich_text.strike")} />
          <div className="mx-1 h-5 w-px bg-gray-200" />
          <BtnHeading1 className={btnCls} title={t("rich_text.heading1")} />
          <BtnHeading2 className={btnCls} title={t("rich_text.heading2")} />
          <BtnBulletList className={btnCls} title={t("rich_text.bullet_list")} />
          <BtnOrderedList className={btnCls} title={t("rich_text.ordered_list")} />
          <div className="mx-1 h-5 w-px bg-gray-200" />
          <BtnQuote className={btnCls} title={t("rich_text.quote")} />
          <BtnCode className={btnCls} title={t("rich_text.code")} />
          <BtnLink className={btnCls} title={t("rich_text.link")} />
          <BtnImage className={btnCls} />
          <div className="mx-1 h-5 w-px bg-gray-200" />
          <BtnClear className={btnCls} title={t("rich_text.clear_format")} />
        </Toolbar>
      </Editor>

      {isDropping && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl border-2 border-dashed border-brand-400 bg-brand-50/80 text-sm font-medium text-brand-600">
          {t("rich_text.drop_image")}
        </div>
      )}
    </div>
  );
}
