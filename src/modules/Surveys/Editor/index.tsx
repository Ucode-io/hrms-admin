import { useEffect, useMemo, useRef, useState } from "react";

import { ClipboardList, UserPlus, Users, X } from "lucide-react";
import Select from "react-select";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { SurveyCreator, SurveyCreatorComponent } from "survey-creator-react";
import "survey-core/survey-core.css";
import "survey-creator-core/survey-creator-core.css";
import "survey-core/i18n/russian";
import "survey-creator-core/i18n/russian";
import { applySurveyCreatorPatches } from "./surveyCreatorPatches";
import { useTranslation } from "../../../i18n";

applySurveyCreatorPatches();

import PageMeta from "../../../components/common/PageMeta";
import { useHeaderBreadcrumbItems } from "../../../context/HeaderBreadcrumbContext";
import Button from "../../../components/ui/button/Button";
import SidebarAwareFixedFooter from "../../../components/layout/SidebarAwareFixedFooter";
import { getDepartmentSelectStyles } from "../../Settings/Departments/utils";
import EmployeePickerModal from "./EmployeePickerModal";
import {
  parseSurveyBody,
  serializeSurveyBody,
  useCreateSurvey,
  useSurveyQuery,
  useUpdateSurvey,
} from "../../../api/services/survey.service";
import {
  useSurveyEmployeesQuery,
  useSyncSurveyEmployees,
} from "../../../api/services/surveyEmployee.service";

type Option = {
  value: string;
  label: string;
};

const STATUS_OPTIONS: Option[] = [
  { value: "draft", label: "Черновик" },
  { value: "active", label: "Активный" },
  { value: "archived", label: "Архив" },
];

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

