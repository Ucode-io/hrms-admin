import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router";
import { Pencil, Trash2, User, ChevronLeft } from "lucide-react";
import DatePicker from "react-datepicker";
import { InputMask } from "@react-input/mask";
import { observer } from "mobx-react-lite";
import { useForm, Controller } from "react-hook-form";
import PageMeta from "../../../components/common/PageMeta";
import SearchableSelect from "../../../components/ui/searchable-select";
import companyStore from "../../../store/company.store";
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
import { useDepartmentExperienceLevelsSummaryQuery } from "../../../api/services/departmentExperienceLevel.service";
import { usePositionsQuery } from "../../../api/services/position.service";
import { useCreateEmployeeWork } from "../../../api/services/employeeWork.service";
import { useSettingsDirectoryQuery } from "../../../api/services/settingsDirectory.service";
import type { EmployeeFormValues, SelectOption } from "./types";
import { employeeFormDefaults } from "./types";

const EMPLOYEE_WORK_REASON_SLUG = "employee_work_reason";

/* ── Constants ── */
const GENDER_OPTIONS: SelectOption[] = [
  { value: "male_slug", label: "Мужчина" },
  { value: "female_slug", label: "Женщина" },
];

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

  /* ── react-hook-form ── */
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<EmployeeFormValues>({ defaultValues: employeeFormDefaults });

  const photo = watch("photo");
  const selectedDepartmentId = watch("departments_id");
  const selectedExperienceLevelId = watch("experience_levels_id");

  /* ── API queries ── */
  const { data: employee, isLoading } = useEmployeeQuery(id || "");
  const { data: departmentsData } = useDepartmentsSettingsQuery({ params: { limit: 200 } });
  const { data: positionsData } = usePositionsQuery({ params: { limit: 200 } });
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
  const departmentIds = useMemo(
    () => departments.map((department) => department.guid),
    [departments]
  );
  const { data: departmentExperienceLevelsSummary } = useDepartmentExperienceLevelsSummaryQuery({
    departmentIds,
  });

  const departmentOptions: SelectOption[] = departments.map((d) => ({ value: d.guid, label: d.title }));
  const positionOptions: SelectOption[] = positions.map((p) => ({ value: p.guid, label: String(p.title) }));
  const employmentTypeOptions: SelectOption[] = employmentTypes.map((e) => ({ value: e.guid, label: e.title }));
  const divisionOptions: SelectOption[] = divisions.map((d) => ({ value: d.guid, label: d.title }));
  const allowedExperienceLevelIds = useMemo(() => {
    if (!selectedDepartmentId) return null;

    const ids = new Set<string>();
    for (const row of departmentExperienceLevelsSummary?.response || []) {
      if (row.departments_id === selectedDepartmentId && row.experience_levels_id) {
        ids.add(row.experience_levels_id);
      }
    }
    return ids;
  }, [departmentExperienceLevelsSummary?.response, selectedDepartmentId]);

  const experienceLevelOptions: SelectOption[] = experienceLevels
    .filter((level) => !allowedExperienceLevelIds || allowedExperienceLevelIds.has(level.guid))
    .map((e) => ({ value: e.guid, label: e.title }));
  const locationOptions: SelectOption[] = locations.map((l) => ({ value: l.guid, label: l.title }));
  const employeeWorkReasonOptions: SelectOption[] = employeeWorkReasons.map((item) => ({
    value: item.guid,
    label: String(item.title || "Без названия"),
  }));

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
      });
    }
  }, [employee, isEdit, reset]);

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
    };

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

      {/* Back + Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "36px", height: "36px",
            border: "1px solid #e2e8f0", borderRadius: "10px",
            backgroundColor: "#fff", color: "#475569", cursor: "pointer",
          }}
        >
          <ChevronLeft style={{ width: "18px", height: "18px" }} />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
          <span style={{ color: brandColor, cursor: "pointer" }} onClick={() => navigate("/employees")}>
            Сотрудники
          </span>
          <span style={{ color: "#cbd5e1" }}>/</span>
          <span style={{ color: "#1e293b", fontWeight: 500 }}>
            {isEdit ? "Редактировать" : "Добавить сотрудника"}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isEdit ? "1fr" : "1fr 400px",
            gap: "20px",
            alignItems: "start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* ─── Left: Личное ─── */}
            <div style={{ borderRadius: "14px", border: "1px solid #e2e8f0", backgroundColor: "#fff" }}>
              <div style={{ padding: "18px 24px", borderBottom: "1px solid #f1f5f9", fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                Личное
              </div>

              <div style={{ padding: "24px" }}>
                {/* Photo */}
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "28px" }}>
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

                {/* Fields */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 24px" }}>
                  <div>
                    <label style={labelStyle}>Фамилия *</label>
                    <input {...register("second_name", { required: true })} type="text" placeholder="Введите фамилию" style={inputStyle} {...focusHandlers} />
                  </div>
                  <div>
                    <label style={labelStyle}>Имя *</label>
                    <input {...register("first_name", { required: true })} type="text" placeholder="Введите имя" style={inputStyle} {...focusHandlers} />
                  </div>
                  <div>
                    <label style={labelStyle}>Отчество</label>
                    <input {...register("middle_name")} type="text" placeholder="Введите отчество" style={inputStyle} {...focusHandlers} />
                  </div>
                  <div>
                    <label style={labelStyle}>Дата рождения</label>
                    <Controller
                      control={control}
                      name="birth_date"
                      render={({ field }) => (
                        <DatePicker
                          selected={field.value}
                          onChange={field.onChange}
                          dateFormat="dd.MM.yyyy"
                          placeholderText="дд.мм.гггг"
                          showYearDropdown
                          showMonthDropdown
                          dropdownMode="select"
                          maxDate={new Date()}
                          className="employee-form-datepicker"
                          wrapperClassName="employee-form-datepicker-wrapper"
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Пол</label>
                    <Controller
                      control={control}
                      name="gender"
                      render={({ field }) => (
                        <SearchableSelect
                          options={GENDER_OPTIONS}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Выберите пол"
                          brandColor={brandColor}
                        />
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Left: Контакты ─── */}
            <div style={{ borderRadius: "14px", border: "1px solid #e2e8f0", backgroundColor: "#fff" }}>
              <div style={{ padding: "18px 24px", borderBottom: "1px solid #f1f5f9", fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                Контакты
              </div>

              <div style={{ padding: "24px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 24px" }}>
                  <div>
                    <label style={labelStyle}>Эл. почта *</label>
                    <input
                      {...register("email", { required: true })}
                      type="email"
                      placeholder="example@company.uz"
                      style={inputStyle}
                      {...focusHandlers}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Личная эл. почта</label>
                    <input {...register("personal_email")} type="email" placeholder="example@mail.com" style={inputStyle} {...focusHandlers} />
                  </div>

                  <div>
                    <label style={labelStyle}>Мобильный телефон</label>
                    <Controller
                      control={control}
                      name="phone"
                      render={({ field }) => (
                        <InputMask
                          mask="+___ __ ___ __ __"
                          replacement={{ _: /\d/ }}
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          placeholder="+998 ** *** ** **"
                          style={inputStyle}
                          onFocus={(e) => (e.currentTarget.style.borderColor = brandColor)}
                          onBlur={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
                        />
                      )}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Рабочий телефон</label>
                    <Controller
                      control={control}
                      name="work_phone"
                      render={({ field }) => (
                        <InputMask
                          mask="+___ __ ___ __ __"
                          replacement={{ _: /\d/ }}
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          placeholder="+998 ** *** ** **"
                          style={inputStyle}
                          onFocus={(e) => (e.currentTarget.style.borderColor = brandColor)}
                          onBlur={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
                        />
                      )}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Телеграм</label>
                    <input
                      {...register("telegram")}
                      type="text"
                      placeholder="@username"
                      style={inputStyle}
                      {...focusHandlers}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {!isEdit && (
            <div style={{ borderRadius: "14px", border: "1px solid #e2e8f0", backgroundColor: "#fff" }}>
              <div style={{ padding: "18px 24px", borderBottom: "1px solid #f1f5f9", fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                Рабочие данные
              </div>

              <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
                <div>
                  <label style={labelStyle}>Дата начала</label>
                  <Controller
                    control={control}
                    name="date_hire"
                    render={({ field }) => (
                      <DatePicker
                        selected={field.value}
                        onChange={field.onChange}
                        dateFormat="dd.MM.yyyy"
                        placeholderText="дд.мм.гггг"
                        showYearDropdown
                        showMonthDropdown
                        dropdownMode="select"
                        className="employee-form-datepicker"
                        wrapperClassName="employee-form-datepicker-wrapper"
                      />
                    )}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Тип работы</label>
                  <Controller
                    control={control}
                    name="employment_types_id"
                    render={({ field }) => (
                      <SearchableSelect options={employmentTypeOptions} value={field.value} onChange={field.onChange} placeholder="Выберите тип" brandColor={brandColor} />
                    )}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Должность</label>
                  <Controller
                    control={control}
                    name="positions_id"
                    render={({ field }) => (
                      <SearchableSelect options={positionOptions} value={field.value} onChange={field.onChange} placeholder="Выберите должность" brandColor={brandColor} />
                    )}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Причина изменения</label>
                  <Controller
                    control={control}
                    name="employee_work_reason_id"
                    render={({ field }) => (
                      <SearchableSelect
                        options={employeeWorkReasonOptions}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Выберите причину"
                        brandColor={brandColor}
                      />
                    )}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Оклад</label>
                  <input
                    {...register("salary")}
                    type="number"
                    min={0}
                    placeholder="Например: 15000000"
                    style={inputStyle}
                    {...focusHandlers}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Департамент</label>
                  <Controller
                    control={control}
                    name="departments_id"
                    render={({ field }) => (
                      <SearchableSelect options={departmentOptions} value={field.value} onChange={field.onChange} placeholder="Выберите департамент" brandColor={brandColor} />
                    )}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Уровень</label>
                  <Controller
                    control={control}
                    name="experience_levels_id"
                    render={({ field }) => (
                      <SearchableSelect
                        options={experienceLevelOptions}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder={
                          selectedDepartmentId
                            ? "Выберите уровень"
                            : "Сначала выберите департамент"
                        }
                        brandColor={brandColor}
                      />
                    )}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Подразделение</label>
                  <Controller
                    control={control}
                    name="divisions_id"
                    render={({ field }) => (
                      <SearchableSelect options={divisionOptions} value={field.value} onChange={field.onChange} placeholder="Выберите подразделение" brandColor={brandColor} />
                    )}
                  />
                </div>

                <div>
                  <label style={labelStyle}>Локация</label>
                  <Controller
                    control={control}
                    name="locations_id"
                    render={({ field }) => (
                      <SearchableSelect options={locationOptions} value={field.value} onChange={field.onChange} placeholder="Выберите локацию" brandColor={brandColor} />
                    )}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "24px", paddingBottom: "40px" }}>
          {/* <div style={{ flex: 1 }}> */}
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
          {/* </div> */}
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
