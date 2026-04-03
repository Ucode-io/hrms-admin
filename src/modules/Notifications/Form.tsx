import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useDropzone } from "react-dropzone";
import {
  ArrowLeft,
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Redo2,
  Trash2,
  Underline,
  Undo2,
  UploadCloud,
} from "lucide-react";
import DOMPurify from "dompurify";
import Editor, {
  Toolbar,
  createButton,
} from "react-simple-wysiwyg";
import { toast } from "sonner";
import PageMeta from "../../components/common/PageMeta";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Checkbox from "../../components/form/input/Checkbox";
import Button from "../../components/ui/button/Button";
import Spinner from "../../components/ui/Spinner";
import { useUploadFile } from "../../api/services/file-upload.service";
import {
  useCreateNotification,
  useNotificationItemQuery,
  useUpdateNotification,
} from "../../api/services/notification.service";

type NewsFormState = {
  title: string;
  text: string;
  photo: string;
  is_active: boolean;
};

const emptyFormState = (): NewsFormState => ({
  title: "",
  text: "<p></p>",
  photo: "",
  is_active: true,
});

const sanitizeHtml = (value: string) =>
  DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "ul",
      "ol",
      "li",
      "a",
      "h1",
      "h2",
      "h3",
      "blockquote",
    ],
    ALLOWED_ATTR: ["href", "target", "rel"],
  });

const htmlToPlainText = (value: string) => {
  const cleaned = DOMPurify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  return cleaned.replace(/\s+/g, " ").trim();
};

const toolbarBtnClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-gray-600 transition hover:border-gray-200 hover:bg-gray-50 hover:text-gray-800 data-[active=true]:border-brand-200 data-[active=true]:bg-brand-50 data-[active=true]:text-brand-600";

const BtnUndoCustom = createButton("Отменить", <Undo2 size={15} />, "undo");
const BtnRedoCustom = createButton("Повторить", <Redo2 size={15} />, "redo");
const BtnBoldCustom = createButton("Жирный", <Bold size={15} />, "bold");
const BtnItalicCustom = createButton("Курсив", <Italic size={15} />, "italic");
const BtnUnderlineCustom = createButton("Подчеркнутый", <Underline size={15} />, "underline");
const BtnNumberedListCustom = createButton("Нумерованный список", <ListOrdered size={15} />, "insertOrderedList");
const BtnBulletListCustom = createButton("Маркированный список", <List size={15} />, "insertUnorderedList");
const BtnLinkCustom = createButton("Ссылка", <LinkIcon size={15} />, ({ $selection }) => {
  if ($selection?.nodeName === "A") {
    document.execCommand("unlink");
    return;
  }
  const url = window.prompt("Введите URL", "https://");
  if (!url) return;
  document.execCommand("createLink", false, url);
});

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