export default function SurveyEditorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);

  const [surveyTitle, setSurveyTitle] = useState("");
  const [surveyStatus, setSurveyStatus] = useState("draft");
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [employeeLabels, setEmployeeLabels] = useState<Map<string, string>>(new Map());
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const initializedFromSurveyRef = useRef(false);

  const creator = useState(() => {
    const instance = new SurveyCreator({
      showLogicTab: true,
      showJSONEditorTab: true,
      showThemeTab: false,
      isAutoSave: false,
    });
    instance.locale = "ru";
    return instance;
  })[0];

  const { data: survey, isLoading: isSurveyLoading } = useSurveyQuery(id || "");
  const { data: surveyEmployees } = useSurveyEmployeesQuery(id || "");

  useHeaderBreadcrumbItems(
    useMemo(
      () =>
        isEditing
          ? [
              { label: "Опросники", to: "/surveys" },
              { label: String(survey?.title || "Детали"), to: `/surveys/${id}` },
              { label: "Редактирование", to: "#" },
            ]
          : [
              { label: "Опросники", to: "/surveys" },
              { label: "Создание", to: "#" },
            ],
      [isEditing, survey?.title, id]
    )
  );

  const createMutation = useCreateSurvey();
  const updateMutation = useUpdateSurvey();
  const syncEmployeesMutation = useSyncSurveyEmployees();

  // Populate form when editing an existing survey.
  useEffect(() => {
    if (!isEditing || !survey || initializedFromSurveyRef.current) return;

    setSurveyTitle(String(survey.title || ""));
    const rawStatus = Array.isArray(survey.status)
      ? String(survey.status[0] || "draft")
      : String(survey.status || "draft");
    setSurveyStatus(rawStatus || "draft");
    creator.JSON = parseSurveyBody(survey.body);
    initializedFromSurveyRef.current = true;
  }, [creator, isEditing, survey]);

  // Populate assigned employees when editing.
  useEffect(() => {
    if (!isEditing || !surveyEmployees) return;

    const nextIds: string[] = [];
    const labels = new Map<string, string>();

    for (const employee of surveyEmployees.response) {
      if (!employee.user_base_id || labels.has(employee.user_base_id)) continue;
      nextIds.push(employee.user_base_id);
      labels.set(employee.user_base_id, employee.full_name || employee.user_base_id);
    }

    setEmployeeIds(nextIds);
    setEmployeeLabels(labels);
  }, [isEditing, surveyEmployees]);

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

  const handleSave = async () => {
    const title = surveyTitle.trim();

    if (!title) {
      toast.error("Название опросника обязательно.");
      return;
    }

    const body = serializeSurveyBody(creator.JSON);

    try {
      let savedGuid: string | null = id || null;

      if (isEditing && id) {
        await updateMutation.mutateAsync({
          guid: id,
          data: {
            title,
            status: [surveyStatus],
            body,
          },
        });
      } else {
        const created = await createMutation.mutateAsync({
          title,
          status: [surveyStatus],
          body,
        });
        savedGuid = resolveCreatedGuid(created);
      }

      if (!savedGuid) {
        toast.error("Опросник сохранен, но не удалось определить GUID для назначения сотрудников.");
        return;
      }

      await syncEmployeesMutation.mutateAsync({
        surveyGuid: savedGuid,
        employeeIds,
      });

      toast.success(isEditing ? "Опросник обновлен." : "Опросник создан.");
      navigate("/surveys");
    } catch (error) {
      console.error("Failed to save survey:", error);
      toast.error("Не удалось сохранить опросник. Попробуйте еще раз.");
    }
  };

  const isSaving =
    createMutation.isLoading || updateMutation.isLoading || syncEmployeesMutation.isLoading;

  const menuPortalTarget = typeof document !== "undefined" ? document.body : undefined;

  return (
    <>
      <PageMeta
        title={isEditing ? "Изменить опросник | Настройки" : "Новый опросник | Настройки"}
        description="Конструктор опросника"
      />

      <div className="space-y-5 pb-24">
        {/* Header banner */}
        <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-6 py-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <ClipboardList size={20} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? "Редактирование опросника" : "Новый опросник"}
            </h2>
            <p className="text-sm text-gray-500">Заполните данные и настройте вопросы</p>
          </div>
        </div>

        {/* Основное */}
        <div className="rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-6 py-4 text-[15px] font-semibold text-gray-900">
            Основное
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="survey-title" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Название <span className="text-rose-500">*</span>
                </label>
                <input
                  id="survey-title"
                  value={surveyTitle}
                  onChange={(event) => setSurveyTitle(event.target.value)}
                  placeholder="Введите название опросника"
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-800 placeholder:text-gray-400 transition focus:border-brand-400 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Статус</label>
                <Select
                  options={STATUS_OPTIONS}
                  value={STATUS_OPTIONS.find((option) => option.value === surveyStatus) || STATUS_OPTIONS[0]}
                  onChange={(option) => setSurveyStatus(option?.value || "draft")}
                  styles={getDepartmentSelectStyles()}
                  menuPortalTarget={menuPortalTarget}
                  menuPosition="fixed"
                  classNamePrefix="survey-status-select"
                  isSearchable={false}
                />
              </div>
            </div>

            <div className="mt-5 border-t border-gray-100 pt-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    Сотрудники, проходящие опросник
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
          </div>
        </div>

        {/* Конструктор */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-6 py-4 text-[15px] font-semibold text-gray-900">
            Вопросы
          </div>
          <div className="h-[calc(100vh-12rem)]">
            {isEditing && isSurveyLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-gray-500">
                Загрузка опросника...
              </div>
            ) : (
              <SurveyCreatorComponent creator={creator} />
            )}
          </div>
        </div>
      </div>

      {/* Sticky save bar */}
      <SidebarAwareFixedFooter>
        <span className="text-sm text-gray-500">
          {isEditing ? "Редактирование опросника" : "Новый опросник"}
        </span>
        <div className="ml-auto flex items-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)} className="px-5">
            Отменить
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="px-6">
            {isSaving ? "Сохранение..." : isEditing ? "Сохранить" : "Создать опросник"}
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
