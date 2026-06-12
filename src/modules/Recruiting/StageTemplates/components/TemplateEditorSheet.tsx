import { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
import { toast } from "sonner";
import Button from "../../../../components/ui/button/Button";
import BottomSheet from "../../components/BottomSheet";
import StageListEditor from "../../components/StageListEditor";
import {
  useCreateStageTemplate,
  useUpdateStageTemplate,
} from "../../../../api/services/stageTemplate.service";
import {
  DEFAULT_STAGE_PRESET,
  buildStages,
  type StageTemplate,
  type StageTemplateDraft,
} from "../../types";

const inputCls =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-800 transition placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";

interface TemplateEditorSheetProps {
  isOpen: boolean;
  /** null → create mode. */
  template: StageTemplate | null;
  onClose: () => void;
}

const emptyDraft = (): StageTemplateDraft => ({
  name: "",
  description: "",
  stages: buildStages(DEFAULT_STAGE_PRESET),
  isDefault: false,
});

export default function TemplateEditorSheet({ isOpen, template, onClose }: TemplateEditorSheetProps) {
  const isEdit = Boolean(template);
  const createMutation = useCreateStageTemplate();
  const updateMutation = useUpdateStageTemplate();

  const [draft, setDraft] = useState<StageTemplateDraft>(emptyDraft);

  useEffect(() => {
    if (!isOpen) return;
    setDraft(
      template
        ? {
            name: template.name,
            description: template.description,
            stages: template.stages,
            isDefault: template.isDefault,
          }
        : emptyDraft()
    );
  }, [isOpen, template]);

  const isSaving = createMutation.isLoading || updateMutation.isLoading;

  const handleSubmit = async () => {
    if (!draft.name.trim()) {
      toast.error("Укажите название шаблона");
      return;
    }
    if (draft.stages.length === 0) {
      toast.error("Добавьте хотя бы один этап");
      return;
    }
    try {
      const payload = { ...draft, name: draft.name.trim() };
      if (isEdit && template) {
        await updateMutation.mutateAsync({ guid: template.id, draft: payload });
        toast.success("Шаблон обновлён");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Шаблон создан");
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить");
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Редактирование шаблона" : "Новый шаблон этапов"}
      subtitle="Порядок этапов определяет колонки воронки вакансии"
      leading={
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <ListChecks size={18} />
        </span>
      }
      footer={
        <>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={draft.isDefault}
              onChange={(e) => setDraft((p) => ({ ...p, isDefault: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-300"
            />
            Шаблон по умолчанию
          </label>
          <div className="ml-auto flex items-center gap-3">
            <Button variant="outline" onClick={onClose} className="px-5">
              Отменить
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving} className="px-6">
              {isSaving ? "Сохранение..." : isEdit ? "Сохранить" : "Создать шаблон"}
            </Button>
          </div>
        </>
      }
    >
      <div className="mx-auto max-w-[720px] space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Название <span className="text-rose-500">*</span>
          </label>
          <input
            className={inputCls}
            value={draft.name}
            onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
            placeholder="Напр. Стандартный IT-найм"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Описание</label>
          <textarea
            rows={2}
            className={`${inputCls} h-auto resize-none py-2.5`}
            value={draft.description}
            onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
            placeholder="Для каких позиций используется"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Этапы <span className="text-rose-500">*</span>
          </label>
          <StageListEditor
            stages={draft.stages}
            onChange={(stages) => setDraft((p) => ({ ...p, stages }))}
          />
        </div>
      </div>
    </BottomSheet>
  );
}
