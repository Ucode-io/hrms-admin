import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "../../../components/ui/modal";
import Button from "../../../components/ui/button/Button";
import { useUploadFile } from "../../../api/services/file-upload.service";
import {
  type PropertyGeneralDraft,
  type PropertyItem,
  createEmptyGeneralDraft,
  generalDraftFromItem,
} from "../types";

interface CategoryOption {
  value: string;
  label: string;
}

interface PropertyFormModalProps {
  isOpen: boolean;
  mode: "create" | "edit";
  initialItem: PropertyItem | null;
  categoryOptions: CategoryOption[];
  onClose: () => void;
  onSubmit: (draft: PropertyGeneralDraft) => void;
}

const labelCls = "mb-1.5 block text-sm font-medium text-gray-700";
const inputCls =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-800 placeholder:text-gray-400 transition focus:border-brand-400 focus:outline-none focus:ring-3 focus:ring-brand-500/10";
const selectCls = `${inputCls} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2220%22 height=%2220%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2394a3b8%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-[right_0.75rem_center] bg-no-repeat pr-10`;

export default function PropertyFormModal({
  isOpen,
  mode,
  initialItem,
  categoryOptions,
  onClose,
  onSubmit,
}: PropertyFormModalProps) {
  const [draft, setDraft] = useState<PropertyGeneralDraft>(createEmptyGeneralDraft);
  const [errors, setErrors] = useState<{ name?: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadFile({ folder: "Property" });

  useEffect(() => {
    if (!isOpen) return;
    setDraft(initialItem ? generalDraftFromItem(initialItem) : createEmptyGeneralDraft());
    setErrors({});
  }, [isOpen, initialItem]);

  const update = <K extends keyof PropertyGeneralDraft>(key: K, value: PropertyGeneralDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const handlePhotoSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Выберите изображение"); return; }
    try {
      const url = await uploadMutation.mutateAsync(file);
      update("photo", url);
    } catch {
      toast.error("Не удалось загрузить фото");
    }
  };

  const handleSubmit = () => {
    if (!draft.name.trim()) { setErrors({ name: "Введите наименование" }); return; }
    setErrors({});
    onSubmit({ ...draft, name: draft.name.trim(), serialNumber: draft.serialNumber.trim() });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} showCloseButton={false} className="m-4 max-w-[660px]">
      <div className="flex max-h-[90vh] flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <h3 className="text-lg font-semibold text-gray-900">
            {mode === "create" ? "Добавить имущество" : "Редактировать имущество"}
          </h3>
          <button type="button" onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-400 transition hover:bg-gray-50 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            {/* Photo */}
            <div>
              <label className={labelCls}>Фотография</label>
              <div className="flex items-center gap-4">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-gray-50">
                  {draft.photo ? (
                    <>
                      <img src={draft.photo} alt="" className="h-full w-full object-cover" />
                      <button type="button" onClick={() => update("photo", null)}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70">
                        <X size={13} />
                      </button>
                    </>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-300">
                      <ImagePlus size={24} />
                    </div>
                  )}
                  {uploadMutation.isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                      <Loader2 size={20} className="animate-spin text-brand-500" />
                    </div>
                  )}
                </div>
                <div>
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    disabled={uploadMutation.isLoading}
                    className="inline-flex h-9 items-center gap-2 rounded-xl border border-gray-200 px-3.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-60">
                    <ImagePlus size={16} />
                    {draft.photo ? "Заменить" : "Загрузить фото"}
                  </button>
                  <p className="mt-1.5 text-xs text-gray-400">JPG, PNG до 10 МБ</p>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
              </div>
            </div>

            {/* Name */}
            <div>
              <label className={labelCls}>Наименование</label>
              <input
                className={`${inputCls} ${errors.name ? "border-rose-300" : ""}`}
                placeholder='Например: MacBook Pro 14"'
                value={draft.name}
                onChange={(e) => update("name", e.target.value)}
              />
              {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name}</p>}
            </div>

            {/* Category + Serial */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Категория</label>
                <select className={selectCls} value={draft.categoryId ?? ""}
                  onChange={(e) => update("categoryId", e.target.value || null)}>
                  <option value="">Без категории</option>
                  {categoryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Серийный номер</label>
                <input className={inputCls} placeholder="SN-000001"
                  value={draft.serialNumber} onChange={(e) => update("serialNumber", e.target.value)} />
              </div>
            </div>

            {/* Cost + Purchase date */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Стоимость</label>
                <input type="number" min={0} className={inputCls} placeholder="0"
                  value={draft.cost || ""}
                  onChange={(e) => update("cost", Number(e.target.value) || 0)} />
              </div>
              <div>
                <label className={labelCls}>Дата покупки</label>
                <input type="date" className={inputCls}
                  value={draft.purchaseDate ?? ""}
                  onChange={(e) => update("purchaseDate", e.target.value || null)} />
              </div>
            </div>

            {/* Warranty */}
            <div>
              <label className={labelCls}>Гарантия до</label>
              <input type="date" className={inputCls}
                value={draft.warrantyUntil ?? ""}
                onChange={(e) => update("warrantyUntil", e.target.value || null)} />
            </div>

            {/* Description */}
            <div>
              <label className={labelCls}>Описание</label>
              <textarea rows={3} className={`${inputCls} h-auto resize-none py-2.5`}
                placeholder="Характеристики, комплектация, дополнительная информация"
                value={draft.description} onChange={(e) => update("description", e.target.value)} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <Button variant="outline" onClick={onClose} className="px-5">Отменить</Button>
          <Button onClick={handleSubmit} className="px-5" disabled={uploadMutation.isLoading}>
            {mode === "create" ? "Добавить" : "Сохранить"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
