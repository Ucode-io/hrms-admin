import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useForm } from "react-hook-form";
import PageMeta from "../../../components/common/PageMeta";
import Button from "../../../components/ui/button/Button";
import FormInput from "../../../components/HookFormElements/FormInput";
import FormSelect from "../../../components/HookFormElements/FormSelect";
import FormPhoneInput from "../../../components/HookFormElements/FormPhoneInput";
import Label from "../../../components/form/Label";
import FileInput from "../../../components/form/input/FileInput";
import { useCreateMerchant, useUpdateMerchant, useMerchantQuery } from "../../../api/services/merchant.service";
import Spinner from "../../../components/ui/Spinner";
import { useTranslation } from "../../../i18n";

interface MerchantFormData {
  name: string;
  director_fio: string;
  phone: string;
  tin: string;
  bank: string;
  mfo: string;
  bank_account: string;
  area: string;
  region: string;
  address: string;
  status: string;
  logo: string;
}

export default function MerchantFormPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const { data, isLoading: isLoadingMerchant } = useMerchantQuery({
    guid: id || "",
    querySettings: { enabled: isEditMode },
  });

  const merchant = data?.response || data;

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
  } = useForm<MerchantFormData>({
    defaultValues: {
      name: "",
      director_fio: "",
      phone: "",
      tin: "",
      bank: "",
      mfo: "",
      bank_account: "",
      area: "",
      region: "",
      address: "",
      status: "active",
      logo: "",
    },
  });

  const createMutation = useCreateMerchant();
  const updateMutation = useUpdateMerchant();

  const logo = watch("logo");

  useEffect(() => {
    if (merchant && isEditMode) {
      reset({
        ...merchant,
        name: merchant.name || "",
        director_fio: merchant.director_fio || "",
        phone: merchant.phone || "",
        tin: merchant.tin || "",
        bank: merchant.bank || "",
        mfo: merchant.mfo || "",
        bank_account: merchant.bank_account || "",
        area: merchant.area || "",
        region: merchant.region || "",
        address: merchant.address || "",
        status: merchant.status?.[0] || "active",
        logo: merchant.logo || "",
      });
    }
  }, [merchant, isEditMode, reset]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // В реальном приложении здесь будет загрузка файла на сервер
      // Пока просто сохраняем имя файла или URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setValue("logo", reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: MerchantFormData) => {
    console.log("GGGGG")
    try {
      const formData = {
        ...data,
        status: [data.status],
        mfo: data.mfo ? Number(data.mfo) : null,
        bank_account: data.bank_account ? Number(data.bank_account) : null,
        tin: data.tin ? Number(data.tin) : null,
      };

      if (isEditMode) {
        await updateMutation.mutateAsync({
          guid: id!,
          data: {
            ...formData,
            guid: id,
          },
        });
        navigate(`/merchants/${id}`);
      } else {
        const result = await createMutation.mutateAsync({
          ...formData,
          client_type_id: "24019f61-2de3-4a2f-bfcb-01b48f1497a6",
          role_id: "9c888d7e-0f65-4567-af6d-b3d8af385d46",
          status: ["Active"],
        });
        const newGuid = result?.response?.guid || result?.guid;
        if (newGuid) {
          navigate(`/merchants/${newGuid}`);
        } else {
          navigate("/merchants");
        }
      }
    } catch (error) {
      console.error("Error saving merchant:", error);
    }
  };

  const handleCancel = () => {
    if (isEditMode) {
      navigate(`/merchants/${id}`);
    } else {
      navigate("/merchants");
    }
  };

  const isLoading = createMutation.isLoading || updateMutation.isLoading || isLoadingMerchant;

  return (
    <>
      <PageMeta
        title={isEditMode ? "Редактировать партнера | HRMS" : "Добавить партнера | HRMS"}
        description={isEditMode ? "Редактирование партнера" : "Добавление нового партнера"}
      />

      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          {isEditMode ? "Редактировать партнера" : "Добавить партнера"}
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
                to="/merchants"
              >
                Партнеры
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
        {isLoadingMerchant && isEditMode ? (
          <div className="flex items-center justify-center py-12 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
            <Spinner />
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Левая колонка - Основная информация */}
              <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5 lg:p-6">
                <h4 className="text-base font-semibold text-gray-800 dark:text-white/90 mb-5">
                  Основная информация
                </h4>
                <div className="space-y-5">
                  <FormInput
                    name="name"
                    control={control}
                    label="Название магазина *"
                    type="text"
                    placeholder="Введите название магазина"
                    required
                    disabled={isLoading}
                  />

                  <FormInput
                    name="director_fio"
                    control={control}
                    label="Ф.И.О партнера *"
                    type="text"
                    placeholder="Введите Ф.И.О партнера"
                    required
                    disabled={isLoading}
                  />

                  <FormPhoneInput
                    name="phone"
                    control={control}
                    label="Номер телефона *"
                    placeholder="Введите номер телефона"
                    required
                    disabled={isLoading}
                    defaultCountry="UZ"
                  />

                  <FormInput
                    name="tin"
                    control={control}
                    label="ИНН/ПИНФЛ *"
                    type="number"
                    placeholder="Введите ИНН/ПИНФЛ"
                    required
                    disabled={isLoading}
                  />

                  <FormSelect
                    name="status"
                    control={control}
                    label="Статус *"
                    options={[
                      { value: "active", label: "Активный" },
                      { value: "inactive", label: "Неактивный" },
                    ]}
                    placeholder="Выберите статус"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Правая колонка - Банковские реквизиты и Адресная информация */}
              <div className="space-y-6">
                {/* Банковские реквизиты */}
                <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5 lg:p-6">
                  <h4 className="text-base font-semibold text-gray-800 dark:text-white/90 mb-5">
                    Банковские реквизиты
                  </h4>
                  <div className="space-y-5">
                    <FormInput
                      name="bank"
                      control={control}
                      label="Банк"
                      type="text"
                      placeholder="Введите название банка"
                      disabled={isLoading}
                    />

                    <FormInput
                      name="mfo"
                      control={control}
                      label="МФО"
                      type="text"
                      placeholder="Введите МФО"
                      disabled={isLoading}
                    />

                    <FormInput
                      name="bank_account"
                      control={control}
                      label="P/C"
                      type="number"
                      placeholder="Введите расчетный счет"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Адресная информация */}
                <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5 lg:p-6">
                  <h4 className="text-base font-semibold text-gray-800 dark:text-white/90 mb-5">
                    Адресная информация
                  </h4>
                  <div className="space-y-5">
                    <FormInput
                      name="area"
                      control={control}
                      label="Область"
                      type="text"
                      placeholder="Введите область"
                      disabled={isLoading}
                    />

                    <FormInput
                      name="region"
                      control={control}
                      label="Регион"
                      type="text"
                      placeholder="Введите регион"
                      disabled={isLoading}
                    />

                    <FormInput
                      name="address"
                      control={control}
                      label="Адрес"
                      type="text"
                      placeholder="Введите адрес"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Логотип - на всю ширину */}
            <div className="mt-6 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5 lg:p-6">
              <h4 className="text-base font-semibold text-gray-800 dark:text-white/90 mb-5">
                Логотип
              </h4>
              <div className="max-w-md">
                <Label>Загрузить логотип</Label>
                <FileInput
                  onChange={handleFileChange}
                />
                {logo && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Текущий логотип:
                    </p>
                    <div className="w-20 h-20 overflow-hidden rounded border border-gray-200 dark:border-gray-700">
                      <img
                        src={logo}
                        alt="Logo"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                  </div>
                )}
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

