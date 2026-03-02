import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import PageMeta from "../../../components/common/PageMeta";
import { UploadCloud, File, X } from "lucide-react";
import {
  useAgreementQuery,
  useCreateAgreementMutation,
  useUpdateAgreementMutation,
} from "../../../api/services/agreement.service";
import { useUploadFile } from "../../../api/services/file-upload.service";

const inputClass =
  "w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#B38D80]/30 focus:border-[#B38D80] transition-colors";

const selectClass =
  "w-full appearance-none rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#B38D80]/30 focus:border-[#B38D80] cursor-pointer bg-white";

export default function AgreementForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id && id !== "new");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch existing data if in edit mode
  const { data: agreementData, isLoading: isLoadingAgreement } = useAgreementQuery(
    isEditMode ? id! : ""
  );

  const createMutation = useCreateAgreementMutation();
  const updateMutation = useUpdateAgreementMutation();

  const isSaving = createMutation.isLoading || updateMutation.isLoading;

  const uploadFileMutation = useUploadFile();
  const [uploadingFile, setUploadingFile] = useState(false);

  const [formData, setFormData] = React.useState({
    company_name: "",
    contract_number: "",
    contract_amount: "",
    file: "",
    status: true as boolean | string,
  });

  // Populate form when data loads in edit mode
  useEffect(() => {
    if (agreementData && isEditMode) {
      setFormData({
        company_name: agreementData.company_name || "",
        contract_number: agreementData.contract_number || "",
        contract_amount: agreementData.contract_amount?.toString() || "",
        file: agreementData.file || "",
        status: agreementData.status ?? true,
      });
    }
  }, [agreementData, isEditMode]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingFile(true);
      const cdnUrl = await uploadFileMutation.mutateAsync(file);
      handleChange("file", cdnUrl);
    } catch (err) {
      console.error("File upload error:", err);
      alert("Ошибка при загрузке файла. Попробуйте ещё раз.");
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveFile = () => {
    handleChange("file", "");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    try {
      if (isEditMode) {
        await updateMutation.mutateAsync({
          guid: id!,
          company_name: formData.company_name,
          contract_number: formData.contract_number,
          contract_amount: Number(formData.contract_amount) || 0,
          file: formData.file,
          status: String(formData.status) === "true",
        });
      } else {
        await createMutation.mutateAsync({
          company_name: formData.company_name,
          contract_number: formData.contract_number,
          contract_amount: Number(formData.contract_amount) || 0,
          file: formData.file,
          status: String(formData.status) === "true",
        });
      }
      navigate("/organization/agreements");
    } catch (error) {
      console.error("Failed to save agreement:", error);
      alert("Ошибка при сохранении договора. Пожалуйста, проверьте данные.");
    }
  };

  if (isEditMode && isLoadingAgreement) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#B38D80]" />
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title={isEditMode ? "Редактировать договор | NSTEX" : "Добавить договор | NSTEX"}
        description={isEditMode ? "Редактирование договора" : "Добавление нового договора"}
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
        <span className="text-[#B38D80]">Договора</span>
        <span className="text-gray-400">/</span>
        <span className="text-gray-800 font-medium">
          {isEditMode ? "Редактировать договор" : "Добавить договор"}
        </span>
      </div>

      {/* Form Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8">

        {/* Document Upload Section */}
        <div className="mb-8">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Файл договора</label>
          {formData.file ? (
            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="bg-white p-2 border border-gray-200 rounded-lg shrink-0">
                  <File className="w-6 h-6 text-[#B38D80]" />
                </div>
                <div className="min-w-0 flex-1">
                  <a
                    href={formData.file}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-600 hover:underline truncate block"
                  >
                    {formData.file.startsWith("http") ? "Прикрепленный файл (открыть)" : "Файл"}
                  </a>
                  <p className="text-xs text-gray-500">Документ</p>
                </div>
              </div>
              <button
                onClick={handleRemoveFile}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0 cursor-pointer"
                title="Удалить файл"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div
              className={`group relative flex flex-col items-center justify-center rounded-xl border border-dashed py-10 transition-colors ${uploadingFile
                ? "border-[#B38D80] bg-gray-50 cursor-wait"
                : "border-gray-300 bg-gray-50/50 cursor-pointer hover:border-[#B38D80] hover:bg-gray-50"
                }`}
              onClick={() => !uploadingFile && fileInputRef.current?.click()}
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-900/5">
                {uploadingFile ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-[#B38D80]" />
                ) : (
                  <UploadCloud className="h-5 w-5 text-gray-500 transition-colors group-hover:text-[#B38D80]" />
                )}
              </div>
              <p className="text-sm font-medium text-[#B38D80]">
                {uploadingFile ? "Загрузка..." : "Нажмите для загрузки файла"}
              </p>
              <p className="mt-1 text-xs text-gray-500">PDF, DOC, DOCX до 10MB</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleFileChange}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
          {/* Company Name */}
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Название компании <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.company_name}
              onChange={(e) => handleChange("company_name", e.target.value)}
              className={inputClass}
              placeholder="Введите название компании"
            />
          </div>

          {/* Contract Number */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Номер договора <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.contract_number}
              onChange={(e) => handleChange("contract_number", e.target.value)}
              className={inputClass}
              placeholder="Например, 12345"
            />
          </div>

          {/* Contract Amount */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Сумма договора
            </label>
            <input
              type="number"
              value={formData.contract_amount}
              onChange={(e) => handleChange("contract_amount", e.target.value)}
              className={inputClass}
              placeholder="0"
            />
          </div>

          {/* Status */}
          <div className="md:col-span-2 mt-2">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Статус</label>
            <div className="relative w-full md:w-1/2">
              <select
                value={String(formData.status)}
                onChange={(e) => handleChange("status", e.target.value)}
                className={selectClass}
              >
                <option value="true">Активный</option>
                <option value="false">Неактивный</option>
              </select>
              <svg
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-8 py-2.5 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: "#1D2939" }}
            onMouseEnter={(e) =>
              !isSaving && ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#101828")
            }
            onMouseLeave={(e) =>
              !isSaving && ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#1D2939")
            }
          >
            {isSaving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </>
  );
}
