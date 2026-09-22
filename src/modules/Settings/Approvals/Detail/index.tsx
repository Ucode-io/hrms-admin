import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ReactSelect, { type SingleValue, type StylesConfig } from "react-select";
import PageMeta from "../../../../components/common/PageMeta";
import Button from "../../../../components/ui/button/Button";
import TextArea from "../../../../components/form/input/TextArea";
import DepartmentsInfiniteMultiSelect, {
  type DepartmentOption,
} from "../../../../components/autocomplete/DepartmentsInfiniteMultiSelect";
import PositionTreeSelect from "../../../../components/autocomplete/PositionTreeSelect";
import {
  type ApprovalProcessType,
  type ApprovalStage,
  createStageId,
  PROCESS_TYPES,
} from "../mockData";
import {
  useApprovalProcessQuery,
  useSaveApprovalProcess,
} from "../../../../api/services/approval.service";
import { useTranslation } from "../../../../i18n";

const STAGE_DND_TYPE = "approval-stage";

type ProcessOption = { value: ApprovalProcessType; label: string };

const processSelectStyles: StylesConfig<ProcessOption, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: "44px",
    borderColor: state.isFocused ? "var(--color-brand-500, #465fff)" : "#d1d5db",
    borderRadius: "0.5rem",
    boxShadow: state.isFocused
      ? "0 0 0 3px rgba(var(--company-color-rgb, 70, 95, 255), 0.12)"
      : "none",
    "&:hover": {
      borderColor: state.isFocused ? "var(--color-brand-500, #465fff)" : "#9ca3af",
    },
  }),
  valueContainer: (base) => ({ ...base, padding: "2px 10px", fontSize: "14px" }),
  input: (base) => ({ ...base, margin: 0, padding: 0, fontSize: "14px" }),
  placeholder: (base) => ({ ...base, fontSize: "14px", color: "#9ca3af" }),
  singleValue: (base) => ({ ...base, fontSize: "14px", color: "#1f2937" }),
  option: (base, state) => ({
    ...base,
    fontSize: "14px",
    cursor: "pointer",
    backgroundColor: state.isSelected
      ? "var(--color-brand-500, #465fff)"
      : state.isFocused
      ? "#f3f4f6"
      : "white",
    color: state.isSelected ? "white" : "#111827",
    padding: "8px 12px",
  }),
  menu: (base) => ({ ...base, zIndex: 100000, borderRadius: "0.5rem", border: "1px solid #e5e7eb" }),
  menuPortal: (base) => ({ ...base, zIndex: 100000 }),
};



interface StageRowProps {
  stage: ApprovalStage;
  index: number;
  onChange: (id: string, patch: Partial<ApprovalStage>) => void;
  onRemove: (id: string) => void;
  onMove: (from: number, to: number) => void;
}

