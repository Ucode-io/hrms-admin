import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import { Pencil, Trash2, User, ChevronDown } from "lucide-react";
import DatePicker from "react-datepicker";
import { InputMask } from "@react-input/mask";
import PageMeta from "../../../components/common/PageMeta";
import {
  useEmployeeQuery,
  useCreateEmployee,
  useUpdateEmployee,
  useDepartmentsQuery,
  useJobTitlesQuery,
} from "../../../api/services/employee.service";
import { useUploadFile } from "../../../api/services/file-upload.service";

const GENDER_OPTIONS = [
  { value: "male", label: "Мужчина" },
  { value: "female", label: "Женщина" },
];

const STATUS_OPTIONS = [
  { value: "true", label: "Активный" },
  { value: "false", label: "Неактивный" },
];

interface FormData {
  surname: string;
  first_name: string;
  second_name: string;
  birth_date: Date | null;
  phone: string;
  gender: string;
  departments_id: string;
  job_titles_id: string;
  date_hire: Date | null;
  status: string;
  foto: string;
}

const initialForm: FormData = {
  surname: "",
  first_name: "",
  second_name: "",
  birth_date: null,
  phone: "",
  gender: "",
  departments_id: "",
  job_titles_id: "",
  date_hire: null,
  status: "true",
  foto: "",
};

const inputClass =
  "w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#B38D80]/30 focus:border-[#B38D80]";
const selectClass =
  "w-full appearance-none rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#B38D80]/30 focus:border-[#B38D80] cursor-pointer bg-white";

