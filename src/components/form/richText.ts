// Shared rich-text helpers: one sanitiser for every editor and reader.

import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "p",
  "div",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "strike",
  "del",
  "ul",
  "ol",
  "li",
  "a",
  "h1",
  "h2",
  "h3",
  "blockquote",
  "pre",
  "code",
  "img",
];

export const sanitizeRichText = (value: string) =>
  DOMPurify.sanitize(value, {
    ALLOWED_TAGS,
    // `src` carries a data: URL for inline images — DOMPurify allows that on <img>.
    ALLOWED_ATTR: ["href", "target", "rel", "src", "alt", "title", "width", "height"],
  });

export const richTextToPlain = (value: string) =>
  DOMPurify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).replace(/\s+/g, " ").trim();

/** True for an empty document, including the `<p><br></p>` an editor leaves behind. */
export const isRichTextEmpty = (value: string): boolean => richTextToPlain(value).length === 0;