function StageRow({ stage, index, onChange, onRemove, onMove }: StageRowProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag({
    type: STAGE_DND_TYPE,
    item: { index },
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
  });

  const [, drop] = useDrop<{ index: number }>({
    accept: STAGE_DND_TYPE,
    hover: (item) => {
      if (item.index === index) return;
      onMove(item.index, index);
      item.index = index;
    },
  });

  preview(drop(ref));

  return (
    <div
      ref={ref}
      className={`flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 md:flex-row md:items-end ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-center gap-2 self-start pt-1 md:self-end md:pb-2.5">
        <button
          type="button"
          ref={drag as unknown as React.Ref<HTMLButtonElement>}
          className="cursor-grab rounded-md p-1 text-gray-400 transition hover:bg-gray-200 hover:text-gray-600 active:cursor-grabbing"
          aria-label={t("settings_approvals.detail.stage_drag_aria")}
        >
          <GripVertical size={16} />
        </button>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600">
          {index + 1}
        </span>
      </div>

      <div className="flex-1">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          {t("settings_approvals.detail.stage_title_label")}
        </label>
        <input
          type="text"
          value={stage.title}
          onChange={(event) => onChange(stage.id, { title: event.target.value })}
          placeholder={t("settings_approvals.detail.stage_title_placeholder")}
          className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
        />
      </div>

      <div className="flex-1">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          {t("settings_approvals.detail.stage_position_label")}
        </label>
        <PositionTreeSelect
          value={stage.positionId}
          valueLabel={stage.positionTitle}
          onChange={(id, title) =>
            onChange(stage.id, { positionId: id, positionTitle: title })
          }
        />
      </div>

      <div className="flex items-center self-end pb-0.5">
        <button
          type="button"
          onClick={() => onRemove(stage.id)}
          className="rounded-md p-2 text-error-500 transition hover:bg-error-50 hover:text-error-700"
          aria-label={t("settings_approvals.detail.stage_remove_aria")}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

export default function ApprovalProcessDetailPage() {
  const { t } = useTranslation();
  const processOptions: ProcessOption[] = PROCESS_TYPES.map((item) => ({
    value: item.value,
    label: t(item.labelKey),
  }));
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === "new";

  const { data: existing, isLoading } = useApprovalProcessQuery(
    isNew ? undefined : id
  );
  const saveProcessMutation = useSaveApprovalProcess();

  const [title, setTitle] = useState("");
  const [type, setType] = useState<ApprovalProcessType | "">("");
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [description, setDescription] = useState("");
  const [stages, setStages] = useState<ApprovalStage[]>([]);

  // Populate the form once the existing process loads (edit mode).
  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setType(existing.type);
    setDepartments(
      existing.departments.map((d) => ({ value: d.id, label: d.title }))
    );
    setDescription(existing.description);
    setStages(existing.stages);
  }, [existing]);

  if (!isNew && !existing && isLoading) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-500">
          {t("settings_approvals.detail.loading")}
        </div>
      </div>
    );
  }

  if (!isNew && !existing) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
          <p className="text-base font-medium text-gray-800">{t("settings_approvals.detail.not_found")}</p>
        </div>
      </div>
    );
  }

  const addStage = () => {
    setStages((prev) => [
      ...prev,
      { id: createStageId(), title: "", positionId: "", positionTitle: "" },
    ]);
  };

  const updateStage = (stageId: string, patch: Partial<ApprovalStage>) => {
    setStages((prev) =>
      prev.map((stage) => (stage.id === stageId ? { ...stage, ...patch } : stage))
    );
  };

  const removeStage = (stageId: string) => {
    setStages((prev) => prev.filter((stage) => stage.id !== stageId));
  };

  const moveStage = useCallback((from: number, to: number) => {
    setStages((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error(t("settings_approvals.detail.validation_title_required"));
      return;
    }
    if (!type) {
      toast.error(t("settings_approvals.detail.validation_type_required"));
      return;
    }
    if (departments.length === 0) {
      toast.error(t("settings_approvals.detail.validation_departments_required"));
      return;
    }
    if (stages.length === 0) {
      toast.error(t("settings_approvals.detail.validation_stages_required"));
      return;
    }
    const invalidStage = stages.find((stage) => !stage.title.trim() || !stage.positionId);
    if (invalidStage) {
      toast.error(t("settings_approvals.detail.validation_stage_incomplete"));
      return;
    }

    try {
      await saveProcessMutation.mutateAsync({
        id: existing?.id,
        process: {
          title: title.trim(),
          type,
          departments: departments.map((d) => ({ id: d.value, title: d.label })),
          description: description.trim(),
          stages: stages.map((stage) => ({ ...stage, title: stage.title.trim() })),
        },
      });

      toast.success(
        isNew ? t("settings_approvals.detail.toast_create_success") : t("settings_approvals.detail.toast_update_success")
      );
      navigate("/settings/approvals");
    } catch (error) {
      console.error("Failed to save approval process:", error);
      toast.error(t("settings_approvals.detail.toast_save_error"));
    }
  };

  return (
    <>
      <PageMeta
        title={isNew ? t("settings_approvals.detail.page_meta_title_new") : t("settings_approvals.detail.page_meta_title_existing")}
        description={t("settings_approvals.detail.page_meta_description")}
      />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-gray-900">
            {isNew ? t("settings_approvals.detail.heading_new") : t("settings_approvals.detail.heading_existing")}
          </h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-11"
              onClick={() => navigate("/settings/approvals")}
            >
              {t("settings_approvals.detail.cancel_button")}
            </Button>
            <Button
              className="h-11"
              onClick={() => void handleSave()}
              disabled={saveProcessMutation.isLoading}
            >
              {saveProcessMutation.isLoading ? t("settings_approvals.detail.saving_button") : t("settings_approvals.detail.save_button")}
            </Button>
          </div>
        </div>

        {/* General settings */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">{t("settings_approvals.detail.general_settings_title")}</h2>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("settings_approvals.detail.title_label")}</label>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("settings_approvals.detail.title_placeholder")}
                className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("settings_approvals.detail.process_label")}</label>
              <ReactSelect<ProcessOption>
                options={processOptions}
                value={processOptions.find((option) => option.value === type) ?? null}
                onChange={(option: SingleValue<ProcessOption>) =>
                  setType(option?.value ?? "")
                }
                placeholder={t("settings_approvals.detail.process_placeholder")}
                isSearchable
                styles={processSelectStyles}
                menuPosition="fixed"
                classNamePrefix="approval-process-select"
                noOptionsMessage={() => t("settings_approvals.detail.no_options")}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {t("settings_approvals.detail.departments_label")}
              </label>
              <DepartmentsInfiniteMultiSelect
                value={departments}
                onChange={setDepartments}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("settings_approvals.detail.description_label")}</label>
              <TextArea
                value={description}
                onChange={setDescription}
                rows={3}
                placeholder={t("settings_approvals.detail.description_placeholder")}
              />
            </div>
          </div>
        </div>

        {/* Stages */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t("settings_approvals.detail.stages_title")}</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                {t("settings_approvals.detail.stages_hint")}
              </p>
            </div>
            <Button variant="outline" startIcon={<Plus size={16} />} onClick={addStage}>
              {t("settings_approvals.detail.add_stage_button")}
            </Button>
          </div>

          {stages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center">
              <p className="text-sm text-gray-500">
                {t("settings_approvals.detail.stages_empty")}
              </p>
            </div>
          ) : (
            <DndProvider backend={HTML5Backend}>
              <div className="space-y-3">
                {stages.map((stage, index) => (
                  <StageRow
                    key={stage.id}
                    stage={stage}
                    index={index}
                    onChange={updateStage}
                    onRemove={removeStage}
                    onMove={moveStage}
                  />
                ))}
              </div>
            </DndProvider>
          )}
        </div>
      </div>
    </>
  );
}