export default function NewsFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const [form, setForm] = useState<NewsFormState>(emptyFormState);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isEditorFocused, setIsEditorFocused] = useState(false);

  const { data: editableItem, isLoading: isItemLoading } = useNotificationItemQuery({
    guid: id,
    querySettings: { enabled: isEditMode },
  });

  const createMutation = useCreateNotification();
  const updateMutation = useUpdateNotification();
  const uploadMutation = useUploadFile({ folder: "Media", format: "jpg" });

  useEffect(() => {
    if (!isEditMode || !editableItem) return;

    setForm({
      title: editableItem.title || "",
      text: editableItem.text || "<p></p>",
      photo: editableItem.photo || "",
      is_active: editableItem.is_active,
    });
  }, [editableItem, isEditMode]);

  const isSubmitting = createMutation.isLoading || updateMutation.isLoading;
  const isSaving = isSubmitting || uploadingPhoto;

  const handleUpload = useCallback(
    async (file: File) => {
      try {
        setUploadingPhoto(true);
        const url = await uploadMutation.mutateAsync(file);
        setForm((prev) => ({ ...prev, photo: url }));
        toast.success("Фото загружено.");
      } catch (error) {
        console.error("Failed to upload news image:", error);
        toast.error(getErrorMessage(error, "Не удалось загрузить фото."));
      } finally {
        setUploadingPhoto(false);
      }
    },
    [uploadMutation]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const selected = acceptedFiles[0];
      if (!selected) return;
      void handleUpload(selected);
    },
    [handleUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    disabled: isSaving,
    accept: {
      "image/png": [],
      "image/jpeg": [],
      "image/webp": [],
      "image/svg+xml": [],
    },
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const title = form.title.trim();
    const text = sanitizeHtml(form.text);
    const plainText = htmlToPlainText(text);

    if (!title) {
      toast.error("Введите заголовок новости.");
      return;
    }

    if (!plainText) {
      toast.error("Введите текст новости.");
      return;
    }

    const payload = {
      title,
      text,
      photo: form.photo.trim() || null,
      is_active: form.is_active,
    };

    try {
      if (isEditMode && id) {
        await updateMutation.mutateAsync({ guid: id, data: payload });
        toast.success("Новость обновлена.");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Новость создана.");
      }
      navigate("/settings/news");
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось сохранить новость."));
    }
  };

  return (
    <>
      <PageMeta
        title={isEditMode ? "Редактировать новость | HRMS" : "Создать новость | HRMS"}
        description="Создание и редактирование новостей"
      />

      <div className="space-y-4">
        <Link
          to="/settings/news"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-gray-700"
        >
          <ArrowLeft size={16} />
          К списку новостей
        </Link>

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">
              {isEditMode ? "Редактировать новость" : "Новая новость"}
            </h1>
            <p className="mt-1 text-base text-gray-500">
              Публикуйте новости и объявления для сотрудников
            </p>
          </div>
        </div>

        {isEditMode && isItemLoading ? (
          <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-gray-200 bg-white">
            <Spinner />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="space-y-6 xl:col-span-8">
              <section className="rounded-2xl border border-gray-200 bg-white p-5 lg:p-6">
                <h4 className="mb-5 text-base font-semibold text-gray-800">Содержание</h4>

                <div className="space-y-5">
                  <div>
                    <Label htmlFor="news-title">Заголовок *</Label>
                    <Input
                      id="news-title"
                      type="text"
                      value={form.title}
                      onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder="Например: Поздравляем с днем рождения"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div>
                    <Label>Текст *</Label>
                    <div
                      className={`overflow-hidden rounded-lg border bg-white shadow-theme-xs transition ${
                        isEditorFocused
                          ? "border-brand-300 ring-3 ring-brand-500/20"
                          : "border-gray-300"
                      }`}
                      onFocusCapture={() => setIsEditorFocused(true)}
                      onBlurCapture={(event) => {
                        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                        setIsEditorFocused(false);
                      }}
                    >
                      <Editor
                        value={form.text}
                        onChange={(event) => setForm((prev) => ({ ...prev, text: event.target.value }))}
                        disabled={isSubmitting}
                        containerProps={{
                          style: {
                            border: 0,
                            minHeight: 260,
                            borderRadius: 0,
                          },
                        }}
                        style={{ minHeight: 210, padding: "12px 14px", fontSize: "14px", color: "rgb(31 41 55)" }}
                      >
                        <Toolbar className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-gray-50 px-2 py-2">
                          <BtnUndoCustom className={toolbarBtnClass} />
                          <BtnRedoCustom className={toolbarBtnClass} />
                          <div className="mx-1 h-6 w-px bg-gray-200" />
                          <BtnBoldCustom className={toolbarBtnClass} />
                          <BtnItalicCustom className={toolbarBtnClass} />
                          <BtnUnderlineCustom className={toolbarBtnClass} />
                          <div className="mx-1 h-6 w-px bg-gray-200" />
                          <BtnNumberedListCustom className={toolbarBtnClass} />
                          <BtnBulletListCustom className={toolbarBtnClass} />
                          <div className="mx-1 h-6 w-px bg-gray-200" />
                          <BtnLinkCustom className={toolbarBtnClass} />
                        </Toolbar>
                      </Editor>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="space-y-6 xl:col-span-4">
              <section className="rounded-2xl border border-gray-200 bg-white p-5 lg:p-6">
                <h4 className="mb-5 text-base font-semibold text-gray-800">Изображение</h4>

                    <div
                  {...getRootProps()}
                  className={`group relative cursor-pointer overflow-hidden rounded-xl border border-dashed transition ${
                    isDragActive
                      ? "border-brand-500 bg-brand-50/30"
                      : "border-gray-300 bg-gray-50 hover:border-brand-400 hover:bg-brand-50/20"
                  } ${isSaving ? "pointer-events-none opacity-70" : ""}`}
                >
                  <input {...getInputProps()} />

                  <div className="relative h-72 w-full">
                    {form.photo ? (
                      <>
                        <img src={form.photo} alt="news" className="h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/15 to-transparent" />
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white text-gray-400 shadow-theme-xs">
                          {uploadingPhoto ? <Loader2 size={22} className="animate-spin" /> : <UploadCloud size={22} />}
                        </div>
                        <p className="text-sm font-semibold text-gray-800">
                          {uploadingPhoto
                            ? "Загрузка изображения..."
                            : isDragActive
                              ? "Отпустите файл для загрузки"
                              : "Перетащите фото сюда"}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">или нажмите, чтобы выбрать файл</p>
                      </div>
                    )}

                    {form.photo ? (
                      <div className="absolute inset-x-0 bottom-0 border-t border-white/40 bg-white/95 px-3 py-2 backdrop-blur-[2px]">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs font-medium text-gray-500">
                            Нажмите/перетащите для замены
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 px-3 py-1 text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              setForm((prev) => ({ ...prev, photo: "" }));
                            }}
                            disabled={isSaving}
                            startIcon={<Trash2 size={14} />}
                          >
                            Убрать
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                {!form.photo ? (
                  <div className="mt-2 text-xs text-gray-500">Рекомендуемое соотношение 16:9, минимум 1200x675</div>
                ) : null}
                {form.photo && uploadingPhoto ? (
                  <div className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-gray-500">
                    <Loader2 size={12} className="animate-spin" />
                    Обновляем изображение...
                  </div>
                ) : null}
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-5 lg:p-6">
                <h4 className="mb-4 text-base font-semibold text-gray-800">Публикация</h4>
                <Checkbox
                  checked={form.is_active}
                  onChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked }))}
                  label="Новость активна"
                  disabled={isSubmitting}
                />
              </section>

              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={() => navigate("/settings/news")} disabled={isSubmitting}>
                  Отмена
                </Button>
                <Button type="submit" size="sm" disabled={isSaving}>
                  {isSaving ? "Сохранение..." : isEditMode ? "Сохранить" : "Создать"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
