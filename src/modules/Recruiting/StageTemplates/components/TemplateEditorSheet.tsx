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
import { useTranslation } from "../../../../i18n";

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
  const { t } = useTranslation();
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
      toast.error(t("recruiting.templates.name_required"));
      return;
    }
    if (draft.stages.length === 0) {
      toast.error(t("recruiting.common.no_stages_error"));
      return;
    }
    try {
      const payload = { ...draft, name: draft.name.trim() };
      if (isEdit && template) {
        await updateMutation.mutateAsync({ guid: template.id, draft: payload });
        toast.success(t("recruiting.templates.updated"));
      } else {
        await createMutation.mutateAsync(payload);
        toast.success(t("recruiting.templates.created"));
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("recruiting.common.save_failed"));
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? t("recruiting.templates.edit_title") : t("recruiting.templates.new_title")}
      subtitle={t("recruiting.templates.editor_subtitle")}
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
            {t("recruiting.templates.default_checkbox")}
          </label>
          <div className="ml-auto flex items-center gap-3">
            <Button variant="outline" onClick={onClose} className="px-5">
              {t("recruiting.common.cancel")}
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving} className="px-6">
              {isSaving ? t("recruiting.common.saving") : isEdit ? t("recruiting.common.save") : t("recruiting.templates.create")}
            </Button>
          </div>
        </>
      }
    >
      <div className="mx-auto max-w-[720px] space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            {t("recruiting.common.name")} <span className="text-rose-500">*</span>
          </label>
          <input
            className={inputCls}
            value={draft.name}
            onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
            placeholder={t("recruiting.templates.name_placeholder")}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("recruiting.vacancy_description.description")}</label>
          <textarea
            rows={2}
            className={`${inputCls} h-auto resize-none py-2.5`}
            value={draft.description}
            onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
            placeholder={t("recruiting.templates.description_placeholder")}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            {t("recruiting.common.stages")} <span className="text-rose-500">*</span>
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
