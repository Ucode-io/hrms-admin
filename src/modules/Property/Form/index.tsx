import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Boxes, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../components/common/PageMeta";
import Button from "../../../components/ui/button/Button";
import DateInput from "../../../components/form/DateInput";
import SidebarAwareFixedFooter from "../../../components/layout/SidebarAwareFixedFooter";
import FormSelect from "../../Recruiting/components/FormSelect";
import { useHeaderBreadcrumbItems } from "../../../context/HeaderBreadcrumbContext";
import { useUploadFile } from "../../../api/services/file-upload.service";
import { useSettingsDirectoryQuery } from "../../../api/services/settingsDirectory.service";
import encodeJsonToUrlParam from "../../../utils/encodeJsonToUrlParam";
import {
  mapPropertyRow,
  usePropertyQuery,
  useCreateProperty,
  useUpdateProperty,
  type PropertyWritePayload,
} from "../../../api/services/property.service";
import {
  createEmptyGeneralDraft,
  generalDraftFromItem,
  type PropertyGeneralDraft,
} from "../types";

const labelCls = "mb-1.5 block text-sm font-medium text-gray-700";
const inputCls =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-800 placeholder:text-gray-400 transition focus:border-brand-400 focus:outline-none focus:ring-3 focus:ring-brand-500/10";

const Card = ({ title, children }: { title: React.ReactNode; children: React.ReactNode }) => (
  <div className="rounded-2xl border border-gray-200 bg-white">
    <div className="border-b border-gray-100 px-6 py-4 text-[15px] font-semibold text-gray-900">{title}</div>
    <div className="p-6">{children}</div>
  </div>
);

const Field = ({
  label,
  required,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={className}>
    <label className={labelCls}>
      {label} {required && <span className="text-rose-500">*</span>}
    </label>
    {children}
  </div>
);

const draftToPayload = (draft: PropertyGeneralDraft): PropertyWritePayload => ({
  name: draft.name,
  property_categories_id: draft.categoryId,
  serial_number: draft.serialNumber,
  cost: draft.cost,
  photo: draft.photo,
  purchase_date: draft.purchaseDate,
  warranty_until: draft.warrantyUntil,
  description: draft.description,
});

export default function PropertyForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  useHeaderBreadcrumbItems(
    useMemo(
      () => [
        { label: "Имущество", to: "/property" },
        { label: isEdit ? "Редактировать" : "Новое имущество", to: "#" },
      ],
      [isEdit]
    )
  );

  const [draft, setDraft] = useState<PropertyGeneralDraft>(createEmptyGeneralDraft);
  const [errors, setErrors] = useState<{ name?: string }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: propertyData, isLoading: isItemLoading } = usePropertyQuery(id);
  const { data: categoriesData } = useSettingsDirectoryQuery({
    slug: "property_categories",
    params: { data: encodeJsonToUrlParam({ limit: 100, offset: 0 }) },
  });

  const uploadMutation = useUploadFile({ folder: "Property" });
  const createMutation = useCreateProperty();
  const updateMutation = useUpdateProperty();
  const isSaving = createMutation.isLoading || updateMutation.isLoading;

  const categoryOptions = useMemo(
    () =>
      (categoriesData?.response ?? []).map((c) => ({
        value: c.guid,
        label: String(c.title || "—"),
      })),
    [categoriesData]
  );

  // Populate the draft from the loaded item when editing.
  useEffect(() => {
    const row = propertyData?.response || propertyData?.data;
    if (!isEdit || !row) return;
    setDraft(generalDraftFromItem(mapPropertyRow(row)));
  }, [isEdit, propertyData]);

  const update = <K extends keyof PropertyGeneralDraft>(key: K, value: PropertyGeneralDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const handlePhotoSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Выберите изображение");
      return;
    }
    try {
      const url = await uploadMutation.mutateAsync(file);
      update("photo", url);
    } catch {
      toast.error("Не удалось загрузить фото");
    }
  };

  const handleSubmit = async () => {
    if (!draft.name.trim()) {
      setErrors({ name: "Введите наименование" });
      return;
    }
    setErrors({});
    const payload = draftToPayload({
      ...draft,
      name: draft.name.trim(),
      serialNumber: draft.serialNumber.trim(),
    });
    try {
      if (isEdit && id) {
        await updateMutation.mutateAsync({ guid: id, payload });
        toast.success("Сохранено");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Добавлено");
      }
      navigate("/property");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить");
    }
  };

  if (isEdit && isItemLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title={isEdit ? "Редактировать имущество | HRMS" : "Новое имущество | HRMS"}
        description="Форма имущества"
      />

      <div className="mx-auto max-w-[920px] space-y-5 pb-24">
        {/* Header banner */}
        <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-6 py-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Boxes size={20} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isEdit ? "Редактирование имущества" : "Новое имущество"}
            </h2>
            <p className="text-sm text-gray-500">Заполните данные о единице имущества</p>
          </div>
        </div>

        <Card title="Основное">
          <div className="space-y-4">
            {/* Photo */}
            <Field label="Фотография">
              <div className="flex items-center gap-4">
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-gray-50">
                  {draft.photo ? (
                    <>
                      <img src={draft.photo} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => update("photo", null)}
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                      >
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
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadMutation.isLoading}
                    className="inline-flex h-9 items-center gap-2 rounded-xl border border-gray-200 px-3.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-60"
                  >
                    <ImagePlus size={16} />
                    {draft.photo ? "Заменить" : "Загрузить фото"}
                  </button>
                  <p className="mt-1.5 text-xs text-gray-400">JPG, PNG до 10 МБ</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />
              </div>
            </Field>

            <Field label="Наименование" required>
              <input
                className={`${inputCls} ${errors.name ? "border-rose-300" : ""}`}
                placeholder='Например: MacBook Pro 14"'
                value={draft.name}
                onChange={(e) => update("name", e.target.value)}
              />
              {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name}</p>}
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Категория">
                <FormSelect
                  options={categoryOptions}
                  value={draft.categoryId}
                  onChange={(v) => update("categoryId", v || null)}
                  placeholder="Без категории"
                  isClearable
                  menuPortal
                />
              </Field>
              <Field label="Серийный номер">
                <input
                  className={inputCls}
                  placeholder="SN-000001"
                  value={draft.serialNumber}
                  onChange={(e) => update("serialNumber", e.target.value)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Стоимость">
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  placeholder="0"
                  value={draft.cost || ""}
                  onChange={(e) => update("cost", Number(e.target.value) || 0)}
                />
              </Field>
              <Field label="Дата покупки">
                <DateInput
                  className={inputCls}
                  value={draft.purchaseDate ?? ""}
                  onChange={(next) => update("purchaseDate", next || null)}
                />
              </Field>
            </div>

            <Field label="Гарантия до">
              <DateInput
                className={inputCls}
                value={draft.warrantyUntil ?? ""}
                onChange={(next) => update("warrantyUntil", next || null)}
              />
            </Field>

            <Field label="Описание">
              <textarea
                rows={3}
                className={`${inputCls} h-auto resize-none py-2.5`}
                placeholder="Характеристики, комплектация, дополнительная информация"
                value={draft.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </Field>
          </div>
        </Card>
      </div>

      {/* Sticky save bar */}
      <SidebarAwareFixedFooter>
        <span className="text-sm text-gray-500">
          {isEdit ? "Редактирование имущества" : "Новое имущество"}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)} className="px-5">
            Отменить
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving} className="px-6">
            {isSaving ? "Сохранение..." : isEdit ? "Сохранить" : "Создать имущество"}
          </Button>
        </div>
      </SidebarAwareFixedFooter>
    </>
  );
}
