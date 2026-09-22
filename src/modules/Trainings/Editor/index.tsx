import { useEffect, useMemo, useRef, useState } from "react";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import {
  CloudUpload,
  FileArchive,
  FileText,
  GraduationCap,
  GripVertical,
  Link2,
  MapPin,
  Trash2,
  UserPlus,
  Users,
  Video,
  X,
} from "lucide-react";
import Select from "react-select";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import PageMeta from "../../../components/common/PageMeta";
import { useHeaderBreadcrumbItems } from "../../../context/HeaderBreadcrumbContext";
import Button from "../../../components/ui/button/Button";
import SidebarAwareFixedFooter from "../../../components/layout/SidebarAwareFixedFooter";
import { getDepartmentSelectStyles } from "../../Settings/Departments/utils";
import EmployeePickerModal from "../../Surveys/Editor/EmployeePickerModal";
import FormDatePicker from "../../Recruiting/components/FormDatePicker";
import EmployeeInfiniteSelect from "../../../components/autocomplete/EmployeeInfiniteSelect";
import { uploadFileToCdn } from "../../../api/services/file-upload.service";
import { getUserBaseById } from "../../../api/services/auth.service";
import {
  useCreateTraining,
  useTrainingQuery,
  useUpdateTraining,
} from "../../../api/services/training.service";
import {
  type TrainingMaterial,
  type TrainingMaterialType,
  useSaveTrainingMaterials,
  useSyncTrainingEmployees,
  useTrainingEmployeesQuery,
  useTrainingMaterialsQuery,
} from "../../../api/services/trainingGateway.service";

type Option = {
  value: string;
  label: string;
};

type EditorMaterial = TrainingMaterial & { localId: string };

const STATUS_OPTIONS: Option[] = [
  { value: "draft", label: "Черновик" },
  { value: "active", label: "Активный" },
  { value: "archived", label: "Архив" },
];

const LINK_TYPE_OPTIONS: Option[] = [
  { value: "link", label: "Ссылка" },
  { value: "video", label: "Видео" },
];

const MATERIAL_TYPE_META: Record<TrainingMaterialType, { label: string; icon: typeof FileText }> = {
  file: { label: "Файл", icon: FileText },
  link: { label: "Ссылка", icon: Link2 },
  video: { label: "Видео", icon: Video },
};

let materialIdCounter = 0;
const nextMaterialId = () => `material-${++materialIdCounter}`;

const formatFileSize = (bytes?: number | null): string => {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
};

/** "YYYY-MM-DD" for FormDatePicker, '' when absent/invalid. */
const toDateInputValue = (value?: string | null): string => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const resolveUserFullName = (user: Record<string, unknown> | null): string => {
  if (!user) return "";
  const parts = [user.second_name, user.first_name, user.middle_name]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);
  return parts.join(" ").trim();
};

const resolveCreatedGuid = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") return null;

  const data = payload as Record<string, unknown>;
  if (typeof data.guid === "string" && data.guid) return data.guid;

  const response = data.response;
  if (response && typeof response === "object" && !Array.isArray(response)) {
    const responseObj = response as Record<string, unknown>;
    if (typeof responseObj.guid === "string" && responseObj.guid) return responseObj.guid;
  }

  if (Array.isArray(response)) {
    const first = response[0];
    if (first && typeof first === "object") {
      const firstObj = first as Record<string, unknown>;
      if (typeof firstObj.guid === "string" && firstObj.guid) return firstObj.guid;
    }
  }

  return null;
};

function Toggle({ checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3"
    >
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
          checked ? "bg-brand-500" : "bg-gray-200"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </span>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </button>
  );
}

