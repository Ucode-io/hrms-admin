import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useForm } from "react-hook-form";
import PageMeta from "../../../components/common/PageMeta";
import Button from "../../../components/ui/button/Button";
import FormInput from "../../../components/HookFormElements/FormInput";
import FormSelect from "../../../components/HookFormElements/FormSelect";
import Label from "../../../components/form/Label";
import FileInput from "../../../components/form/input/FileInput";
import contractService, {
  useMerchantProductQuery,
  useCreateMerchantProduct,
  useUpdateMerchantProduct,
} from "../../../api/services/contract.service";
import { useProductCategoriesQuery } from "../../../api/services/productCategory.service";
import Spinner from "../../../components/ui/Spinner";

const STATIC_MERCHANT_ID = "267895f0-e99c-425b-963b-3d4550c1f7fc";

interface ProductFormData {
  name: string;
  price: string;
  ikpu: string;
  product_categories_id: string;
  image: string;
}

export default function ProductFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;
  const [ikpuLoading, setIkpuLoading] = useState(false);

  const { data: productData, isLoading: isLoadingProduct } = useMerchantProductQuery({
    guid: id || "",
    querySettings: { enabled: isEditMode },
  });

  const product = productData?.response || productData;

  const { data: categoriesData } = useProductCategoriesQuery({
    params: {},
  });
  const categories = categoriesData?.response || [];

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
  } = useForm<ProductFormData>({
    defaultValues: {
      name: "",
      price: "",
      ikpu: "",
      product_categories_id: "",
      image: "",
    },
  });

  const createMutation = useCreateMerchantProduct();
  const updateMutation = useUpdateMerchantProduct();

  const image = watch("image");

  useEffect(() => {
    if (product && isEditMode) {
      reset({
        name: product.name || "",
        price: product.price?.toString() || "",
        ikpu: product.ikpu || "",
        product_categories_id: product.product_categories_id || "",
        image: product.image || "",
      });
    }
  }, [product, isEditMode, reset]);

  const handleFindIkpu = async () => {
    const name = getValues("name");
    if (!name.trim()) return;

    setIkpuLoading(true);
    try {
      const result: any = await contractService.getIkpuByProductName(name);
      if (result?.ikpu) {
        setValue("ikpu", result.ikpu);
      }
    } catch (error) {
      console.error("Error finding IKPU:", error);
    } finally {
      setIkpuLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setValue("image", reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: ProductFormData) => {
    try {
      const formData = {
        ...data,
        price: Number(data.price),
        merchants_id: STATIC_MERCHANT_ID,
        unit_of_measurement: ["pcs"],
      };

      if (isEditMode) {
        await updateMutation.mutateAsync({
          guid: id!,
          data: {
            ...formData,
            guid: id,
          },
        });
      } else {
        await createMutation.mutateAsync(formData);
      }
      navigate("/products");
    } catch (error) {
      console.error("Error saving product:", error);
    }
  };

  const handleCancel = () => {
    navigate("/products");
  };

  const isLoading = createMutation.isLoading || updateMutation.isLoading || isLoadingProduct;

  const categoryOptions = categories.map((c: any) => ({
    value: c.guid,
    label: c.name || c.title,
  }));

  return (
    <>
      <PageMeta
        title={isEditMode ? "Редактировать продукт | HRMS" : "Добавить продукт | HRMS"}
        description={isEditMode ? "Редактирование продукта" : "Добавление нового продукта"}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          {isEditMode ? "Редактировать продукт" : "Добавить продукт"}
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
                to="/products"
              >
                Продукты
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
        {isLoadingProduct && isEditMode ? (
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
                    label="Название *"
                    type="text"
                    placeholder="Введите название продукта"
                    required
                    disabled={isLoading}
                  />

                  <FormInput
                    name="price"
                    control={control}
                    label="Цена *"
                    type="number"
                    placeholder="Введите цену"
                    required
                    disabled={isLoading}
                  />

                  <div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <FormInput
                          name="ikpu"
                          control={control}
                          label="IKPU *"
                          type="text"
                          placeholder="Введите IKPU"
                          required
                          disabled={isLoading}
                        />
                      </div>
                      <Button
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={handleFindIkpu}
                        disabled={isLoading || ikpuLoading}
                      >
                        {ikpuLoading ? "Поиск..." : "Найти IKPU"}
                      </Button>
                    </div>
                  </div>

                  <FormSelect
                    name="product_categories_id"
                    control={control}
                    label="Категория *"
                    options={categoryOptions}
                    placeholder="Выберите категорию"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Правая колонка - Изображение */}
              <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5 lg:p-6">
                <h4 className="text-base font-semibold text-gray-800 dark:text-white/90 mb-5">
                  Изображение
                </h4>
                <div>
                  <Label>Загрузить изображение</Label>
                  <FileInput onChange={handleFileChange} />
                  {image && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        Текущее изображение:
                      </p>
                      <div className="w-20 h-20 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                        <img
                          src={image}
                          alt="Product"
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
