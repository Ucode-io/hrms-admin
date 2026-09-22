import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import PageMeta from "../../../../components/common/PageMeta";
import Button from "../../../../components/ui/button/Button";
import Input from "../../../../components/form/input/InputField";
import Label from "../../../../components/form/Label";
import Select from "../../../../components/form/Select";
import {
  useCreateTariff,
  useUpdateTariff,
  useTariffQuery,
} from "../../../../api/services/tariff.service";
import { useProductCategoriesQuery } from "../../../../api/services/productCategory.service";
import { useMerchantsQuery } from "../../../../api/services/merchant.service";
import Spinner from "../../../../components/ui/Spinner";
import { useTranslation } from "../../../../i18n";

export default function TariffForm() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [formData, setFormData] = useState({
    period: "",
    commission_percentage: "",
    product_categories_id: "",
    merchants_id: "",
    status: ["active"],
  });

  const { data: tariffData, isLoading: isLoadingTariff } = useTariffQuery({
    id: id || "",
    querySettings: { enabled: isEditMode },
  });

  const createMutation = useCreateTariff();
  const updateMutation = useUpdateTariff();

  const { data: categoriesData } = useProductCategoriesQuery({ params: { limit: 100 } });
  const { data: merchantsData } = useMerchantsQuery({ params: { limit: 100 } });

  const categories = categoriesData?.response?.map((cat: any) => ({
    value: cat.guid,
    label: cat.title,
  })) || [];

  const merchants = merchantsData?.response?.map((m: any) => ({
    value: m.guid,
    label: m.name,
  })) || [];

  const statusOptions = [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ];

  const tariff = tariffData?.response || tariffData;

  useEffect(() => {
    if (tariff && isEditMode) {
      setFormData({
        period: tariff.period || "",
        commission_percentage: tariff.commission_percentage || "",
        product_categories_id: tariff.product_categories_id || "",
        merchants_id: tariff.merchants_id || "",
        status: tariff.status?.[0]?.toLowerCase() === "active" ? ["active"] : ["inactive"],
      });
    }
  }, [tariff, isEditMode]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        period: Number(formData.period),
        commission_percentage: Number(formData.commission_percentage),
        status: formData.status[0] === "active" ? ["Active"] : ["Inactive"],
      };

      if (isEditMode) {
        await updateMutation.mutateAsync({
          guid: tariff.guid,
          data: {
            ...payload,
            guid: tariff.guid
          },
        });
      } else {
        await createMutation.mutateAsync(payload);
      }
      navigate("/settings/tariffs");
    } catch (error) {
      console.error("Error saving tariff:", error);
    }
  };

  const handleCancel = () => {
    navigate("/settings/tariffs");
  };

  const isLoading = createMutation.isLoading || updateMutation.isLoading || (isEditMode && isLoadingTariff);

  return (
    <>
      <PageMeta
        title={isEditMode ? t("settings_tariffs.edit_page_title") : t("settings_tariffs.add_page_title")}
        description={isEditMode ? t("settings_tariffs.edit_description") : t("settings_tariffs.add_description")}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          {isEditMode ? t("settings_tariffs.edit_heading") : t("settings_tariffs.add_heading")}
        </h2>
        <nav>
          <ol className="flex items-center gap-1.5">
            <li>
              <Link
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
                to="/"
              >
                {t("settings_tariffs.home")}
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
                to="/settings/tariffs"
              >
                {t("settings_tariffs.tariffs")}
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
              {isEditMode ? t("settings_tariffs.edit") : t("settings_tariffs.add")}
            </li>
          </ol>
        </nav>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5 lg:p-6 max-w-2xl mx-auto">
        {isLoading && isEditMode ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <Label>{t("settings_tariffs.period_required")}</Label>
              <Input
                type="number"
                value={formData.period}
                onChange={(e) => handleChange("period", e.target.value)}
                required
                min="1"
              />
            </div>

            <div>
              <Label>{t("settings_tariffs.commission_required")}</Label>
              <Input
                type="number"
                value={formData.commission_percentage}
                onChange={(e) => handleChange("commission_percentage", e.target.value)}
                required
                min="0"
                max="100"
              />
            </div>

            <div>
              <Label>{t("settings_tariffs.category_required")}</Label>
              <Select
                options={categories}
                onChange={(value) => handleChange("product_categories_id", value)}
                value={formData.product_categories_id}
                placeholder={t("settings_tariffs.select_category")}
              />
            </div>

            <div>
              <Label>{t("settings_tariffs.merchant_required")}</Label>
              <Select
                options={merchants}
                onChange={(value) => handleChange("merchants_id", value)}
                value={formData.merchants_id}
                placeholder={t("settings_tariffs.select_merchant")}
              />
            </div>

            <div>
              <Label>{t("settings_tariffs.status")}</Label>
              <Select
                options={statusOptions}
                onChange={(value) => handleChange("status", [value])}
                value={formData.status[0]}
                placeholder={t("settings_tariffs.select_status")}
              />
            </div>

            <div className="flex items-center gap-3 mt-4 justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
                type="button"
              >
                {t("settings_tariffs.cancel")}
              </Button>
              <Button size="sm" type="submit" disabled={isLoading}>
                {isLoading ? t("settings_tariffs.saving") : isEditMode ? t("settings_tariffs.save") : t("settings_tariffs.create")}
              </Button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