function SortableMaterialRow({
  material,
  onRemove,
  onTitleChange,
}: {
  material: EditorMaterial;
  onRemove: () => void;
  onTitleChange: (title: string) => void;
}) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useSortable({
    id: material.localId,
  });

  const meta = MATERIAL_TYPE_META[material.material_type] || MATERIAL_TYPE_META.file;
  const MetaIcon = material.file_name?.toLowerCase().endsWith(".zip") ? FileArchive : meta.icon;
  const sizeLabel = formatFileSize(material.file_size);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 bg-white px-3 py-2.5 ${
        isDragging ? "relative z-10 rounded-xl shadow-lg ring-1 ring-brand-200" : ""
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none rounded-md p-1.5 text-gray-300 transition hover:bg-gray-100 hover:text-gray-500 active:cursor-grabbing"
        aria-label="Перетащить"
      >
        <GripVertical size={15} />
      </button>

      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        <MetaIcon size={16} />
      </span>

      <div className="min-w-0 flex-1">
        <input
          value={material.title}
          onChange={(event) => onTitleChange(event.target.value)}
          className="w-full truncate rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-gray-800 transition focus:border-gray-200 focus:bg-white focus:outline-none"
        />
        <a
          href={material.url}
          target="_blank"
          rel="noreferrer"
          className="block truncate px-1 text-xs text-gray-400 hover:text-brand-500"
        >
          {meta.label}
          {sizeLabel ? ` · ${sizeLabel}` : ""} · {material.url}
        </a>
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-md p-1.5 text-gray-400 transition hover:bg-error-50 hover:text-error-600"
        aria-label="Удалить материал"
      >
        <Trash2 size={14} />
      </button>
    </li>
  );
}

