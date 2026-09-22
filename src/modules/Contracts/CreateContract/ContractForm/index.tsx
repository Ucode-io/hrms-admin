import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router";
import PageMeta from "../../../../components/common/PageMeta";
import { useUserSearch } from "../../../../api/services/financeApi.service";
import { useCreateContract } from "../../../../api/services/contract.service";
import Button from "../../../../components/ui/button/Button";
import { ChevronRight, ChevronLeft, Loader2 } from "lucide-react";

// Step Components
import ProductsStep, { Product } from "../../components/ProductsStep";
import TariffsStep from "../../components/TariffsStep";
import ContactsStep, { Contact } from "../../components/ContactsStep";
import ContractSuccessModal from "../../components/ContractSuccessModal";
import { useTranslation } from "../../../../i18n";

interface UserData {
  guid: string;
  first_name: string;
  second_name: string;
  middle_name: string | null;
  phone_number: string;
  status: string;
  available_installment: number;
  limit_amount: number | null;
  total_debt: number;
  merchants_id?: string;
}

interface ContractFormData {
  products: Product[];
  tariff_id: string;
  payment_date: string;
  contacts: Contact[];
}

const STEPS = [
  { id: 1, nameKey: "contracts.form.step_products" },
  { id: 2, nameKey: "contracts.form.step_tariffs" },
  { id: 3, nameKey: "contracts.form.step_contacts" },
];

