import { useState, useEffect, useCallback } from "react";
import Select from "react-select";
import kinshipService from "../../../../api/services/kinship.service";
import Spinner from "../../../../components/ui/Spinner";

export interface Contact {
  phone_number: string;
  full_name: string;
  relation_id: string;
}

interface ContactsStepProps {
  contacts: Contact[];
  onChange: (contacts: Contact[]) => void;
}

interface KinshipOption {
  guid: string;
  kinship_type: string;
}

const BRAND_500 = "var(--color-brand-500)";
const BRAND_RING = "rgba(var(--company-color-rgb, 70, 95, 255), 0.3)";

export default function ContactsStep({ contacts, onChange }: ContactsStepProps) {
  const [kinships, setKinships] = useState<KinshipOption[]>([]);
  const [kinshipsLoading, setKinshipsLoading] = useState(true);

  // Инициализация 2 контактов если их нет
  useEffect(() => {
    if (contacts.length === 0) {
      onChange([
        { phone_number: "", full_name: "", relation_id: "" },
        { phone_number: "", full_name: "", relation_id: "" },
      ]);
    }
  }, []);

  const loadKinships = useCallback(async () => {
    setKinshipsLoading(true);
    try {
      const response = await kinshipService.getList({ limit: 100 });
      const result = response as any;
      const data = result?.data?.data?.response || result?.data?.response || result?.response || [];
      setKinships(data);
      setKinshipsLoading(false);
    } catch (error) {
      console.error("Error loading kinships:", error);
      setKinshipsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKinships();
  }, [loadKinships]);

  const kinshipOptions = kinships.map((k) => ({
    value: k.guid,
    label: k.kinship_type,
  }));

  const updateContact = (index: number, field: keyof Contact, value: string) => {
    const updated = [...contacts];
    if (!updated[index]) {
      updated[index] = { phone_number: "", full_name: "", relation_id: "" };
    }
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const formatPhoneInput = (value: string) => {
    const digits = value.replace(/\D/g, '');
    
    if (digits.length <= 2) {
      return digits;
    } else if (digits.length <= 5) {
      return `${digits.slice(0, 2)} ${digits.slice(2)}`;
    } else if (digits.length <= 7) {
      return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
    } else if (digits.length <= 9) {
      return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7)}`;
    }
    return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
  };

  const handlePhoneChange = (index: number, value: string) => {
    let cleanValue = value.replace(/^\+998\s*/, '');
    const digitsOnly = cleanValue.replace(/\D/g, '').slice(0, 9);
    updateContact(index, 'phone_number', digitsOnly);
  };

  const getFormattedPhone = (phone: string) => {
    return formatPhoneInput(phone);
  };

  // Стили как в ProductsStep
  const selectStyles = {
    control: (base: any, state: any) => ({
      ...base,
      minHeight: '40px',
      height: '40px',
      backgroundColor: 'white',
      borderColor: state.isFocused ? BRAND_500 : '#d1d5db',
      borderWidth: '1px',
      borderRadius: '0.5rem',
      boxShadow: state.isFocused ? `0 0 0 3px ${BRAND_RING}` : 'none',
      outline: 'none',
      '&:hover': {
        borderColor: state.isFocused ? BRAND_500 : '#9ca3af',
      },
    }),
    valueContainer: (base: any) => ({
      ...base,
      height: '38px',
      padding: '0 12px',
    }),
    input: (base: any) => ({
      ...base,
      margin: 0,
      padding: 0,
      color: '#111827',
    }),
    indicatorsContainer: (base: any) => ({
      ...base,
      height: '38px',
    }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isSelected ? BRAND_500 : state.isFocused ? '#f3f4f6' : 'white',
      color: state.isSelected ? 'white' : '#111827',
      cursor: 'pointer',
      padding: '10px 12px',
    }),
    menu: (base: any) => ({
      ...base,
      zIndex: 50,
      borderRadius: '0.5rem',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      border: '1px solid #e5e7eb',
    }),
    menuList: (base: any) => ({
      ...base,
      maxHeight: '200px',
      padding: '4px',
    }),
    singleValue: (base: any) => ({
      ...base,
      color: '#111827',
    }),
    placeholder: (base: any) => ({
      ...base,
      color: '#9ca3af',
    }),
  };

  const darkSelectStyles = {
    control: (base: any, state: any) => ({
      ...base,
      minHeight: '40px',
      height: '40px',
      backgroundColor: 'rgb(17, 24, 39)',
      borderColor: state.isFocused ? BRAND_500 : 'rgb(55, 65, 81)',
      borderWidth: '1px',
      borderRadius: '0.5rem',
      boxShadow: state.isFocused ? `0 0 0 3px ${BRAND_RING}` : 'none',
      outline: 'none',
      '&:hover': {
        borderColor: state.isFocused ? BRAND_500 : 'rgb(75, 85, 99)',
      },
    }),
    valueContainer: (base: any) => ({
      ...base,
      height: '38px',
      padding: '0 12px',
    }),
    input: (base: any) => ({
      ...base,
      margin: 0,
      padding: 0,
      color: 'white',
    }),
    indicatorsContainer: (base: any) => ({
      ...base,
      height: '38px',
    }),
    option: (base: any, state: any) => ({
      ...base,
      backgroundColor: state.isSelected ? BRAND_500 : state.isFocused ? 'rgb(55, 65, 81)' : 'rgb(17, 24, 39)',
      color: 'white',
      cursor: 'pointer',
      padding: '10px 12px',
    }),
    menu: (base: any) => ({
      ...base,
      zIndex: 50,
      borderRadius: '0.5rem',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
      border: '1px solid rgb(55, 65, 81)',
      backgroundColor: 'rgb(17, 24, 39)',
    }),
    menuList: (base: any) => ({
      ...base,
      maxHeight: '200px',
      padding: '4px',
    }),
    singleValue: (base: any) => ({
      ...base,
      color: 'white',
    }),
    placeholder: (base: any) => ({
      ...base,
      color: 'rgb(156, 163, 175)',
    }),
  };

  const isDarkMode = document.documentElement.classList.contains('dark');
  const styles = isDarkMode ? darkSelectStyles : selectStyles;

  if (kinshipsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="w-6 h-6" />
      </div>
    );
  }

  const inputClassName = "w-full h-10 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500";

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
        Добавления контакных лиц
      </h2>

      {/* Первый контакт */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          1ое контактное лицо
        </span>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Номер телефона */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Номер телефона
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">
                +998
              </span>
              <input
                type="text"
                value={getFormattedPhone(contacts[0]?.phone_number || '')}
                onChange={(e) => handlePhoneChange(0, e.target.value)}
                placeholder="XX XXX XX XX"
                className={`${inputClassName} pl-12`}
              />
            </div>
          </div>

          {/* ФИО */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ФИО
            </label>
            <input
              type="text"
              value={contacts[0]?.full_name || ''}
              onChange={(e) => updateContact(0, "full_name", e.target.value)}
              placeholder="Введите ФИО"
              className={inputClassName}
            />
          </div>

          {/* Тип родства */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Тип родства
            </label>
            <Select
              value={kinshipOptions.find(opt => opt.value === contacts[0]?.relation_id) || null}
              onChange={(option) => updateContact(0, "relation_id", option?.value || "")}
              options={kinshipOptions}
              placeholder="Выберите тип родства"
              isClearable
              isSearchable
              styles={styles}
              noOptionsMessage={() => "Типы родства не найдены"}
              loadingMessage={() => "Загрузка..."}
            />
          </div>
        </div>
      </div>

      {/* Второй контакт */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          2ое контактное лицо
        </span>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Номер телефона */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Номер телефона
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">
                +998
              </span>
              <input
                type="text"
                value={getFormattedPhone(contacts[1]?.phone_number || '')}
                onChange={(e) => handlePhoneChange(1, e.target.value)}
                placeholder="XX XXX XX XX"
                className={`${inputClassName} pl-12`}
              />
            </div>
          </div>

          {/* ФИО */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ФИО
            </label>
            <input
              type="text"
              value={contacts[1]?.full_name || ''}
              onChange={(e) => updateContact(1, "full_name", e.target.value)}
              placeholder="Введите ФИО"
              className={inputClassName}
            />
          </div>

          {/* Тип родства */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Тип родства
            </label>
            <Select
              value={kinshipOptions.find(opt => opt.value === contacts[1]?.relation_id) || null}
              onChange={(option) => updateContact(1, "relation_id", option?.value || "")}
              options={kinshipOptions}
              placeholder="Выберите тип родства"
              isClearable
              isSearchable
              styles={styles}
              noOptionsMessage={() => "Типы родства не найдены"}
              loadingMessage={() => "Загрузка..."}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