export default function TrainingEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("draft");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [trainerId, setTrainerId] = useState("");
  const [trainerLabel, setTrainerLabel] = useState("");
  const [location, setLocation] = useState("");
  const [homeworkRequired, setHomeworkRequired] = useState(false);
  const [homeworkDeadline, setHomeworkDeadline] = useState("");

  const [materials, setMaterials] = useState<EditorMaterial[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragDepthRef = useRef(0);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkType, setLinkType] = useState<TrainingMaterialType>("link");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [employeeLabels, setEmployeeLabels] = useState<Map<string, string>>(new Map());
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const initializedFromTrainingRef = useRef(false);
  const initializedMaterialsRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const { data: training, isLoading: isTrainingLoading } = useTrainingQuery(id || "");
  const { data: trainingEmployees } = useTrainingEmployeesQuery(id || "");
  const { data: existingMaterials } = useTrainingMaterialsQuery(id || "");

  useHeaderBreadcrumbItems(
    useMemo(
      () =>
        isEditing
          ? [
              { label: "Тренинги", to: "/trainings" },
              { label: String(training?.title || "Детали"), to: `/trainings/${id}` },
              { label: "Редактирование", to: "#" },
            ]
          : [
              { label: "Тренинги", to: "/trainings" },
              { label: "Создание", to: "#" },
            ],
      [isEditing, training?.title, id]
    )
  );

  const createMutation = useCreateTraining();
  const updateMutation = useUpdateTraining();
  const syncEmployeesMutation = useSyncTrainingEmployees();
  const saveMaterialsMutation = useSaveTrainingMaterials();

  // Populate form when editing an existing training.
  useEffect(() => {
    if (!isEditing || !training || initializedFromTrainingRef.current) return;

    setTitle(String(training.title || ""));
    setDescription(String(training.description || ""));
    const rawStatus = Array.isArray(training.status)
      ? String(training.status[0] || "draft")
      : String(training.status || "draft");
    setStatus(rawStatus || "draft");
    setStartsAt(toDateInputValue(training.starts_at));
    setEndsAt(toDateInputValue(training.ends_at));
    setLocation(String(training.location || ""));
    setHomeworkRequired(Boolean(training.homework_required));
    setHomeworkDeadline(toDateInputValue(training.homework_deadline));

    const trainerGuid = String(training.user_base_id || "");
    setTrainerId(trainerGuid);
    if (trainerGuid) {
      // Resolve the trainer's name for the select's fallback label.
      getUserBaseById(trainerGuid)
        .then((user) => {
          const fullName = resolveUserFullName(user as Record<string, unknown> | null);
          if (fullName) setTrainerLabel(fullName);
        })
        .catch(() => {});
    }

    initializedFromTrainingRef.current = true;
  }, [isEditing, training]);

  // Populate materials when editing.
  useEffect(() => {
    if (!isEditing || !existingMaterials || initializedMaterialsRef.current) return;
    setMaterials(existingMaterials.map((material) => ({ ...material, localId: nextMaterialId() })));
    initializedMaterialsRef.current = true;
  }, [isEditing, existingMaterials]);

  // Populate assigned employees when editing.
  useEffect(() => {
    if (!isEditing || !trainingEmployees) return;

    const nextIds: string[] = [];
    const labels = new Map<string, string>();

    for (const employee of trainingEmployees.response) {
      if (!employee.user_base_id || labels.has(employee.user_base_id)) continue;
      nextIds.push(employee.user_base_id);
      labels.set(employee.user_base_id, employee.full_name || employee.user_base_id);
    }

    setEmployeeIds(nextIds);
    setEmployeeLabels(labels);
  }, [isEditing, trainingEmployees]);

  const handlePickerApply = (ids: string[], labels: Option[]) => {
    setEmployeeIds(ids);
    setEmployeeLabels((prev) => {
      const next = new Map(prev);
      for (const option of labels) {
        next.set(option.value, option.label);
      }
      return next;
    });
  };

  const removeEmployee = (userBaseId: string) => {
    setEmployeeIds((prev) => prev.filter((id) => id !== userBaseId));
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setUploadingCount((prev) => prev + files.length);
    for (const file of files) {
      try {
        const url = await uploadFileToCdn(file, { folder: "Trainings" });
        setMaterials((prev) => [
          ...prev,
          {
            localId: nextMaterialId(),
            title: file.name,
            material_type: "file",
            url,
            file_name: file.name,
            file_size: file.size,
          },
        ]);
        toast.success(`Файл «${file.name}» загружен.`);
      } catch (error) {
        console.error("Failed to upload training material:", error);
        toast.error(`Не удалось загрузить «${file.name}».`);
      } finally {
        setUploadingCount((prev) => prev - 1);
      }
    }
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    void uploadFiles(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDraggingOver(false);
    void uploadFiles(Array.from(event.dataTransfer.files || []));
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDraggingOver(false);
  };

  const addLinkMaterial = () => {
    const url = linkUrl.trim();
    if (!url) {
      toast.error("Укажите ссылку на материал.");
      return;
    }

    setMaterials((prev) => [
      ...prev,
      {
        localId: nextMaterialId(),
        title: linkTitle.trim() || url,
        material_type: linkType,
        url,
      },
    ]);
    setLinkUrl("");
    setLinkTitle("");
  };

  const removeMaterial = (localId: string) => {
    setMaterials((prev) => prev.filter((material) => material.localId !== localId));
  };

  const updateMaterialTitle = (localId: string, nextTitle: string) => {
    setMaterials((prev) =>
      prev.map((material) =>
        material.localId === localId ? { ...material, title: nextTitle } : material
      )
    );
  };

  const handleMaterialDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setMaterials((prev) => {
      const from = prev.findIndex((material) => material.localId === active.id);
      const to = prev.findIndex((material) => material.localId === over.id);
      if (from < 0 || to < 0) return prev;
      return arrayMove(prev, from, to);
    });
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      toast.error("Название тренинга обязательно.");
      return;
    }

    if (startsAt && endsAt && startsAt > endsAt) {
      toast.error("Дата окончания не может быть раньше даты начала.");
      return;
    }

    const payload = {
      title: trimmedTitle,
      description: description.trim() || null,
      status: [status],
      starts_at: startsAt || null,
      ends_at: endsAt || null,
      user_base_id: trainerId || null,
      location: location.trim() || null,
      homework_required: homeworkRequired,
      homework_deadline: homeworkRequired && homeworkDeadline ? homeworkDeadline : null,
    };

    try {
      let savedGuid: string | null = id || null;

      if (isEditing && id) {
        await updateMutation.mutateAsync({ guid: id, data: payload });
      } else {
        const created = await createMutation.mutateAsync(payload);
        savedGuid = resolveCreatedGuid(created);
      }

      if (!savedGuid) {
        toast.error("Тренинг сохранен, но не удалось определить GUID для назначений.");
        return;
      }

      await Promise.all([
        syncEmployeesMutation.mutateAsync({ trainingGuid: savedGuid, employeeIds }),
        saveMaterialsMutation.mutateAsync({
          trainingGuid: savedGuid,
          materials: materials.map(({ localId: _localId, ...material }) => material),
        }),
      ]);

      toast.success(isEditing ? "Тренинг обновлен." : "Тренинг создан.");
      navigate("/trainings");
    } catch (error) {
      console.error("Failed to save training:", error);
      toast.error("Не удалось сохранить тренинг. Попробуйте еще раз.");
    }
  };

  const isUploading = uploadingCount > 0;
  const isSaving =
    createMutation.isLoading ||
    updateMutation.isLoading ||
    syncEmployeesMutation.isLoading ||
    saveMaterialsMutation.isLoading;

  const menuPortalTarget = typeof document !== "undefined" ? document.body : undefined;
  const selectStyles = getDepartmentSelectStyles();

  return (
    <>
      <PageMeta
        title={isEditing ? "Изменить тренинг | Обучение" : "Новый тренинг | Обучение"}
        description="Конструктор тренинга"
      />

      <div className="space-y-5 pb-24">
        {/* Header banner */}
        <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-6 py-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <GraduationCap size={20} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? "Редактирование тренинга" : "Новый тренинг"}
            </h2>
            <p className="text-sm text-gray-500">
              Заполните данные, добавьте материалы и назначьте сотрудников
            </p>
          </div>
        </div>

        {/* Основное */}
        <div className="rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-6 py-4 text-[15px] font-semibold text-gray-900">
            Основное
          </div>
          <div className="p-6">
            {isEditing && isTrainingLoading ? (
              <div className="py-8 text-center text-sm text-gray-500">Загрузка тренинга...</div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="training-title" className="mb-1.5 block text-sm font-medium text-gray-700">
                      Название <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="training-title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="Введите название тренинга"
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-800 placeholder:text-gray-400 transition focus:border-brand-400 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Статус</label>
                    <Select
                      options={STATUS_OPTIONS}
                      value={STATUS_OPTIONS.find((option) => option.value === status) || STATUS_OPTIONS[0]}
                      onChange={(option) => setStatus(option?.value || "draft")}
                      styles={selectStyles}
                      menuPortalTarget={menuPortalTarget}
                      menuPosition="fixed"
                      classNamePrefix="training-status-select"
                      isSearchable={false}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Дата начала
                    </label>
                    <FormDatePicker
                      value={startsAt || null}
                      onChange={(value) => setStartsAt(value || "")}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Дата окончания
                    </label>
                    <FormDatePicker
                      value={endsAt || null}
                      onChange={(value) => setEndsAt(value || "")}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Тренер (кто проводит)
                    </label>
                    <EmployeeInfiniteSelect
                      value={trainerId}
                      onChange={setTrainerId}
                      fallbackLabel={trainerLabel}
                      placeholder="Выберите сотрудника-тренера"
                      styles={selectStyles}
                      menuPortalTarget={menuPortalTarget}
                      classNamePrefix="training-trainer-select"
                    />
                  </div>

                  <div>
                    <label htmlFor="training-location" className="mb-1.5 block text-sm font-medium text-gray-700">
                      Место проведения
                    </label>
                    <div className="relative">
                      <MapPin
                        size={16}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        id="training-location"
                        value={location}
                        onChange={(event) => setLocation(event.target.value)}
                        placeholder="Например: офис, переговорная 2 / Zoom"
                        className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3.5 text-sm text-gray-800 placeholder:text-gray-400 transition focus:border-brand-400 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label htmlFor="training-description" className="mb-1.5 block text-sm font-medium text-gray-700">
                      Описание
                    </label>
                    <textarea
                      id="training-description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Опишите цели и программу тренинга"
                      rows={4}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 transition focus:border-brand-400 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
                    />
                  </div>
                </div>

                {/* Homework settings */}
                <div className="mt-5 flex flex-wrap items-center gap-6 border-t border-gray-100 pt-5">
                  <Toggle
                    checked={homeworkRequired}
                    onChange={setHomeworkRequired}
                    label="Требуется домашнее задание"
                  />

                  {homeworkRequired && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">Срок сдачи:</span>
                      <div className="w-44">
                        <FormDatePicker
                          value={homeworkDeadline || null}
                          onChange={(value) => setHomeworkDeadline(value || "")}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Employees */}
                <div className="mt-5 border-t border-gray-100 pt-5">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Users size={16} className="text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">
                        Сотрудники, проходящие тренинг
                      </span>
                      <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                        {employeeIds.length}
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      onClick={() => setIsPickerOpen(true)}
                      startIcon={<UserPlus size={14} />}
                      className="h-9 px-3 py-2 text-sm"
                    >
                      Выбрать сотрудников
                    </Button>
                  </div>

                  {employeeIds.length === 0 ? (
                    <p className="rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-400">
                      Сотрудники не выбраны — нажмите «Выбрать сотрудников».
                    </p>
                  ) : (
                    <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-gray-100 p-2">
                      {employeeIds.map((userBaseId) => (
                        <span
                          key={userBaseId}
                          className="inline-flex items-center gap-1 rounded-full bg-gray-100 py-1 pl-2.5 pr-1 text-xs font-medium text-gray-700"
                        >
                          {employeeLabels.get(userBaseId) || userBaseId}
                          <button
                            type="button"
                            onClick={() => removeEmployee(userBaseId)}
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-200 hover:text-gray-600"
                            aria-label="Убрать сотрудника"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Материалы */}
        <div className="rounded-2xl border border-gray-200 bg-white">
          <div className="flex items-center gap-2 border-b border-gray-100 px-6 py-4">
            <span className="text-[15px] font-semibold text-gray-900">Материалы</span>
            <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
              {materials.length}
            </span>
          </div>

          <div className="space-y-4 p-6">
            {/* Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(event) => event.preventDefault()}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
                isDraggingOver
                  ? "border-brand-400 bg-brand-50/60"
                  : "border-gray-200 bg-gray-50/60 hover:border-brand-300 hover:bg-brand-50/40"
              }`}
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
                  isDraggingOver ? "bg-brand-100 text-brand-600" : "bg-white text-gray-400 shadow-sm"
                }`}
              >
                <CloudUpload size={22} className={isUploading ? "animate-pulse" : ""} />
              </span>
              <p className="text-sm font-medium text-gray-700">
                {isUploading
                  ? `Загрузка... (${uploadingCount})`
                  : isDraggingOver
                    ? "Отпустите, чтобы загрузить"
                    : "Перетащите файлы сюда или нажмите, чтобы выбрать"}
              </p>
              <p className="text-xs text-gray-400">
                Презентации, документы, архивы — любой формат
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => handleFilesSelected(event.target.files)}
            />

            {/* Add link/video */}
            <div className="grid grid-cols-1 gap-2 rounded-xl bg-gray-50 p-3 md:grid-cols-[1fr_1fr_140px_auto]">
              <input
                value={linkTitle}
                onChange={(event) => setLinkTitle(event.target.value)}
                placeholder="Название материала"
                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none"
              />
              <input
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") addLinkMaterial();
                }}
                placeholder="https://..."
                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none"
              />
              <Select
                options={LINK_TYPE_OPTIONS}
                value={LINK_TYPE_OPTIONS.find((option) => option.value === linkType) || LINK_TYPE_OPTIONS[0]}
                onChange={(option) => setLinkType((option?.value as TrainingMaterialType) || "link")}
                styles={selectStyles}
                menuPortalTarget={menuPortalTarget}
                menuPosition="fixed"
                classNamePrefix="training-link-type-select"
                isSearchable={false}
              />
              <Button variant="outline" onClick={addLinkMaterial} className="h-10 px-4 text-sm">
                Добавить
              </Button>
            </div>

            {materials.length === 0 ? (
              <p className="rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-400">
                Материалы не добавлены — перетащите файл или добавьте ссылку.
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragEnd={handleMaterialDragEnd}
              >
                <SortableContext
                  items={materials.map((material) => material.localId)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100">
                    {materials.map((material) => (
                      <SortableMaterialRow
                        key={material.localId}
                        material={material}
                        onRemove={() => removeMaterial(material.localId)}
                        onTitleChange={(nextTitle) => updateMaterialTitle(material.localId, nextTitle)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      </div>

      {/* Sticky save bar */}
      <SidebarAwareFixedFooter>
        <span className="text-sm text-gray-500">
          {isEditing ? "Редактирование тренинга" : "Новый тренинг"}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)} className="px-5">
            Отменить
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isUploading} className="px-6">
            {isSaving ? "Сохранение..." : isEditing ? "Сохранить" : "Создать тренинг"}
          </Button>
        </div>
      </SidebarAwareFixedFooter>

      <EmployeePickerModal
        isOpen={isPickerOpen}
        value={employeeIds}
        onClose={() => setIsPickerOpen(false)}
        onApply={handlePickerApply}
      />
    </>
  );
}
