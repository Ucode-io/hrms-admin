import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useForm } from "react-hook-form";
import PageMeta from "../../../components/common/PageMeta";
import Button from "../../../components/ui/button/Button";
import FormInput from "../../../components/HookFormElements/FormInput";
import FormSelect from "../../../components/HookFormElements/FormSelect";
import FormPhoneInput from "../../../components/HookFormElements/FormPhoneInput";
import FormDatePicker from "../../../components/HookFormElements/FormDatePicker";
import { useCreateClient, useUpdateClient, useClientQuery } from "../../../api/services/client.service";
import { useMerchantsQuery } from "../../../api/services/merchant.service";
import Spinner from "../../../components/ui/Spinner";

interface ClientFormData {
  first_name: string;
  second_name: string;
  middle_name: string;
  birthdate: string;
  phone_number: string;
  pinfl: string;
  passport_series: string;
  passport_number: string;
  passport_issue_date: string;
  passport_issued_by: string;
  passport_expiration_date: string;
  merchants_id: string;
}

export default function ClientFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const { data, isLoading: isLoadingClient } = useClientQuery({
    guid: id || "",
    querySettings: { enabled: isEditMode },
  });

  const client = data?.response || data;

  const { data: merchantsData } = useMerchantsQuery({ params: {} });
  const merchants = merchantsData?.response || [];
  const merchantOptions = merchants.map((merchant: any) => ({
    value: merchant.guid,
    label: merchant.name,
  }));

  const {
    control,
    handleSubmit,
    reset,
  } = useForm<ClientFormData>({
    defaultValues: {
      first_name: "",
      second_name: "",
      middle_name: "",
      birthdate: "",
      phone_number: "",
      pinfl: "",
      passport_series: "",
      passport_number: "",
      passport_issue_date: "",
      passport_issued_by: "",
      passport_expiration_date: "",
      merchants_id: "",
    },
  });

  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();

  useEffect(() => {
    if (client && isEditMode) {
      reset({
        first_name: client.first_name || "",
        second_name: client.second_name || "",
        middle_name: client.middle_name || "",
        birthdate: client.birthdate || "",
        phone_number: client.phone_number || "",
        pinfl: client.pinfl || "",
        passport_series: client.passport_series || "",
        passport_number: client.passport_number || "",
        passport_issue_date: client.passport_issue_date || "",
        passport_issued_by: client.passport_issued_by || "",
        passport_expiration_date: client.passport_expiration_date || "",
        merchants_id: client.merchants_id || "",
      });
    }
  }, [client, isEditMode, reset]);

  const onSubmit = async (data: ClientFormData) => {
    try {
      if (isEditMode) {
        await updateMutation.mutateAsync({
          guid: id!,
          data: {
            ...data,
            guid: id,
          },
        });
        navigate(`/clients/${id}`);
      } else {
        const result = await createMutation.mutateAsync(data);
        const newGuid = result?.response?.guid || result?.guid;
        if (newGuid) {
          navigate(`/clients/${newGuid}`);
        } else {
          navigate("/clients");
        }
      }
    } catch (error) {
      console.error("Error saving client:", error);
    }
  };

  const handleCancel = () => {
    if (isEditMode) {
      navigate(`/clients/${id}`);
    } else {
      navigate("/clients");
    }
  };

  const isLoading = createMutation.isLoading || updateMutation.isLoading || isLoadingClient;

  return (
    <>
      <PageMeta
        title={isEditMode ? "Редактировать клиента | HRMS" : "Добавить клиента | HRMS"}
        description={isEditMode ? "Редактирование клиента" : "Добавление нового клиента"}
      />

      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          {isEditMode ? "Редактировать клиента" : "Добавить клиента"}
        </h2>
        <nav>
          <ol className="flex items-center gap-1.5">
            <li>
              <Link
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
                to="/"
              >
                Главная
                <svg
                  className="stroke-current"
                  width="17"
                  height="16"
                  viewBox="0 0 17 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6.0765 12.667L10.2432 8.50033L6.0765 4.33366"
                    stroke=""
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            </li>
            <li>
              <Link
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
                to="/clients"
              >
                Клиенты
                <svg
                  className="stroke-current"
                  width="17"
                  height="16"
                  viewBox="0 0 17 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M6.0765 12.667L10.2432 8.50033L6.0765 4.33366"
                    stroke=""
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            </li>
            <li className="text-sm text-gray-800 dark:text-white/90">
              {isEditMode ? "Редактировать" : "Добавить"}
            </li>
          </ol>
        </nav>
      </div>

      <div className="space-y-6">
        {isLoadingClient && isEditMode ? (
          <div className="flex items-center justify-center py-12 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
            <Spinner />
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Левая колонка - Личная информация */}
              <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5 lg:p-6">
                <h4 className="text-base font-semibold text-gray-800 dark:text-white/90 mb-5">
                  Личная информация
                </h4>
                <div className="space-y-5">
                  <FormInput
                    name="first_name"
                    control={control}
                    label="Имя *"
                    type="text"
                    placeholder="Введите имя"
                    required
                    disabled={isLoading}
                  />

                  <FormInput
                    name="second_name"
                    control={control}
                    label="Фамилия *"
                    type="text"
                    placeholder="Введите фамилию"
                    required
                    disabled={isLoading}
                  />

                  <FormInput
                    name="middle_name"
                    control={control}
                    label="Отчество *"
                    type="text"
                    placeholder="Введите отчество"
                    required
                    disabled={isLoading}
                  />

                  <FormDatePicker
                    name="birthdate"
                    control={control}
                    label="Дата рождения *"
                    placeholder="Выберите дату рождения"
                    required
                    disabled={isLoading}
                  />

                  <FormPhoneInput
                    name="phone_number"
                    control={control}
                    label="Номер телефона *"
                    placeholder="Введите номер телефона"
                    required
                    disabled={isLoading}
                    defaultCountry="UZ"
                  />

                  <FormInput
                    name="pinfl"
                    control={control}
                    label="ПИНФЛ *"
                    type="text"
                    placeholder="Введите ПИНФЛ"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Правая колонка - Паспортные данные */}
              <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5 lg:p-6">
                <h4 className="text-base font-semibold text-gray-800 dark:text-white/90 mb-5">
                  Паспортные данные
                </h4>
                <div className="space-y-5">
                  <FormInput
                    name="passport_series"
                    control={control}
                    label="Серия паспорта *"
                    type="text"
                    placeholder="Введите серию паспорта"
                    required
                    disabled={isLoading}
                  />

                  <FormInput
                    name="passport_number"
                    control={control}
                    label="Номер паспорта *"
                    type="text"
                    placeholder="Введите номер паспорта"
                    required
                    disabled={isLoading}
                  />

                  <FormDatePicker
                    name="passport_issue_date"
                    control={control}
                    label="Дата выдачи паспорта *"
                    placeholder="Выберите дату выдачи"
                    required
                    disabled={isLoading}
                  />

                  <FormInput
                    name="passport_issued_by"
                    control={control}
                    label="Паспорт выдан *"
                    type="text"
                    placeholder="Введите орган выдачи"
                    required
                    disabled={isLoading}
                  />

                  <FormDatePicker
                    name="passport_expiration_date"
                    control={control}
                    label="Дата истечения срока действия *"
                    placeholder="Выберите дату истечения"
                    required
                    disabled={isLoading}
                    minDate="today"
                  />
                </div>
              </div>
            </div>

            {/* Дополнительная информация - на всю ширину */}
            <div className="mt-6 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5 lg:p-6">
              <h4 className="text-base font-semibold text-gray-800 dark:text-white/90 mb-5">
                Дополнительная информация
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl">
                <FormSelect
                  name="merchants_id"
                  control={control}
                  label="Партнер"
                  options={merchantOptions}
                  placeholder="Выберите партнера"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Кнопки действий */}
            <div className="mt-6 flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
                type="button"
              >
                Отмена
              </Button>
              <Button size="sm" type="submit" disabled={isLoading}>
                {isLoading ? "Сохранение..." : isEditMode ? "Сохранить" : "Создать"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
