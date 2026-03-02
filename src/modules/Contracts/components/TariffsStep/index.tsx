import { useMemo } from "react";
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "./DatePickerCustom.css";
import { ru } from "date-fns/locale/ru";
import { useTariffsQuery } from "../../../../api/services/tariff.service";
import Spinner from "../../../../components/ui/Spinner";

// Register Russian locale
registerLocale("ru", ru);

interface TariffOption {
  guid: string;
  period: number;
  commission_percentage: number;
  status: string[];
  product_categories_id_data?: { title: string };
  merchants_id_data?: { name: string };
}

interface TariffsStepData {
  tariff_id: string;
  payment_date: string;
}

interface TariffsStepProps {
  data: TariffsStepData;
  totalAmount: number;
  onChange: (data: TariffsStepData) => void;
}

export default function TariffsStep({ data, totalAmount, onChange }: TariffsStepProps) {
  const { data: tariffsData, isLoading } = useTariffsQuery({
    params: { limit: 100 },
  });

  // Фильтруем только активные тарифы
  const activeTariffs = useMemo(() => {
    const allTariffs = ((tariffsData as any)?.data?.response || (tariffsData as any)?.response || []) as TariffOption[];
    return allTariffs.filter(t => t.status && t.status[0]?.toLowerCase() === 'active');
  }, [tariffsData]);

  // Calculate min and max dates
  const today = new Date();
  const minDate = new Date(today);
  minDate.setDate(today.getDate() + 1); // Tomorrow
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 21); // +21 days

  // Используем реальные тарифы из API, сортируем по периоду (от большего к меньшему)
  const sortedTariffs = useMemo(() => {
    return [...activeTariffs]
      .sort((a, b) => b.period - a.period)
      .map(tariff => ({
        tariff,
        monthlyPayment: calculateMonthlyPayment(totalAmount, tariff.period, tariff.commission_percentage),
        totalWithCommission: calculateTotalWithCommission(totalAmount, tariff.commission_percentage),
      }));
  }, [activeTariffs, totalAmount]);

  const formatAmount = (amount: number) => {
    if (!amount && amount !== 0) return "0";
    return new Intl.NumberFormat("ru-RU").format(Math.round(amount));
  };

  const selectedTariff = activeTariffs.find(t => t.guid === data.tariff_id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="w-6 h-6" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Заголовок выбора даты */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Выберите дату оплаты
        </label>

        <DatePicker
          selected={data.payment_date ? new Date(data.payment_date) : null}
          onChange={(date: Date | null) => {
            if (date) {
              const isoDate = date.toISOString().split('T')[0];
              onChange({ ...data, payment_date: isoDate });
            }
          }}
          minDate={minDate}
          maxDate={maxDate}
          locale="ru"
          dateFormat="d MMMM yyyy"
          placeholderText="Выберите дату*"
          wrapperClassName="w-full"
          className="w-full h-10 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
        />
      </div>

      {/* Выбор периода */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Выбор периода
        </h2>

        {sortedTariffs.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>Нет доступных тарифов</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedTariffs.map(({ tariff, monthlyPayment, totalWithCommission }) => {
              const isSelected = data.tariff_id === tariff.guid;

              return (
                <button
                  key={tariff.guid}
                  onClick={() => onChange({ ...data, tariff_id: tariff.guid })}
                  className="w-full text-left transition-all duration-200"
                >
                  <div
                    className={`rounded-xl border-2 p-5 transition-all duration-200 ${isSelected
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Radio button */}
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected
                          ? 'border-brand-500'
                          : 'border-gray-400 dark:border-gray-500'
                          }`}
                      >
                        {isSelected && (
                          <div className="w-2.5 h-2.5 rounded-full bg-brand-500" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 space-y-3">
                        {/* Срок */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Срок:</span>
                          <span className="text-base font-semibold text-gray-900 dark:text-white">
                            {tariff.period} месяцев
                          </span>
                        </div>

                        {/* Процентная ставка */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Процентная ставка:</span>
                          <span className="text-base font-semibold text-gray-900 dark:text-white">
                            {tariff.commission_percentage}%
                          </span>
                        </div>

                        {/* За месяц */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500 dark:text-gray-400">За месяц:</span>
                          <span className="text-base font-semibold text-gray-900 dark:text-white">
                            {formatAmount(monthlyPayment)} сум
                          </span>
                        </div>

                        {/* Общая сумма */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Общая сумма:</span>
                          <span className="text-base font-semibold text-gray-900 dark:text-white">
                            {formatAmount(totalWithCommission)} сум
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Информация о выбранном тарифе */}
      {selectedTariff && data.payment_date && (
        <div className="mt-6 p-4 rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800">
          <h3 className="text-sm font-medium text-brand-800 dark:text-brand-300 mb-2">
            Выбранные условия:
          </h3>
          <div className="text-sm text-brand-700 dark:text-brand-400 space-y-1">
            <p>• Период: {selectedTariff.period} месяцев</p>
            <p>• Первый платеж: {data.payment_date ? new Date(data.payment_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</p>
            <p>• Процентная ставка: {selectedTariff.commission_percentage}%</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Вспомогательные функции для расчета
function calculateMonthlyPayment(totalAmount: number, period: number, commissionPercentage: number): number {
  if (!totalAmount || !period) return 0;
  const totalWithCommission = totalAmount * (1 + commissionPercentage / 100);
  return totalWithCommission / period;
}

function calculateTotalWithCommission(totalAmount: number, commissionPercentage: number): number {
  if (!totalAmount) return 0;
  return totalAmount * (1 + commissionPercentage / 100);
}
