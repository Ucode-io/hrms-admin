import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "react-query";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { Modal } from "../../../components/ui/modal";
import { useTranslation } from "../../../i18n";
import {
  BILLING_QUERY_KEYS,
  changePlan,
  previewPlanChange,
  useBillingPlans,
  type BillingPlan,
  type PlanChangeResult,
} from "../../../api/services/billing.service";
import { formatDate, formatUsd, formatUzs } from "./format";

// Смена плана самим клиентом (решения 25.09). Правила считает сервер — и для
// предпросмотра, и для перехода одной функцией, поэтому окно показывает ровно
// то, что спишется: дороже — сразу с доплатой за остаток месяца с баланса,
// дешевле — со следующего продления без списания.

const PRIMARY =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";
const SECONDARY =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";

const PlanChangeModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  currentPlanId: string;
  pendingPlan: BillingPlan | null;
  nextRenewalDate: string | null;
  /** Нет денег на повышение: открыть пополнение на недостающую сумму. null — оплаты картой нет. */
  onTopUp: ((amountUzs: number) => void) | null;
}> = ({ isOpen, onClose, currentPlanId, pendingPlan, nextRenewalDate, onTopUp }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const plans = useBillingPlans(isOpen);
  const [preview, setPreview] = useState<PlanChangeResult | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Один request_id на подтверждение: двойной клик не спишет дважды.
  const requestIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPreview(null);
    setCheckingId(null);
    setError(null);
    requestIdRef.current = null;
  }, [isOpen]);

  const choose = async (plan: BillingPlan) => {
    setError(null);
    setCheckingId(plan.id);
    try {
      setPreview(await previewPlanChange(plan.id));
      requestIdRef.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : t("billing.load_error"));
    } finally {
      setCheckingId(null);
    }
  };

  const confirm = async () => {
    if (!preview) return;
    setError(null);
    setBusy(true);
    requestIdRef.current = requestIdRef.current || crypto.randomUUID();
    try {
      const result = await changePlan(
        preview.plan.id,
        requestIdRef.current,
        preview.mode === "upgrade" ? preview.amount_uzs : undefined
      );
      if (result.mode === "insufficient") {
        // Баланс успел уменьшиться между предпросмотром и нажатием.
        setPreview(result);
        requestIdRef.current = null;
        return;
      }
      for (const key of [...BILLING_QUERY_KEYS, "billing-plans"]) void queryClient.invalidateQueries(key);
      toast.success(
        result.mode === "upgrade"
          ? t("billing.plan_change.done_upgrade", { plan: result.plan.title })
          : t("billing.plan_change.done_downgrade", { plan: result.plan.title, date: formatDate(result.applies_on) })
      );
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      requestIdRef.current = null;
      if (message.startsWith("Сумма доплаты изменилась")) {
        // Курс или баланс поменялись — показываем новую сумму и просим подтвердить ещё раз.
        setError(t("billing.plan_change.amount_changed"));
        try {
          setPreview(await previewPlanChange(preview.plan.id));
        } catch {
          setPreview(null);
        }
        return;
      }
      setError(message || t("billing.load_error"));
    } finally {
      setBusy(false);
    }
  };

  const currentTitle = plans.data?.find((plan) => plan.id === currentPlanId)?.title ?? "";

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-3xl p-6">
      {/* pr-12: справа крестик модалки. */}
      <div className="pr-12">
        <h3 className="text-lg font-semibold text-gray-900">{t("billing.plan_change.title")}</h3>
        <p className="mt-1 text-sm text-gray-500">{t("billing.plan_change.hint")}</p>
      </div>

      {!preview && (
        <div className="mt-5">
          {plans.isLoading && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-40 animate-pulse rounded-xl bg-gray-100 motion-reduce:animate-none" />
              ))}
            </div>
          )}
          {plans.data && (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {plans.data.map((plan) => {
                const current = plan.id === currentPlanId;
                const scheduled = plan.id === pendingPlan?.id;
                return (
                  <li key={plan.id}>
                    <button
                      type="button"
                      disabled={current || Boolean(checkingId)}
                      onClick={() => void choose(plan)}
                      className={`flex h-full w-full flex-col rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                        current
                          ? "cursor-default border-brand-300 bg-brand-25"
                          : "border-gray-200 bg-white hover:border-brand-300 hover:bg-gray-50 disabled:opacity-60"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-base font-semibold text-gray-900">{plan.title}</span>
                        {current && (
                          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600">
                            {t("billing.plan_change.current")}
                          </span>
                        )}
                        {scheduled && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                            {t("billing.plan_change.scheduled", { date: formatDate(nextRenewalDate) })}
                          </span>
                        )}
                      </span>
                      <span className="mt-2 text-xl font-semibold tabular-nums text-gray-900">
                        {t("billing.plan.per_month", { price: formatUsd(plan.price_usd) })}
                      </span>
                      <span className="mt-3 space-y-1 text-sm text-gray-600">
                        <span className="block">{t("billing.plan_change.seats", { count: plan.included_seats })}</span>
                        <span className="block">
                          {t("billing.plan_change.overage", { price: formatUsd(plan.overage_price_usd) })}
                        </span>
                        {!plan.ai_enabled && <span className="block">{t("billing.plan_change.ai_off")}</span>}
                      </span>
                      {!current && (
                        <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-medium text-brand-600">
                          {checkingId === plan.id ? (
                            <>
                              <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden />
                              {t("billing.plan_change.checking")}
                            </>
                          ) : (
                            t("billing.plan_change.choose")
                          )}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {preview && (
        <div className="mt-5 space-y-4">
          <div
            className={`rounded-xl border p-4 text-sm ${
              preview.mode === "insufficient" ? "border-warning-200 bg-warning-25 text-gray-800" : "border-gray-200 bg-gray-50 text-gray-800"
            }`}
            role="status"
          >
            <p className="text-base font-semibold text-gray-900">
              {preview.from_plan.title} → {preview.plan.title}
            </p>
            <p className="mt-2">
              {preview.mode === "upgrade" &&
                (preview.amount_uzs > 0
                  ? t("billing.plan_change.upgrade", {
                      amount: formatUzs(preview.amount_uzs),
                      days: preview.remaining_days ?? 0,
                      date: formatDate(nextRenewalDate),
                      plan: preview.plan.title,
                    })
                  : t("billing.plan_change.upgrade_free", { plan: preview.plan.title }))}
              {preview.mode === "insufficient" &&
                t("billing.plan_change.insufficient", {
                  amount: formatUzs(preview.amount_uzs),
                  balance: formatUzs(preview.balance_uzs ?? 0),
                  shortfall: formatUzs(preview.shortfall_uzs),
                })}
              {preview.mode === "downgrade" &&
                t("billing.plan_change.downgrade", {
                  plan: preview.plan.title,
                  date: formatDate(preview.applies_on),
                  current: currentTitle || preview.from_plan.title,
                })}
            </p>
          </div>

          {error && <p className="text-sm text-error-600">{error}</p>}

          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={SECONDARY} onClick={() => setPreview(null)} disabled={busy}>
              <ArrowLeft size={16} aria-hidden />
              {t("billing.plan_change.back")}
            </button>
            {preview.mode === "insufficient" ? (
              onTopUp && (
                <button type="button" className={PRIMARY} onClick={() => onTopUp(preview.shortfall_uzs)}>
                  {t("billing.topup.button")}
                </button>
              )
            ) : (
              <button type="button" className={PRIMARY} onClick={() => void confirm()} disabled={busy}>
                {busy ? (
                  <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden />
                ) : (
                  <Check size={16} aria-hidden />
                )}
                {preview.mode === "upgrade" && preview.amount_uzs > 0
                  ? t("billing.plan_change.confirm_upgrade", { amount: formatUzs(preview.amount_uzs) })
                  : preview.mode === "upgrade"
                    ? t("billing.plan_change.confirm_now")
                    : t("billing.plan_change.confirm_downgrade", { date: formatDate(preview.applies_on) })}
              </button>
            )}
          </div>
        </div>
      )}

      {!preview && error && <p className="mt-3 text-sm text-error-600">{error}</p>}
    </Modal>
  );
};

export default PlanChangeModal;
