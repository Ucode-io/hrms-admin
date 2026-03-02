import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import PageMeta from "../../../components/common/PageMeta";
import { InputMask } from "@react-input/mask";
import {
  useSupplierQuery,
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
} from "../../../api/services/supplier.service";

const inputClass =
  "w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#B38D80]/30 focus:border-[#B38D80] transition-colors";

export default function SupplierForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id && id !== "new");

  // Fetch existing data if in edit mode
  const { data: supplierData, isLoading: isLoadingSupplier } = useSupplierQuery(
    isEditMode ? id! : ""
  );

  const createMutation = useCreateSupplierMutation();
  const updateMutation = useUpdateSupplierMutation();

  const isSaving = createMutation.isLoading || updateMutation.isLoading;

  const [formData, setFormData] = React.useState({
    company_name: "",
    name: "",
    phone: "",
  });

  // Populate form when data loads in edit mode
  useEffect(() => {
    if (supplierData && isEditMode) {
      setFormData({
        company_name: supplierData.company_name || "",
        name: supplierData.name || "",
        phone: supplierData.phone || "",
      });
    }
  }, [supplierData, isEditMode]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleChange("phone", e.target.value);
  };

  const handleSave = async () => {
    try {
      if (isEditMode) {
        await updateMutation.mutateAsync({
          guid: id!,
          ...formData,
        });
      } else {
        await createMutation.mutateAsync(formData);
      }
      navigate("/organization/suppliers");
    } catch (error) {
      console.error("Failed to save supplier:", error);
      alert("Ошибка при сохранении поставщика. Пожалуйста, проверьте данные.");
    }
  };

  if (isEditMode && isLoadingSupplier) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#B38D80]" />
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title={isEditMode ? "Редактировать поставщика | NSTEX" : "Добавить поставщика | NSTEX"}
        description={isEditMode ? "Редактирование поставщика" : "Добавление нового поставщика"}
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
        <span className="text-[#B38D80]">Поставщики</span>
        <span className="text-gray-400">/</span>
        <span className="text-gray-800 font-medium">
          {isEditMode ? "Редактировать поставщика" : "Добавить поставщика"}
        </span>
      </div>

      {/* Form Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8">
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

          {/* Contact Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Имя (Контактное лицо) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className={inputClass}
              placeholder="Введите имя"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Номер телефона <span className="text-red-500">*</span>
            </label>
            <InputMask
              mask="+___ __ ___ __ __"
              replacement={{ _: /\d/ }}
              value={formData.phone}
              onChange={handlePhoneChange}
              className={inputClass}
              placeholder="+998 ** *** ** **"
            />
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
