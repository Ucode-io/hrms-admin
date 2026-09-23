import { useState } from "react";
import { Download, FileText, Loader2, Plus, Trash2, X } from "lucide-react";
import { Modal } from "../../../../components/ui/modal";
import { formatFileSize, isImage } from "../../fileUtils";
import type { TaskAttachment } from "../../types";
import { useTranslation } from "../../../../i18n";

interface AttachmentsGridProps {
  attachments: TaskAttachment[];
  onRemove: (attachmentId: string) => void;
  /** Открывает системный диалог выбора файлов; сам dropzone живёт в модалке. */
  onPickFiles: () => void;
  isUploading?: boolean;
}

/**
 * Сетка миниатюр вложений.
 *
 * Зоны «перетащите файлы» здесь больше нет: кнопка загрузки стоит в строке
 * заголовка секции, а областью перетаскивания служит вся модалка — так пустая
 * секция не занимает полэкрана рамкой.
 */
export default function AttachmentsGrid({
  attachments,
  onRemove,
  onPickFiles,
  isUploading,
}: AttachmentsGridProps) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<TaskAttachment | null>(null);
  /** Картинки, которые не декодировались, показываем обычной файловой плиткой. */
  const [broken, setBroken] = useState<string[]>([]);

  return (
    <>
      <div className="relative">
        {attachments.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(116px,1fr))] gap-2.5">
            {attachments.map((file) => {
              const image = isImage(file.mime) && !broken.includes(file.id);
              return (
                <div
                  key={file.id}
                  className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
                >
                  {image ? (
                    <button
                      type="button"
                      onClick={() => setPreview(file)}
                      className="block aspect-square w-full"
                      title={file.name}
                    >
                      <img
                        src={file.url}
                        alt={file.name}
                        onError={() => setBroken((ids) => [...ids, file.id])}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  ) : (
                    <a
                      href={file.url}
                      download={file.name}
                      className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 px-2 text-center"
                      title={file.name}
                    >
                      <FileText size={22} className="text-gray-400" />
                      <span className="line-clamp-2 text-theme-xs text-gray-600 dark:text-gray-300">
                        {file.name}
                      </span>
                    </a>
                  )}

                  <div className="flex items-center justify-between gap-1 border-t border-gray-100 px-2 py-1 dark:border-gray-800">
                    <span className="truncate text-theme-xs text-gray-400" title={file.name}>
                      {formatFileSize(file.size)}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <a
                        href={file.url}
                        download={file.name}
                        aria-label={t("tasks.attachments.download_named", { name: file.name })}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10"
                      >
                        <Download size={13} />
                      </a>
                      <button
                        type="button"
                        onClick={() => onRemove(file.id)}
                        aria-label={t("tasks.attachments.delete_named", { name: file.name })}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-500/10"
                      >
                        <Trash2 size={13} />
                      </button>
                    </span>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={onPickFiles}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-gray-300 text-gray-400 transition hover:border-brand-400 hover:bg-gray-50 hover:text-brand-500 dark:border-gray-600 dark:hover:bg-white/5"
            >
              <Plus size={18} />
              <span className="text-theme-xs">{t("tasks.attachments.add")}</span>
            </button>
          </div>
        )}

        {isUploading && (
          <div className="mt-2 flex items-center gap-2 text-theme-xs text-gray-400">
            <Loader2 size={13} className="animate-spin" />
            {t("tasks.attachments.uploading")}
          </div>
        )}
      </div>

      {/* Mounted only while open: a closed Modal still runs its body-scroll
          effect and would release the parent modal's scroll lock. */}
      {preview && (
        <Modal
          isOpen
          onClose={() => setPreview(null)}
          showCloseButton={false}
          className="mx-4 w-full max-w-[860px] overflow-hidden rounded-2xl bg-transparent p-0"
        >
          <div className="flex flex-col">
            <div className="flex items-center justify-between gap-3 rounded-t-2xl bg-white px-4 py-2.5 dark:bg-gray-900">
              <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
                {preview.name}
              </span>
              <span className="flex items-center gap-1">
                <a
                  href={preview.url}
                  download={preview.name}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/5"
                  aria-label={t("tasks.attachments.download")}
                >
                  <Download size={16} />
                </a>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/5"
                  aria-label={t("tasks.attachments.close")}
                >
                  <X size={17} />
                </button>
              </span>
            </div>
            <img
              src={preview.url}
              alt={preview.name}
              className="max-h-[75vh] w-full rounded-b-2xl bg-gray-900 object-contain"
            />
          </div>
        </Modal>
      )}
    </>
  );
}