export default function ContractForm() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get("client");
  const clientPhone = searchParams.get("client_phone");
  const merchantId = searchParams.get("merchant");

  const [currentStep, setCurrentStep] = useState(1);
  const [clientData, setClientData] = useState<UserData | null>(null);
  const [formData, setFormData] = useState<ContractFormData>({
    products: [],
    tariff_id: "",
    payment_date: "",
    contacts: [],
  });

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdContractId, setCreatedContractId] = useState("");

  // Create contract mutation
  const createContractMutation = useCreateContract();

  // Fetch client data
  const userSearchMutation = useUserSearch();

  useEffect(() => {
    if (clientId && !clientData) {
      // Try to get client data from sessionStorage
      const savedData = sessionStorage.getItem('contractClientData');
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          if (parsed.guid === clientId) {
            setClientData(parsed);
          }
        } catch (e) {
          console.error("Error parsing client data:", e);
        }
      }
    }
  }, [clientId, clientData, userSearchMutation, setClientData]);

  // Вычисление общей суммы продуктов
  const totalProductsAmount = useMemo(() => {
    return formData.products.reduce((sum, product) => {
      return sum + (product.price * product.quantity);
    }, 0);
  }, [formData.products]);

  const formatPhoneDisplay = (phone: string) => {
    const digits = phone.replace(/\D/g, "").slice(-9);
    if (digits.length === 9) {
      return `+998 ${digits.slice(0, 2)} ${digits.slice(2, 5)}-${digits.slice(5, 7)}-${digits.slice(7, 9)}`;
    }
    return phone;
  };

  const formatAmount = (amount: number) => {
    if (!amount && amount !== 0) return "0";
    return new Intl.NumberFormat("ru-RU").format(amount);
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!clientId && !clientPhone) {
      console.error("Client ID or phone number is required");
      return;
    }

    // Получаем merchants_id из URL параметра, clientData, sessionStorage или используем дефолтный
    // TODO: В будущем merchants_id должен приходить из авторизации мерчанта
    const DEFAULT_MERCHANT_ID = "267895f0-e99c-425b-963b-3d4550c1f7fc";
    const merchantsId = merchantId || clientData?.merchants_id || sessionStorage.getItem('merchantId') || DEFAULT_MERCHANT_ID;

    // Форматируем дату в нужный формат (2026-09-19T00:00:00.000)
    const formattedDate = formData.payment_date ? `${formData.payment_date}T00:00:00.000` : '';

    // Подготавливаем продукты
    const products = formData.products.map(p => ({
      product_id: p.product_id,
      name: p.name,
      full_name: p.full_name || p.name,
      ikpu: p.ikpu,
      product_categories_id: p.product_categories_id,
      quantity: p.quantity,
      price: p.price,
    }));

    try {
      const contractData: any = {
        merchants_id: merchantsId,
        payment_date: formattedDate,
        tariff_id: formData.tariff_id,
        contacts: formData.contacts,
        products,
      };

      // Add either clients_id or client_phone_number
      if (clientId) {
        contractData.clients_id = clientId;
      } else if (clientPhone) {
        contractData.client_phone_number = clientPhone;
      }

      const response = await createContractMutation.mutateAsync(contractData);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = response as any;

      if (result?.success && result?.contract_guid) {
        setCreatedContractId(result.contract_guid);
        setShowSuccessModal(true);
      } else {
        console.error("Contract creation failed:", result);
      }
    } catch (error) {
      console.error("Error creating contract:", error);
    }
  };

  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false);
    // Очистка формы после успешного создания
    setFormData({
      products: [],
      tariff_id: "",
      payment_date: "",
      contacts: [],
    });
    setCurrentStep(1);
  };

  // Валидация текущего шага
  const isCurrentStepValid = useMemo(() => {
    const availableLimit = clientData?.available_installment || clientData?.limit_amount || 0;

    switch (currentStep) {
      case 1: {
        const productsValid = formData.products.length > 0 && formData.products.every(p =>
          p.product_id && p.name && p.price > 0
        );
        // Проверка что сумма не превышает лимит (только если есть clientData)
        const isWithinLimit = !clientData || availableLimit === 0 || totalProductsAmount <= availableLimit;
        return productsValid && isWithinLimit;
      }
      case 2:
        return formData.tariff_id && formData.payment_date;
      case 3:
        return formData.contacts.length >= 2 && formData.contacts.every(c =>
          c.full_name && c.phone_number && c.relation_id
        );
      default:
        return false;
    }
  }, [currentStep, formData, clientData, totalProductsAmount]);

  return (
    <>
      <PageMeta title={t("contracts.form.page_title")} description={t("contracts.form.page_description")} />

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t("contracts.form.page_title")}
          </h1>
        </div>

        {/* Client Info Card - Always visible */}
        {clientData && (
          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/5 p-4 mb-6">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                  <svg className="w-4 h-4 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    {clientData.second_name} {clientData.first_name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatPhoneDisplay(clientData.phone_number)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t("contracts.form.available_limit_label")}</p>
                <p className="font-medium text-brand-600 dark:text-brand-400 text-sm">
                  {t("contracts.form.amount_suffix", {
                    amount: formatAmount(clientData.available_installment || clientData.limit_amount || 0),
                  })}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t("contracts.form.debt_label")}</p>
                <p className="font-medium text-amber-600 dark:text-amber-400 text-sm">
                  {t("contracts.form.amount_suffix", { amount: formatAmount(clientData.total_debt) })}
                </p>
              </div>

              <div className="ml-auto">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${clientData.status === 'approved'
                  ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                  : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                  }`}>
                  {clientData.status === 'approved' ? t("contracts.form.status_approved") : clientData.status}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Phone Number Card - When only phone is available */}
        {!clientData && clientPhone && (
          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/5 p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t("contracts.form.client_phone_label")}</p>
                <p className="font-medium text-gray-900 dark:text-white text-sm">
                  {formatPhoneDisplay(clientPhone)}
                </p>
              </div>
              <div className="ml-auto">
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800">
                  {t("contracts.form.new_client_badge")}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Steps Indicator */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => setCurrentStep(step.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentStep === step.id
                  ? "bg-brand-500 text-white"
                  : currentStep > step.id
                    ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                    : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                  }`}
              >
                <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
                  {currentStep > step.id ? "✓" : step.id}
                </span>
                {t(step.nameKey)}
              </button>
              {index < STEPS.length - 1 && (
                <ChevronRight className="w-4 h-4 text-gray-400 mx-1" />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/5 p-6">
          {currentStep === 1 && (
            <ProductsStep
              products={formData.products}
              onChange={(products) => setFormData({ ...formData, products })}
              availableInstallment={clientData?.available_installment || clientData?.limit_amount || 0}
            />
          )}

          {currentStep === 2 && (
            <TariffsStep
              data={{
                tariff_id: formData.tariff_id,
                payment_date: formData.payment_date,
              }}
              totalAmount={totalProductsAmount}
              onChange={(data) => setFormData({
                ...formData,
                tariff_id: data.tariff_id,
                payment_date: data.payment_date,
              })}
            />
          )}

          {currentStep === 3 && (
            <ContactsStep
              contacts={formData.contacts}
              onChange={(contacts) => setFormData({ ...formData, contacts })}
            />
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={currentStep === 1 || createContractMutation.isLoading}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            {t("contracts.form.back_button")}
          </Button>

          {currentStep < STEPS.length ? (
            <Button
              variant="primary"
              onClick={handleNext}
              disabled={!isCurrentStepValid}
              className="flex items-center gap-2"
            >
              {t("contracts.form.next_button")}
              <ChevronRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!isCurrentStepValid || createContractMutation.isLoading}
              className="flex items-center gap-2"
            >
              {createContractMutation.isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("contracts.form.creating")}
                </>
              ) : (
                t("contracts.form.page_title")
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Success Modal with QR Code */}
      <ContractSuccessModal
        isOpen={showSuccessModal}
        onClose={handleCloseSuccessModal}
        contractId={createdContractId}
        isNewClient={!!clientPhone && !clientId}
      />
    </>
  );
}
