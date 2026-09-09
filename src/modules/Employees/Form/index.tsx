import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router";
import { LayoutGrid, Pencil, RotateCcw, Trash2, User } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import PageMeta from "../../../components/common/PageMeta";
import companyStore from "../../../store/company.store";
import { useCustomFieldsSchema } from "../../Settings/CustomFields/useCustomFieldsSchema";
import { useSalaryPolicy } from "../../Settings/GradeMatrix/useSalaryPolicy";
import type { CustomField } from "../../Settings/CustomFields/types";
import FormLayoutArea from "./layout/FormLayoutArea";
import { dynamicFieldDefault } from "./layout/DynamicFieldControl";
import { useEmployeeFormLayout } from "./layout/useEmployeeFormLayout";
import type { StaticFieldContext } from "./layout/staticFields";
import {
  type Employee,
  useEmployeeQuery,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
} from "../../../api/services/employee.service";
import { Modal } from "../../../components/ui/modal";
import { useUploadFile } from "../../../api/services/file-upload.service";
import { useEmploymentTypesQuery } from "../../../api/services/employmentType.service";
import { useDivisionsQuery } from "../../../api/services/division.service";
import { useExperienceLevelsQuery } from "../../../api/services/experienceLevel.service";
import { useLocationsQuery } from "../../../api/services/location.service";
import { useDepartmentsSettingsQuery } from "../../../api/services/department.service";
import { usePositionsQuery } from "../../../api/services/position.service";
import { useCreateEmployeeWork } from "../../../api/services/employeeWork.service";
import { onboardingTasksService } from "../../../api/services/onboardingTasks.service";
import { useSettingsDirectoryQuery } from "../../../api/services/settingsDirectory.service";
import { useRolesQuery } from "../../../api/services/role.service";
import type { EmployeeFormValues, SelectOption } from "./types";
import { employeeFormDefaults } from "./types";

const EMPLOYEE_WORK_REASON_SLUG = "employee_work_reason";

/* ── Constants ── */
const GENDER_OPTIONS: SelectOption[] = [
  { value: "male_slug", label: "Мужчина" },
  { value: "female_slug", label: "Женщина" },
];

/**
 * Значения динамических полей лежат в контейнере `custom_data`. Поле в u-code
 * имеет тип JSON, а он отдаёт и принимает документ строкой — поэтому на чтении
 * парсим, на записи сериализуем.
 */
const parseCustomData = (raw: unknown): Record<string, unknown> => {
  if (!raw) return {};

  const parsed = typeof raw === "string" ? safeParseJson(raw) : raw;
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
};

function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("Failed to parse custom_data:", error);
    return null;
  }
}

/**
 * Оставляем в payload только значения существующих полей: удалённое поле не
 * должно тащиться в записи сотрудников вечно.
 */
const collectCustomData = (
  values: Record<string, unknown> | undefined,
  fields: CustomField[]
): Record<string, unknown> => {
  const source = values ?? {};
  const result: Record<string, unknown> = {};

  fields.forEach((field) => {
    const value = source[field.key];
    if (value === undefined || value === "" || value === null) return;
    if (Array.isArray(value) && value.length === 0) return;
    result[field.key] = value;
  });

  return result;
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  fontWeight: 500,
  color: "#475569",
  marginBottom: "6px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  fontSize: "14px",
  border: "1px solid #e2e8f0",
  borderRadius: "10px",
  outline: "none",
  color: "#1e293b",
  backgroundColor: "#fff",
  transition: "border-color 0.2s",
  boxSizing: "border-box",
};

/* ─────────────────────────────────────────────
 *  Main component
 * ───────────────────────────────────────────── */
function EmployeeForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;
  const brandColor = companyStore.mainColor;
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  /** Режим конструктора: та же форма, но поля и карточки можно перекладывать. */
  const [builderMode, setBuilderMode] = useState(false);

  /* ── react-hook-form ── */
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState: { isSubmitting, errors },
  } = useForm<EmployeeFormValues>({ defaultValues: employeeFormDefaults });

  const photo = watch("photo");
  const selectedPositionId = watch("positions_id");
  const selectedExperienceLevelId = watch("experience_levels_id");

  /* ── API queries ── */
  const { data: employee, isLoading } = useEmployeeQuery(id || "");
  const { data: departmentsData } = useDepartmentsSettingsQuery({ params: { limit: 200 } });
  const { data: positionsData } = usePositionsQuery({ params: { all: true } });
  const { data: employmentTypesData } = useEmploymentTypesQuery({ params: { limit: 200 } });
  const { data: divisionsData } = useDivisionsQuery({ params: { limit: 200 } });
  const { data: experienceLevelsData } = useExperienceLevelsQuery({ params: { limit: 200 } });
  const { data: locationsData } = useLocationsQuery({ params: { limit: 200 } });
  const { data: employeeWorkReasonsData } = useSettingsDirectoryQuery({
    slug: EMPLOYEE_WORK_REASON_SLUG,
    params: { limit: 200, offset: 0 },
  });
  const departments = departmentsData?.response ?? [];
  const positions = positionsData?.response ?? [];
  const employmentTypes = employmentTypesData?.response ?? [];
  const divisions = divisionsData?.response ?? [];
  const experienceLevels = experienceLevelsData?.response ?? [];
  const locations = locationsData?.response ?? [];
  const employeeWorkReasons = employeeWorkReasonsData?.response ?? [];
  const { data: rolesData } = useRolesQuery();
  const roleOptions: SelectOption[] = (rolesData ?? []).map((role) => ({
    value: role.id,
    label: role.title,
  }));
  const departmentOptions: SelectOption[] = departments.map((d) => ({ value: d.guid, label: d.title }));
  const positionOptions: SelectOption[] = positions.map((p) => ({ value: p.guid, label: String(p.title) }));
  const employmentTypeOptions: SelectOption[] = employmentTypes.map((e) => ({ value: e.guid, label: e.title }));
  const divisionOptions: SelectOption[] = divisions.map((d) => ({ value: d.guid, label: d.title }));
  const selectedPositionGroupId = useMemo(() => {
    if (!selectedPositionId) return null;
    const position = positions.find((item) => item.guid === selectedPositionId);
    return typeof position?.experience_level_groups_id === "string"
      ? position.experience_level_groups_id
      : null;
  }, [positions, selectedPositionId]);

  const allowedExperienceLevelIds = useMemo(() => {
    if (!selectedPositionGroupId) return null;

    const ids = new Set<string>();
    for (const level of experienceLevels) {
      if (level.experience_level_groups_id === selectedPositionGroupId) {
        ids.add(level.guid);
      }
    }
    return ids;
  }, [experienceLevels, selectedPositionGroupId]);

  const experienceLevelOptions: SelectOption[] = experienceLevels
    .filter((level) => !allowedExperienceLevelIds || allowedExperienceLevelIds.has(level.guid))
    .map((e) => ({ value: e.guid, label: e.title }));
  const locationOptions: SelectOption[] = locations.map((l) => ({ value: l.guid, label: l.title }));
  const employeeWorkReasonOptions: SelectOption[] = employeeWorkReasons.map((item) => ({
    value: item.guid,
    label: String(item.title || "Без названия"),
  }));

  /* ── Динамические поля user_base и раскладка формы ── */
  const { schema, getFields } = useCustomFieldsSchema();
  const dynamicFields = useMemo(
    () => getFields("user_base").filter((field) => !field.system),
    [getFields]
  );
  /**
   * Ключ поля-контейнера под значения (`custom_data`), если оно заведено в
   * u-code. Пока его нет, правила полей всё равно проверяются, но значения в
   * payload не кладём — items API всё равно вырежет незнакомый ключ.
   */
  const valuesField = useMemo(
    () => schema.entities.find((entity) => entity.id === "user_base")?.valuesField ?? null,
    [schema.entities]
  );
  const dynamicErrors = useMemo(() => {
    const bag = (errors.custom_data ?? {}) as Record<string, { message?: string }>;
    const map: Record<string, string> = {};

    dynamicFields.forEach((field) => {
      const message = bag[field.key]?.message;
      if (message) map[field.key] = message;
    });

    return map;
  }, [errors.custom_data, dynamicFields]);
  const dynamicFieldIds = useMemo(
    () => dynamicFields.map((field) => field.id),
    [dynamicFields]
  );
  const layoutApi = useEmployeeFormLayout(dynamicFieldIds);

  /**
   * Правки раскладки копятся локально и уходят на сервер одним запросом по
   * «Готово» — из режима конструктора выходим только после успешного сохранения.
   */
  const handleToggleBuilder = async () => {
    if (!builderMode) {
      setBuilderMode(true);
      return;
    }

    try {
      await layoutApi.save();
      setBuilderMode(false);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Не удалось сохранить раскладку формы."
      );
    }
  };

  useEffect(() => {
    if (!selectedExperienceLevelId) {
      return;
    }

    if (allowedExperienceLevelIds && !allowedExperienceLevelIds.has(selectedExperienceLevelId)) {
      setValue("experience_levels_id", "");
    }
  }, [allowedExperienceLevelIds, selectedExperienceLevelId, setValue]);

  const createMutation = useCreateEmployee();
  const createEmployeeWorkMutation = useCreateEmployeeWork();
  // Насколько строго оклад обязан укладываться в матрицу грейдов — настройка
  // компании на странице «Главная».
  const salaryPolicy = useSalaryPolicy();
  const updateMutation = useUpdateEmployee();
  const deleteMutation = useDeleteEmployee();

  /* ── Populate form in edit mode ── */
  useEffect(() => {
    if (employee && isEdit) {
      reset({
        second_name: employee.second_name || "",
        first_name: employee.first_name || "",
        middle_name: employee.middle_name || "",
        birth_date: employee.birth_date ? new Date(employee.birth_date) : null,
        phone: employee.phone || "",
        work_phone: employee.work_phone || "",
        telegram: employee.telegram || "",
        gender: Array.isArray(employee.gender) ? employee.gender[0] || "" : employee.gender || "",
        departments_id: employee.departments_id || "",
        positions_id: employee.positions_id || "",
        date_hire: employee.date_hire ? new Date(employee.date_hire) : null,
        photo: employee.photo || "",
        email: employee.email || "",
        personal_email: employee.personal_email || "",
        employment_types_id: employee.employment_types_id || "",
        experience_levels_id: employee.experience_levels_id || "",
        divisions_id: employee.divisions_id || "",
        locations_id: employee.locations_id || "",
        employee_work_reason_id: "",
        salary: "",
        // hrms_roles_id is a registered ucode field on user_base, so it rides
        // along with the item read/write — no separate lookup needed.
        hrms_roles_id: employee.hrms_roles_id || "",
        custom_data: parseCustomData(employee.custom_data),
      });
    }
  }, [employee, isEdit, reset]);

  // Справочник полей приезжает отдельным запросом: как только он готов,
  // проставляем значения по умолчанию тем полям, которых нет в записи —
  // переключателю нужен false, мультисписку пустой массив, а не undefined.
  useEffect(() => {
    if (dynamicFields.length === 0) return;

    const current = (getValues("custom_data") ?? {}) as Record<string, unknown>;
    dynamicFields.forEach((field) => {
      if (current[field.key] === undefined) {
        setValue(`custom_data.${field.key}` as never, dynamicFieldDefault(field) as never);
      }
    });
  }, [dynamicFields, getValues, setValue]);

  /* ── Photo upload ── */
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadFileMutation = useUploadFile({ folder: "Media", format: "jpg" });

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingPhoto(true);
      const cdnUrl = await uploadFileMutation.mutateAsync(file);
      setValue("photo", cdnUrl);
    } catch (err) {
      console.error("Photo upload error:", err);
      alert("Ошибка при загрузке фото. Попробуйте ещё раз.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  /* ── Submit ── */
  const toISODate = (d: Date | null) => {
    if (!d) return null;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const normalizePhoneForBackend = (value: string | null | undefined) => {
    const raw = String(value || "").trim();
    if (!raw) return null;

    const hasPlus = raw.startsWith("+");
    const digits = raw.replace(/\D/g, "");
    if (!digits) return null;

    return hasPlus ? `+${digits}` : digits;
  };

  const normalizeSalaryForBackend = (value: string | null | undefined) => {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const parsed = Number(raw.replace(/\s+/g, ""));
    if (!Number.isFinite(parsed)) return null;
    return parsed;
  };

  const extractGuidFromCreate = (result: unknown): string => {
    const getRecord = (value: unknown): Record<string, unknown> | null => {
      if (!value || typeof value !== "object") return null;
      return value as Record<string, unknown>;
    };

    const getGuid = (value: unknown): string => {
      return typeof value === "string" ? value : "";
    };

    const root = getRecord(result);
    const response = getRecord(root?.response);
    const data = getRecord(root?.data);
    const dataData = getRecord(data?.data);
    const dataDataResponse = getRecord(dataData?.response);
    const dataResponse = getRecord(data?.response);

    return (
      getGuid(response?.guid) ||
      getGuid(root?.guid) ||
      getGuid(dataDataResponse?.guid) ||
      getGuid(dataResponse?.guid) ||
      getGuid(dataData?.guid) ||
      getGuid(data?.guid) ||
      ""
    );
  };

  const onSubmit = async (data: EmployeeFormValues) => {
    const normalizedEmail = data.email.trim();

    // Уровень и оклад против матрицы грейдов. Здесь запись создаётся сразу, без
    // гейта с подтверждением, поэтому в мягком режиме предупреждаем и сохраняем,
    // а в строгом — не даём сохранить вовсе.
    const gradeCheck = salaryPolicy.check({
      positionId: data.positions_id,
      levelId: data.experience_levels_id,
      salary: normalizeSalaryForBackend(data.salary),
    });
    if (gradeCheck.status === "mismatch") {
      const message = gradeCheck.issues.map((issue) => issue.message).join(" ");
      if (salaryPolicy.isBlocking) {
        toast.error(message);
        return;
      }
      toast.warning(message);
    }

    const payload: Partial<Employee> = {
      second_name: data.second_name,
      first_name: data.first_name,
      middle_name: data.middle_name,
      birth_date: toISODate(data.birth_date),
      phone: normalizePhoneForBackend(data.phone),
      work_phone: normalizePhoneForBackend(data.work_phone),
      telegram: data.telegram || null,
      gender: data.gender ? [data.gender] : [],
      departments_id: data.departments_id || null,
      positions_id: data.positions_id || null,
      date_hire: toISODate(data.date_hire),
      status: ["active"],
      photo: data.photo || null,
      email: normalizedEmail || null,
      login: normalizedEmail || null,
      personal_email: data.personal_email || null,
      employment_types_id: data.employment_types_id || null,
      experience_levels_id: data.experience_levels_id || null,
      divisions_id: data.divisions_id || null,
      locations_id: data.locations_id || null,
      // Registered ucode field — persists directly through the items API.
      hrms_roles_id: data.hrms_roles_id || null,
    };

    // Значения динамических полей едут тем же запросом, но только если контейнер
    // заведён в u-code: иначе items API просто выкинет незнакомый ключ.
    if (valuesField) {
      payload.custom_data = JSON.stringify(
        collectCustomData(data.custom_data, dynamicFields)
      );
    }

    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ ...payload, guid: id || "" });
      } else {
        payload.client_type_id = "1c435896-2f12-4b61-a684-62ad1d2307d1";
        payload.role_id = import.meta.env.VITE_EMPLOYEE_ROLE_ID;
        const createResult = await createMutation.mutateAsync(payload);
        const createdEmployeeGuid = extractGuidFromCreate(createResult);

        if (createdEmployeeGuid) {
          await createEmployeeWorkMutation.mutateAsync({
            user_base_id: createdEmployeeGuid,
            employment_types_id: data.employment_types_id || null,
            departments_id: data.departments_id || null,
            divisions_id: data.divisions_id || null,
            locations_id: data.locations_id || null,
            positions_id: data.positions_id || null,
            experience_levels_id: data.experience_levels_id || null,
            employee_work_reason_id: data.employee_work_reason_id || null,
            salary: normalizeSalaryForBackend(data.salary),
            date_from: toISODate(data.date_hire) || toISODate(new Date()),
            date_to: null,
          });

          try {
            const onboardingResult = await onboardingTasksService.createForEmployee(createdEmployeeGuid);
            if (onboardingResult.status === "created") {
              toast.success(`Onboarding yaratildi: ${onboardingResult.createdParents} ta task, ${onboardingResult.createdSubtasks} ta subtask`);
            } else if (onboardingResult.reason === "manager_not_configured") {
              toast.warning("Xodim yaratildi, lekin bo‘limda bevosita rahbar belgilanmagan.");
            }
          } catch (onboardingError) {
            console.error("Failed to create onboarding tasks:", onboardingError);
            toast.warning("Xodim yaratildi, lekin onboarding vazifalarini yaratib bo‘lmadi. Qayta urinib ko‘ring.");
          }
        }
      }
      navigate("/employees");
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteMutation.mutateAsync(id);
      setIsDeleteModalOpen(false);
      navigate("/employees");
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  const focusHandlers = {
    onFocus: (e: React.FocusEvent<HTMLInputElement>) =>
      (e.currentTarget.style.borderColor = brandColor),
    onBlur: (e: React.FocusEvent<HTMLInputElement>) =>
      (e.currentTarget.style.borderColor = "#e2e8f0"),
  };

  const renderPhoto = () => (
    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
      <div
        style={{
          width: "72px", height: "72px", borderRadius: "50%",
          border: "2px dashed #e2e8f0", backgroundColor: "#f8fafc",
          overflow: "hidden", display: "flex", alignItems: "center",
          justifyContent: "center", flexShrink: 0,
        }}
      >
        {uploadingPhoto ? (
          <div style={{ width: "24px", height: "24px", borderRadius: "50%", border: "2px solid #e2e8f0", borderTopColor: brandColor, animation: "spin 0.8s linear infinite" }} />
        ) : photo ? (
          <img src={photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <User style={{ width: "28px", height: "28px", color: "#94a3b8" }} />
        )}
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          type="button"
          onClick={() => !uploadingPhoto && fileInputRef.current?.click()}
          disabled={uploadingPhoto}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "8px 16px", fontSize: "13px", fontWeight: 500,
            color: "#475569", backgroundColor: "#fff",
            border: "1px solid #e2e8f0", borderRadius: "8px",
            cursor: uploadingPhoto ? "default" : "pointer",
            opacity: uploadingPhoto ? 0.5 : 1,
          }}
        >
          <Pencil style={{ width: "14px", height: "14px" }} />
          Изменить фото
        </button>
        {photo && (
          <button
            type="button"
            onClick={() => setValue("photo", "")}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "36px", height: "36px",
              border: "1px solid #e2e8f0", borderRadius: "8px",
              backgroundColor: "#fff", color: "#94a3b8", cursor: "pointer",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#ef4444")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
          >
            <Trash2 style={{ width: "14px", height: "14px" }} />
          </button>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoChange} />
    </div>
  );

  const fieldContext: StaticFieldContext = {
    register,
    control,
    brandColor,
    inputStyle,
    focusHandlers,
    options: {
      gender: GENDER_OPTIONS,
      roles: roleOptions,
      employmentTypes: employmentTypeOptions,
      positions: positionOptions,
      employeeWorkReasons: employeeWorkReasonOptions,
      departments: departmentOptions,
      experienceLevels: experienceLevelOptions,
      divisions: divisionOptions,
      locations: locationOptions,
    },
    experienceLevelPlaceholder: selectedPositionGroupId
      ? "Выберите уровень"
      : "Сначала выберите должность",
    renderPhoto,
  };


  if (isEdit && isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            border: "3px solid #e2e8f0",
            borderTopColor: brandColor,
            animation: "spin 0.8s linear infinite",
          }}
        />
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title={isEdit ? "Редактировать сотрудника | HRMS" : "Добавить сотрудника | HRMS"}
        description={isEdit ? "Редактирование сотрудника" : "Добавление нового сотрудника"}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "20px",
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: "#0f172a" }}>
              {builderMode ? "Настройка формы" : isEdit ? "Редактирование сотрудника" : "Новый сотрудник"}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#94a3b8" }}>
              {builderMode
                ? "Поля переносятся перетаскиванием, ширина — за правый край плитки. Изменения сохранятся по кнопке «Готово»."
                : "Расположение полей настраивается кнопкой «Настроить форму»."}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {builderMode && (
              <button
                type="button"
                onClick={layoutApi.resetLayout}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "8px 14px", fontSize: "13px", fontWeight: 500,
                  color: "#475569", backgroundColor: "#fff",
                  border: "1px solid #e2e8f0", borderRadius: "10px", cursor: "pointer",
                }}
              >
                <RotateCcw style={{ width: "14px", height: "14px" }} />
                Сбросить раскладку
              </button>
            )}
            <button
              type="button"
              disabled={layoutApi.isSaving}
              onClick={handleToggleBuilder}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "8px 14px", fontSize: "13px", fontWeight: 500,
                color: builderMode ? "#fff" : "#475569",
                backgroundColor: builderMode ? brandColor : "#fff",
                border: `1px solid ${builderMode ? brandColor : "#e2e8f0"}`,
                borderRadius: "10px",
                cursor: layoutApi.isSaving ? "default" : "pointer",
                opacity: layoutApi.isSaving ? 0.6 : 1,
              }}
            >
              <LayoutGrid style={{ width: "14px", height: "14px" }} />
              {builderMode ? (layoutApi.isSaving ? "Сохраняем..." : "Готово") : "Настроить форму"}
            </button>
          </div>
        </div>

        <FormLayoutArea
          layoutApi={layoutApi}
          dynamicFields={dynamicFields}
          dynamicErrors={dynamicErrors}
          fieldContext={fieldContext}
          builderMode={builderMode}
          isEdit={isEdit}
          labelStyle={labelStyle}
          inputStyle={inputStyle}
          brandColor={brandColor}
        />

        {/* В конструкторе форма не сохраняется — только раскладка. */}
        <div
          style={{
            display: builderMode ? "none" : "flex",
            justifyContent: "flex-end",
            gap: "12px",
            marginTop: "24px",
            paddingBottom: "40px",
          }}
        >
          {isEdit && (
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              style={{
                padding: "10px 24px", fontSize: "14px", fontWeight: 500,
                color: "#ef4444", backgroundColor: "#fef2f2",
                border: "1px solid #fee2e2", borderRadius: "10px",
                cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fee2e2")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#fef2f2")}
            >
              Удалить
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              padding: "10px 24px", fontSize: "14px", fontWeight: 500,
              color: "#475569", backgroundColor: "#fff",
              border: "1px solid #e2e8f0", borderRadius: "10px",
              cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#fff")}
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: "10px 32px", fontSize: "14px", fontWeight: 600,
              color: "#fff", backgroundColor: brandColor,
              border: "none", borderRadius: "10px",
              cursor: isSubmitting ? "default" : "pointer",
              opacity: isSubmitting ? 0.6 : 1, transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => !isSubmitting && (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={(e) => !isSubmitting && (e.currentTarget.style.opacity = "1")}
          >
            {isSubmitting ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </form>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} showCloseButton={false} className="max-w-md w-full p-6">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-6">
            <Trash2 className="h-8 w-8 text-red-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Удалить сотрудника?</h3>
          <p className="text-sm text-gray-500 mb-8">
            Это действие нельзя отменить. Все данные сотрудника будут удалены из системы навсегда.
          </p>
          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isLoading}
              className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition-colors cursor-pointer flex justify-center items-center"
            >
              {deleteMutation.isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                "Удалить"
              )}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default observer(EmployeeForm);
