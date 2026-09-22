import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import {
  useMerchantTransactionQuery,
  useCreateMerchantTransaction,
  useUpdateMerchantTransaction,
} from "../../../api/services/merchantTransaction.service";
import { useMerchantsQuery } from "../../../api/services/merchant.service";
import FormInput from "../../../components/HookFormElements/FormInput";
import FormSelect from "../../../components/HookFormElements/FormSelect";
import Button from "../../../components/ui/button/Button";
import Spinner from "../../../components/ui/Spinner";
import { useTranslation } from "../../../i18n";

interface TransactionFormData {
  merchants_id: string;
  amount: number;
  comment: string;
}

export default function MerchantTransactionFormPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const { data: transactionData, isLoading: isLoadingTransaction } = useMerchantTransactionQuery({
    guid: id || "",
    querySettings: { enabled: isEditMode },
  });

  const { data: merchantsData } = useMerchantsQuery({
    params: { limit: 1000 },
  });

  const createMutation = useCreateMerchantTransaction();
  const updateMutation = useUpdateMerchantTransaction();

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<TransactionFormData>({
    defaultValues: {
      merchants_id: "",
      amount: 0,
      comment: "",
    },
  });

  useEffect(() => {
    if (isEditMode && transactionData) {
      const transaction = (transactionData as any)?.data || transactionData;
      reset({
        merchants_id: transaction.merchants_id || "",
        amount: transaction.amount || 0,
        comment: transaction.comment || "",
      });
    }
  }, [transactionData, isEditMode, reset]);

  const onSubmit = async (data: TransactionFormData) => {
    try {
      const payload = {
        merchants_id: data.merchants_id,
        amount: Number(data.amount),
        comment: data.comment,
        type: ["payment"], // Hardcoded type for create/edit
      };

      if (isEditMode) {
        await updateMutation.mutateAsync({ guid: id!, data: payload });
      } else {
        await createMutation.mutateAsync({ data: payload });
      }

      navigate("/finance/merchant-reconciliation");
    } catch (error) {
      console.error("Mutation error:", error);
    }
  };

  if (isEditMode && isLoadingTransaction) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  const merchants = (merchantsData as any)?.response || [];
  const merchantOptions = merchants.map((m: any) => ({
    value: m.guid,
    label: m.name,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
          {isEditMode ? t("merchant_transactions.edit") : t("merchant_transactions.add")}
        </h2>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <FormSelect
                control={control}
                name="merchants_id"
                label={t("merchant_transactions.merchant")}
                placeholder={t("merchant_transactions.merchant_placeholder")}
                options={merchantOptions}
              />
            </div>

            <FormInput
              control={control}
              name="amount"
              label={t("merchant_transactions.amount_label")}
              type="number"
              placeholder="0"
            />

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t("merchant_transactions.comment")}
              </label>
              <textarea
                {...control.register("comment")}
                rows={4}
                placeholder={t("merchant_transactions.comment_placeholder")}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/finance/merchant-reconciliation")}
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("common.saving") : isEditMode ? t("common.save") : t("products.create")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