export default function EmployeeForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { data: employee, isLoading } = useEmployeeQuery(id || "");
  const { data: departments = [] } = useDepartmentsQuery();
  const { data: jobTitles = [] } = useJobTitlesQuery();
  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();

  const [form, setForm] = useState<FormData>(initialForm);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadFileMutation = useUploadFile({ folder: "Media", format: "jpg" });

  // Populate form on edit
  useEffect(() => {
    if (employee && isEdit) {
      setForm({
        surname: employee.surname || "",
        first_name: employee.first_name || "",
        second_name: employee.second_name || "",
        birth_date: employee.birth_date ? new Date(employee.birth_date) : null,
        phone: employee.phone || "",
        gender: Array.isArray(employee.gender) ? employee.gender[0] || "" : employee.gender || "",
        departments_id: employee.departments_id || "",
        job_titles_id: employee.job_titles_id || "",
        date_hire: employee.date_hire ? new Date(employee.date_hire) : null,
        status: String(employee.status ?? "true"),
        foto: employee.foto || "",
      });
    }
  }, [employee, isEdit]);

  const handleChange = (field: keyof FormData, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingPhoto(true);
      const cdnUrl = await uploadFileMutation.mutateAsync(file);
      handleChange("foto", cdnUrl);
    } catch (err) {
      console.error("Photo upload error:", err);
      alert("Ошибка при загрузке фото. Попробуйте ещё раз.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => handleChange("foto", "");

  const toISODate = (d: Date | null) => {
    if (!d) return null;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        surname: form.surname,
        first_name: form.first_name,
        second_name: form.second_name,
        birth_date: toISODate(form.birth_date),
        phone: form.phone,
        gender: form.gender ? [form.gender] : [],
        departments_id: form.departments_id || null,
        job_titles_id: form.job_titles_id || null,
        date_hire: toISODate(form.date_hire),
        status: form.status === "true",
        foto: form.foto || null,
      };

      if (isEdit) {
        await updateMutation.mutateAsync({ ...payload, guid: id } as any);
      } else {
        await createMutation.mutateAsync(payload);
      }
      navigate("/organization/employees");
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  if (isEdit && isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#B38D80]" />
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title={isEdit ? "Редактировать сотрудника | NSTEX" : "Добавить сотрудника | NSTEX"}
        description={isEdit ? "Редактирование сотрудника" : "Добавление нового сотрудника"}
      />

      {/* Back button */}
      <div className="mb-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Назад
        </button>
      </div>

      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm">
        <span className="text-[#B38D80]">Сотрудники</span>
        <span className="text-gray-400">/</span>
        <span className="text-gray-800 font-medium">
          {isEdit ? "Редактировать сотрудника" : "Добавить сотрудника"}
        </span>
      </div>

      {/* Form Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8">
        {/* Photo Section */}
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-gray-300 bg-gray-50 overflow-hidden relative">
            {uploadingPhoto ? (
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-[#B38D80]" />
            ) : form.foto ? (
              <img src={form.foto} alt="" className="h-full w-full object-cover rounded-full" />
            ) : (
              <User className="w-8 h-8 text-gray-400" />
            )}
          </div>
          <button
            onClick={() => !uploadingPhoto && fileInputRef.current?.click()}
            disabled={uploadingPhoto}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Pencil className="w-4 h-4" />
            Изменить фото
          </button>
          {form.foto && (
            <button
              onClick={handleRemovePhoto}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-red-500 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
          {/* Фамилия */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Фамилия</label>
            <input
              type="text"
              value={form.surname}
              onChange={(e) => handleChange("surname", e.target.value)}
              placeholder="Введите фамилию"
              className={inputClass}
            />
          </div>

          {/* Имя */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Имя</label>
            <input
              type="text"
              value={form.first_name}
              onChange={(e) => handleChange("first_name", e.target.value)}
              placeholder="Введите имя"
              className={inputClass}
            />
          </div>

          {/* Отчество */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Отчество</label>
            <input
              type="text"
              value={form.second_name}
              onChange={(e) => handleChange("second_name", e.target.value)}
              placeholder="Введите отчество"
              className={inputClass}
            />
          </div>

          {/* Дата рождения */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Дата рождения</label>
            <DatePicker
              selected={form.birth_date}
              onChange={(date: Date | null) => handleChange("birth_date", date)}
              dateFormat="dd.MM.yyyy"
              placeholderText="дд.мм.гггг"
              showYearDropdown
              showMonthDropdown
              dropdownMode="select"
              maxDate={new Date()}
              className={inputClass}
              calendarClassName="nstex-datepicker"
              wrapperClassName="w-full"
            />
          </div>

          {/* Номер телефона */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Номер телефона</label>
            <InputMask
              mask="+___ __ ___ __ __"
              replacement={{ _: /\d/ }}
              value={form.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              placeholder="+998 ** *** ** **"
              className={inputClass}
            />
          </div>

          {/* Пол */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Пол</label>
            <div className="relative">
              <select
                value={form.gender}
                onChange={(e) => handleChange("gender", e.target.value)}
                className={selectClass}
              >
                <option value="">Выберите пол</option>
                {GENDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Отдел */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Отдел</label>
            <div className="relative">
              <select
                value={form.departments_id}
                onChange={(e) => handleChange("departments_id", e.target.value)}
                className={selectClass}
              >
                <option value="">Выберите отдел</option>
                {departments.map((dept) => (
                  <option key={dept.guid} value={dept.guid}>{dept.name_ru}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Должность */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Должность</label>
            <div className="relative">
              <select
                value={form.job_titles_id}
                onChange={(e) => handleChange("job_titles_id", e.target.value)}
                className={selectClass}
              >
                <option value="">Выберите должность</option>
                {jobTitles.map((jt) => (
                  <option key={jt.guid} value={jt.guid}>{jt.name_ru}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Дата найма */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Дата найма</label>
            <DatePicker
              selected={form.date_hire}
              onChange={(date: Date | null) => handleChange("date_hire", date)}
              dateFormat="dd.MM.yyyy"
              placeholderText="дд.мм.гггг"
              showYearDropdown
              showMonthDropdown
              dropdownMode="select"
              className={inputClass}
              calendarClassName="nstex-datepicker"
              wrapperClassName="w-full"
            />
          </div>

          {/* Статус */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Статус</label>
            <div className="relative">
              <select
                value={form.status}
                onChange={(e) => handleChange("status", e.target.value)}
                className={selectClass}
              >
                <option value="">Выберите статус</option>
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-8 py-2.5 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: "#1D2939" }}
            onMouseEnter={(e) =>
              !saving && ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#101828")
            }
            onMouseLeave={(e) =>
              !saving && ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#1D2939")
            }
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </>
  );
}
