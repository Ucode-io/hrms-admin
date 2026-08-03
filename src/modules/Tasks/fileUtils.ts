// Attachment helpers. Stage 1 keeps files as data URLs inside the localStorage
// mock, so the size ceiling here is a storage constraint, not a product rule —
// drop it once uploads go to real object storage.

import type { NewAttachment } from "../../api/services/task.service";

export const MAX_ATTACHMENT_SIZE = 3 * 1024 * 1024;

export const isImage = (mime: string): boolean => mime.startsWith("image/");

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
};

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Не удалось прочитать «${file.name}»`));
    reader.readAsDataURL(file);
  });

export interface ReadFilesResult {
  accepted: NewAttachment[];
  /** Files skipped with a ready-to-toast reason. */
  rejected: string[];
}

export const readFiles = async (files: File[]): Promise<ReadFilesResult> => {
  const accepted: NewAttachment[] = [];
  const rejected: string[] = [];

  for (const file of files) {
    if (file.size > MAX_ATTACHMENT_SIZE) {
      rejected.push(`«${file.name}» больше ${formatFileSize(MAX_ATTACHMENT_SIZE)}`);
      continue;
    }
    try {
      accepted.push({
        name: file.name,
        size: file.size,
        mime: file.type || "application/octet-stream",
        url: await readAsDataUrl(file),
      });
    } catch {
      rejected.push(`«${file.name}» не удалось прочитать`);
    }
  }

  return { accepted, rejected };
};
