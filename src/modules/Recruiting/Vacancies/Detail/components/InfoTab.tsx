import { useEffect, useState } from "react";
import { ListChecks, Pencil } from "lucide-react";
import { toast } from "sonner";
import Button from "../../../../../components/ui/button/Button";
import BottomSheet from "../../../components/BottomSheet";
import StageListEditor from "../../../components/StageListEditor";
import { useUpdateVacancyStages } from "../../../../../api/services/vacancy.service";
import { sanitizeRichText } from "../../../components/RichTextEditor";
import {
  STAGE_COLOR_CONFIG,
  WORK_MODE_CONFIG,
  formatDate,
  sortStages,
  type StageDef,
  type Vacancy,
} from "../../../types";

interface InfoTabProps {
  vacancy: Vacancy;
  countsByStage?: Record<string, number>;
}

const Card = ({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) => (
  <div className="rounded-2xl border border-gray-200 bg-white">
    <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
      <span className="text-[15px] font-semibold text-gray-900">{title}</span>
    {action}
    </div>
    <div className="p-6">{children}</div>
  </div>
);


export default function InfoTab({ vacancy, countsByStage = {} }: InfoTabProps) {
  const updateStagesMutation = useUpdateVacancyStages();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [draftStages, setDraftStages] = useState<StageDef[]>([]);

  useEffect(() => {
    if (isEditorOpen) setDraftStages(sortStages(vacancy.stages));
  }, [isEditorOpen, vacancy.stages]);

  const lockedStageIds = new Set(
    Object.keys(countsByStage).filter((sid) => (countsByStage[sid] ?? 0) > 0)
  );

  const descriptionHtml = sanitizeRichText(vacancy.description);

  const saveStages = async () => {
    if (draftStages.length === 0) {
      toast.error("Добавьте хотя бы один этап");
      return;
    }
    if (draftStages.some((s) => !s.name.trim())) {
      toast.error("У всех этапов должно быть название");
      return;
    }
    try {
      await updateStagesMutation.mutateAsync({ guid: vacancy.id, stages: draftStages });
      toast.success("Этапы обновлены");
      setIsEditorOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить этапы");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card title="Описание">
          {descriptionHtml ? (
            <div
              className="comment-body text-sm leading-relaxed text-gray-600"
              dangerouslySetInnerHTML={{ __html: descriptionHtml }}
            />
          ) : (
            <p className="text-sm text-gray-300">Не заполнено</p>
          )}
        </Card>
      </div>

      <div className="space-y-4">
        <Card
          title="Этапы подбора"
          action={
            <button
              type="button"
              onClick={() => setIsEditorOpen(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 transition hover:text-brand-700"
            >
              <Pencil size={14} />
              Изменить
            </button>
          }
        >
          <ol className="space-y-2">
            {sortStages(vacancy.stages).map((stage, i) => (
              <li key={stage.id} className="flex items-center gap-2.5">
                <span className="w-4 text-center text-[11px] font-semibold text-gray-300">{i + 1}</span>
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${STAGE_COLOR_CONFIG[stage.color].dotClassName}`}
                />
                <span className="flex-1 truncate text-sm text-gray-700">{stage.name}</span>
                {(countsByStage[stage.id] ?? 0) > 0 && (
                  <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-500">
                    {countsByStage[stage.id]}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Детали">
          <dl className="space-y-3 text-sm">
            {[
              ["Департамент", vacancy.departmentTitle],
              ["Должность", vacancy.positionTitle],
              ["Формат", WORK_MODE_CONFIG[vacancy.workMode].label],
              ["Тип занятости", vacancy.employmentType],
              ["Уровень", vacancy.experienceLevel || "—"],
              ["Локация", vacancy.location || "—"],
              ["Открыта", formatDate(vacancy.openedAt)],
              ...(vacancy.closedAt ? [["Закрыта", formatDate(vacancy.closedAt)]] : []),
              ["Дедлайн", formatDate(vacancy.deadline)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 text-gray-400">{label}</dt>
                <dd className="text-right font-medium text-gray-700">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        {vacancy.skills.length > 0 && (
          <Card title="Навыки">
            <div className="flex flex-wrap gap-1.5">
              {vacancy.skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-md bg-brand-50 px-2 py-1 text-xs font-medium text-brand-600"
                >
                  {skill}
                </span>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Stage editor sheet */}
      <BottomSheet
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title="Этапы подбора"
        subtitle={vacancy.title}
        leading={
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <ListChecks size={18} />
          </span>
        }
        footer={
          <div className="ml-auto flex items-center gap-3">
            <Button variant="outline" onClick={() => setIsEditorOpen(false)} className="px-5">
              Отменить
            </Button>
            <Button onClick={saveStages} disabled={updateStagesMutation.isLoading} className="px-6">
              {updateStagesMutation.isLoading ? "Сохранение..." : "Сохранить этапы"}
            </Button>
          </div>
        }
      >
        <div className="mx-auto max-w-[720px] space-y-4">
          {lockedStageIds.size > 0 && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
              Этапы, на которых находятся кандидаты, удалить нельзя — сначала переместите кандидатов.
            </p>
          )}
          <StageListEditor
            stages={draftStages}
            onChange={setDraftStages}
            lockedStageIds={lockedStageIds}
          />
        </div>
      </BottomSheet>
    </div>
  );
}
