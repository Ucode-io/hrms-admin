// Обёртка над `DateInput` под контракт `string | null`.
//
// Раньше здесь был react-datepicker с `isClearable`. Его крестик — это
// абсолютно спозиционированный элемент внутри его же обёртки, и он ложился
// ровно на иконку календаря, которую компонент дорисовывал сам: две
// картинки в одной точке у правого края. Двигать что-то одно пикселями
// значило подпирать чужой CSS своим, поэтому поле заменено на `DateInput` —
// у него и иконка, и «Очистить» уже свои, и он же стоит в остальных формах.
//
// Сам компонент оставлен: три формы зовут его с `string | null`, а
// `DateInput` работает с пустой строкой. Преобразование живёт здесь, а не
// в каждом месте вызова.

import DateInput from "../../../components/form/DateInput";

interface FormDatePickerProps {
  /** ISO date string (yyyy-MM-dd) or null. */
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function FormDatePicker({
  value,
  onChange,
  placeholder = "дд.мм.гггг",
  disabled = false,
}: FormDatePickerProps) {
  return (
    <DateInput
      value={value ?? ""}
      // Очищенное поле — это `null`, а не пустая строка: формы шлют его в
      // API как «даты нет», и «» там означало бы другое.
      onChange={(next) => onChange(next || null)}
      placeholder={placeholder}
      disabled={disabled}
      className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 pr-10 text-sm text-gray-800 transition placeholder:text-gray-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
    />
  );
}
