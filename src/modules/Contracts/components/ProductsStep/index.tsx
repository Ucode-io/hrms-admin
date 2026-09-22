import { useState, useCallback, useMemo, useEffect } from "react";
import Select from "react-select";
import contractService from "../../../../api/services/contract.service";
import { Trash2, AlertCircle } from "lucide-react";
import { useTranslation } from "../../../../i18n";

export interface Product {
  product_id: string;
  name: string;
  full_name: string;
  ikpu: string;
  product_categories_id: string;
  category_name: string;
  quantity: number;
  price: number;
}

interface ProductsStepProps {
  products: Product[];
  onChange: (products: Product[]) => void;
  availableInstallment?: number;
}

const BRAND_500 = "var(--color-brand-500)";
const BRAND_RING = "rgba(var(--company-color-rgb, 70, 95, 255), 0.3)";

export default function ProductsStep({ products, onChange, availableInstallment = 0 }: ProductsStepProps) {
  const { t } = useTranslation();
  const [merchantProducts, setMerchantProducts] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Вычисление общей суммы
  const totalAmount = useMemo(() => {
    return products.reduce((sum, product) => {
      return sum + (product.price * product.quantity);
    }, 0);
  }, [products]);

  // Проверка превышения лимита
  const isOverLimit = availableInstallment > 0 && totalAmount > availableInstallment;

  const formatAmount = (amount: number) => {
    if (!amount && amount !== 0) return "0";
    return new Intl.NumberFormat("ru-RU").format(amount);
  };

  const searchMerchantProducts = useCallback(async (search: string) => {
    // if (!search.trim()) {
    //   setMerchantProducts([]);
    //   return;
    // }
    setSearchLoading(true);
    try {
      const result: any = await contractService.getMerchantProducts({
        search,
        limit: 20,
        page: 1,
      });
      const data = result?.response || [];
      setMerchantProducts(data);
    } catch (error) {
      console.error("Error searching merchant products:", error);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSearch = (inputValue: string) => {
    setSearchQuery(inputValue);
    searchMerchantProducts(inputValue);
  };

  useEffect(() => {
    handleSearch('')
  }, [])

  const handleSelectProduct = (option: any) => {
    if (!option) return;
    const mp = merchantProducts.find((p: any) => p.guid === option.value);
    if (!mp) return;

    const newProduct: Product = {
      product_id: mp.guid,
      name: mp.name,
      full_name: mp.name,
      ikpu: mp.ikpu || "",
      product_categories_id: mp.product_categories_id || "",
      category_name: mp.product_categories_id_data?.title || mp.product_categories_id_data?.name || "",
      quantity: 1,
      price: mp.price || 0,
    };

    onChange([...products, newProduct]);
    setSearchQuery("");
    setMerchantProducts([]);
  };

  const updateProduct = (index: number, field: keyof Product, value: any) => {
    const updated = [...products];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeProduct = (index: number) => {
    onChange(products.filter((_, i) => i !== index));
  };

  const productOptions = merchantProducts.map((p: any) => ({
    value: p.guid,
    label: p.name,
    image: p.image || "",
    price: p.price,
  }));

  const formatOptionLabel = (option: any) => (
    <div className="flex items-center gap-2.5">
      {option.image ? (
        <img
          src={option.image}
          alt=""
          className="w-8 h-8 rounded object-cover flex-shrink-0"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ) : (
        <div className="w-8 h-8 rounded bg-gray-100 dark:bg-gray-700 flex-shrink-0" />
      )}
      <div className="min-w-0">
        <p className="text-sm truncate">{option.label}</p>
        <p className="text-xs text-gray-500">{t("contracts.common.amount_suffix", { amount: formatAmount(option.price) })}</p>
      </div>
    </div>
  );

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

  // Detect dark mode
  const isDarkMode = document.documentElement.classList.contains('dark');
  const styles = isDarkMode ? darkSelectStyles : selectStyles;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          {t("contracts.products_step.title")}
        </h2>
        <Select
          value={null}
          onChange={handleSelectProduct}
          options={productOptions}
          formatOptionLabel={formatOptionLabel}
          placeholder={t("contracts.products_step.search_placeholder")}
          isClearable
          isSearchable
          onInputChange={handleSearch}
          inputValue={searchQuery}
          isLoading={searchLoading}
          styles={styles}
          noOptionsMessage={() => (searchQuery ? t("contracts.products_step.not_found") : t("contracts.products_step.type_to_search"))}
          loadingMessage={() => t("contracts.products_step.searching")}
        />
      </div>

      {/* Блок с общей суммой */}
      {products.length > 0 && (
        <div className={`rounded-xl p-4 ${isOverLimit
          ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700'
          }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isOverLimit && <AlertCircle className="w-5 h-5 text-red-500" />}
              <span className={`text-sm font-medium ${isOverLimit ? 'text-red-700 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'
                }`}>
                {t("contracts.products_step.total_label")}
              </span>
            </div>
            <span className={`text-lg font-bold ${isOverLimit ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
              }`}>
              {t("contracts.common.amount_suffix", { amount: formatAmount(totalAmount) })}
            </span>
          </div>

          {availableInstallment > 0 && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {t("contracts.products_step.available_limit_label")}
              </span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("contracts.common.amount_suffix", { amount: formatAmount(availableInstallment) })}
              </span>
            </div>
          )}

          {isOverLimit && (
            <div className="mt-3 p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                {t("contracts.products_step.limit_exceeded", { amount: formatAmount(totalAmount - availableInstallment) })}
              </p>
            </div>
          )}
        </div>
      )}

      {products.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>{t("contracts.products_step.empty")}</p>
          <p className="text-sm mt-1">{t("contracts.products_step.empty_hint")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((product, productIndex) => (
            <div
              key={productIndex}
              className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("contracts.products_step.product_index", { index: productIndex + 1 })}
                </span>
                <button
                  onClick={() => removeProduct(productIndex)}
                  className="text-red-500 hover:text-red-700 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div className="col-span-2" >
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("contracts.products_step.name_label")}
                  </label>
                  <input
                    type="text"
                    value={product.name}
                    onChange={(e) => updateProduct(productIndex, "name", e.target.value)}
                    placeholder={t("contracts.products_step.name_placeholder")}
                    className="w-full h-10 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                {/* IKPU */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    IKPU
                  </label>
                  <input
                    type="text"
                    value={product.ikpu}
                    readOnly
                    className="w-full h-10 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white cursor-not-allowed"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("contracts.products_step.category_label")}
                  </label>
                  <input
                    type="text"
                    value={product.category_name}
                    readOnly
                    className="w-full h-10 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white cursor-not-allowed"
                  />
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("contracts.products_step.quantity_label")}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={product.quantity}
                    onChange={(e) => updateProduct(productIndex, "quantity", parseInt(e.target.value) || 1)}
                    className="w-full h-10 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t("contracts.products_step.price_label")}
                  </label>
                  <input
                    type="number"
                    value={product.price}
                    onChange={(e) => updateProduct(productIndex, "price", parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full h-10 px-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Subtotal */}
              <div className="text-right text-sm text-gray-500 dark:text-gray-400">
                {t("contracts.products_step.row_amount")}{" "}
                <span className="font-medium text-gray-900 dark:text-white">
                  {t("contracts.common.amount_suffix", { amount: formatAmount(product.price * product.quantity) })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
