import { useMemo, useState } from "react";
import { ListChecks, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../components/common/PageMeta";
import Button from "../../../components/ui/button/Button";
import { Modal } from "../../../components/ui/modal";
import { useHeaderBreadcrumbItems } from "../../../context/HeaderBreadcrumbContext";
import {
  mapStageTemplateRow,
  useDeleteStageTemplate,
  useStageTemplatesQuery,
  useUpdateStageTemplate,
} from "../../../api/services/stageTemplate.service";
import { STAGE_COLOR_CONFIG, formatDate, type StageTemplate } from "../types";
import TemplateEditorSheet from "./components/TemplateEditorSheet";

const BREADCRUMBS = [
  { label: "Рекрутинг", to: "/recruiting/vacancies" },
  { label: "Шаблоны этапов", to: "/recruiting/settings/stage-templates" },
];

export default function StageTemplatesPage() {
  useHeaderBreadcrumbItems(BREADCRUMBS);

  const { data, isLoading } = useStageTemplatesQuery();
  const updateMutation = useUpdateStageTemplate();
  const deleteMutation = useDeleteStageTemplate();

  const [editorTemplate, setEditorTemplate] = useState<StageTemplate | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<StageTemplate | null>(null);

  const templates = useMemo(
    () => (data?.response ?? []).map(mapStageTemplateRow),
    [data]
  );

  const openCreate = () => {
    setEditorTemplate(null);
    setIsEditorOpen(true);
  };

  const openEdit = (template: StageTemplate) => {
    setEditorTemplate(template);
    setIsEditorOpen(true);
  };

  const makeDefault = async (template: StageTemplate) => {
    try {
      await updateMutation.mutateAsync({
        guid: template.id,
        draft: {
          name: template.name,
          description: template.description,
          stages: template.stages,
          isDefault: true,
        },
      });
      toast.success(`«${template.name}» — шаблон по умолчанию`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось обновить шаблон");
    }
  };

  const confirmDelete = async () => {
    if (!deletingItem) return;
    try {
      await deleteMutation.mutateAsync(deletingItem.id);
      setDeletingItem(null);
      toast.success("Шаблон удалён");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить");
    }
  };

  return (
    <>
      <PageMeta
        title="Шаблоны этапов | Рекрутинг"
        description="Наборы этапов для воронок подбора"
      />

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <ListChecks size={20} />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Шаблоны этапов</h1>
            <p className="text-sm text-gray-500">
              Наборы этапов, из которых создаётся воронка вакансии
            </p>
          </div>
        </div>
        <Button startIcon={<Plus size={16} />} onClick={openCreate} className="h-10 rounded-xl px-4">
          Новый шаблон
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-20 text-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          <p className="text-sm text-gray-400">Загрузка...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-20 text-center">
          <ListChecks size={36} className="text-gray-300" />
          <p className="text-sm font-medium text-gray-500">Шаблонов пока нет</p>
          <p className="text-xs text-gray-400">Создайте первый шаблон этапов подбора</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-brand-200 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-[15px] font-semibold text-gray-900">
                      {template.name}
                    </h3>
                    {template.isDefault && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600">
                        <Star size={11} className="fill-amber-400 text-amber-400" />
                        По умолчанию
                      </span>
                    )}
                  </div>
                  {template.description && (
                    <p className="mt-1 line-clamp-2 text-[13px] text-gray-500">{template.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => openEdit(template)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                    title="Редактировать"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingItem(template)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-rose-50 hover:text-rose-500"
                    title="Удалить"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Stage chain */}
              <ol className="mt-4 flex flex-1 flex-col gap-1.5">
                {template.stages.map((stage, i) => (
                  <li key={stage.id} className="flex items-center gap-2.5">
                    <span className="w-4 text-center text-[11px] font-semibold text-gray-300">
                      {i + 1}
                    </span>
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${STAGE_COLOR_CONFIG[stage.color].dotClassName}`}
                    />
                    <span className="truncate text-[13px] text-gray-700">{stage.name}</span>
                  </li>
                ))}
              </ol>

              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
                <span className="text-xs text-gray-400">
                  {template.stages.length} этапов · {formatDate(template.createdAt)}
                </span>
                {!template.isDefault && (
                  <button
                    type="button"
                    onClick={() => makeDefault(template)}
                    className="text-xs font-medium text-brand-600 transition hover:text-brand-700"
                  >
                    Сделать по умолчанию
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <TemplateEditorSheet
        isOpen={isEditorOpen}
        template={editorTemplate}
        onClose={() => setIsEditorOpen(false)}
      />

      <Modal
        isOpen={Boolean(deletingItem)}
        onClose={() => setDeletingItem(null)}
        showCloseButton={false}
        className="m-4 max-w-[420px]"
      >
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900">Удалить шаблон?</h3>
          <p className="mt-2 text-sm text-gray-500">
            Шаблон <span className="font-medium text-gray-700">«{deletingItem?.name}»</span> будет
            удалён. Существующие вакансии не пострадают — у них своя копия этапов.
          </p>
          <div className="mt-6 flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setDeletingItem(null)} className="px-5">
              Отменить
            </Button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleteMutation.isLoading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-600 px-5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-60"
            >
              {deleteMutation.isLoading ? "Удаление..." : "Удалить"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
