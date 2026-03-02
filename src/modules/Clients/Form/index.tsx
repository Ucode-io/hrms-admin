import React, { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import PageMeta from "../../../components/common/PageMeta";
import { InputMask } from "@react-input/mask";
import {
  useServerClientQuery,
  useServerCreateClientMutation,
  useServerUpdateClientMutation,
} from "../../../api/services/client.service";

const inputClass =
  "w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#B38D80]/30 focus:border-[#B38D80] transition-colors";

export default function ClientForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id && id !== "new");

  // Fetch existing data if in edit mode
  const { data: clientData, isLoading: isLoadingClient } = useServerClientQuery(
    isEditMode ? id! : ""
  );

  const createMutation = useServerCreateClientMutation();
  const updateMutation = useServerUpdateClientMutation();

  const isSaving = createMutation.isLoading || updateMutation.isLoading;

  const [formData, setFormData] = React.useState({
    company_name: "",
    name: "",
    phone: "",
    manager: "",
    current_account: "",
  });

  // Populate form when data loads in edit mode
  useEffect(() => {
    if (clientData && isEditMode) {
      setFormData({
        company_name: clientData.company_name || "",
        name: clientData.name || "",
        phone: clientData.phone || "",
        manager: clientData.manager || "",
        current_account: clientData.current_account?.toString() || "",
      });
    }
  }, [clientData, isEditMode]);

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
          company_name: formData.company_name,
          name: formData.name,
          phone: formData.phone,
          manager: formData.manager,
          current_account: Number(formData.current_account) || 0,
        });
      } else {
        await createMutation.mutateAsync({
          company_name: formData.company_name,
          name: formData.name,
          phone: formData.phone,
          manager: formData.manager,
          current_account: Number(formData.current_account) || 0,
        });
      }
      navigate("/organization/clients");
    } catch (error) {
      console.error("Failed to save client:", error);
      alert("Ошибка при сохранении клиента. Пожалуйста, проверьте данные.");
    }
  };

  if (isEditMode && isLoadingClient) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#B38D80]" />
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title={isEditMode ? "Редактировать клиента | NSTEX" : "Добавить клиента | NSTEX"}
        description={isEditMode ? "Редактирование клиента" : "Добавление нового клиента"}
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
        <span className="text-[#B38D80]">Клиенты</span>
        <span className="text-gray-400">/</span>
        <span className="text-gray-800 font-medium">
          {isEditMode ? "Редактировать клиента" : "Добавить клиента"}
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

          {/* Manager */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Менеджер
            </label>
            <input
              type="text"
              value={formData.manager}
              onChange={(e) => handleChange("manager", e.target.value)}
              className={inputClass}
              placeholder="Введите имя менеджера"
            />
          </div>

          {/* Current Account */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Текущий счет
            </label>
            <input
              type="number"
              value={formData.current_account}
              onChange={(e) => handleChange("current_account", e.target.value)}
              className={inputClass}
              placeholder="0"
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
