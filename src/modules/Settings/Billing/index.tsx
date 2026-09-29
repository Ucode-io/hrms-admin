import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useSearchParams } from "react-router";
import { useQueryClient } from "react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowRightLeft, Ban, CreditCard, Lock, Pencil, Printer, Trash2, UserRound, X } from "lucide-react";
import PageMeta from "../../../components/common/PageMeta";
import Badge from "../../../components/ui/badge/Badge";
import { useTranslation } from "../../../i18n";
import type { MessageKey } from "../../../i18n/messages";
import {
  BILLING_QUERY_KEYS,
  INVOICES_PAGE_SIZE,
  PAYME_CONFIG_KEY,
  SHOW_INVOICES_TO_CLIENT,
  changePlan,
  deleteSavedCard,
  useBillingInvoices,
  useBillingOverview,
  useBillingStatus,
  useBillingTransactions,
  usePaymeConfig,
  type BillingInvoice,
  type BillingOverview,
  type BillingStatus,
  type BillingTransaction,
  type InvoiceStatus,
  type SavedCard,
  type SubscriptionStatus,
  type Topup,
} from "../../../api/services/billing.service";
import { invoicePrintPath } from "../../../layout/BillingBanner";
import { daysFromToday, formatDate, formatUsd, formatUzs, fullCardMask, shortCard, tashkentDay } from "./format";
import PlanChangeModal from "./PlanChangeModal";
import TopUpModal from "./TopUpModal";

const STATUS_BADGE: Record<SubscriptionStatus, "success" | "warning" | "error" | "light"> = {
  unbilled: "light",
  active: "success",
  past_due: "warning",
  read_only: "error",
  canceled: "light",
};

const INVOICE_BADGE: Record<InvoiceStatus, "warning" | "success" | "light"> = {
  open: "warning",
  paid: "success",
  void: "light",
};

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

/**
 * Страница «Биллинг» (редизайн 28.09 по референсу владельца): полоса долга,
 * «Текущий план» и «Способ оплаты» рядом, ниже «История списаний».
 * Деньги меняют только действия, правила которых на сервере: оплата картой
 * (новой или сохранённой), смена плана, отмена запланированного перехода и
 * удаление сохранённой карты.
 */
const BillingSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: status } = useBillingStatus();
  const overview = useBillingOverview();
  const payme = usePaymeConfig(Boolean(overview.data));
  const paymeConfig = payme.data?.enabled ? payme.data : null;
  // Касса ответила «выключено» или не ответила вовсе. Пока запрос идёт — не пугаем.
  const cardUnavailable = !paymeConfig && (payme.isFetched || payme.isError);
  const [topUpAmount, setTopUpAmount] = useState<number | null>(null);
  // «Сменить» карту: окно оплаты сразу с формой новой карты.
  const [topUpNewCard, setTopUpNewCard] = useState(false);
  const [planChangeOpen, setPlanChangeOpen] = useState(false);
  // Нехватка при смене плана: после пополнения возвращаемся в окно с этим планом.
  const [resumePlanId, setResumePlanId] = useState<string | null>(null);
  const [planChangeInitial, setPlanChangeInitial] = useState<string | null>(null);
  const [cancelingPending, setCancelingPending] = useState(false);

  // Баннер «Оплатить картой» ведёт сюда с ?topup=1 — сразу открываем форму.
  const wantsTopUp = searchParams.get("topup") === "1";
  const defaultTopUp = overview.data?.status.open_invoice?.amount_to_pay_uzs ?? 0;
  useEffect(() => {
    if (!wantsTopUp || !payme.isFetched) return;
    if (paymeConfig) setTopUpAmount(defaultTopUp);
    setSearchParams((params) => {
      params.delete("topup");
      return params;
    }, { replace: true });
  }, [wantsTopUp, payme.isFetched, paymeConfig, defaultTopUp, setSearchParams]);

  // Нет прав (Forbidden) или компания вне биллинга — страницы для человека нет.
  if (status?.status === "unbilled" || overview.error instanceof Error && overview.error.message === "Forbidden") {
    return <Navigate to="/settings" replace />;
  }

  const data = overview.data;
  const subStatus = data?.status.status ?? status?.status;
  const canceled = subStatus === "canceled";
  const inDebt = subStatus === "past_due" || subStatus === "read_only";
  const toPay = data?.status.open_invoice?.amount_to_pay_uzs ?? data?.open_invoices[0]?.amount_uzs ?? 0;
  const cardsSupported = payme.data?.cards_supported === true;
  const savedCard = cardsSupported ? payme.data?.card ?? null : null;
  const usableCard = savedCard && !savedCard.expired ? savedCard : null;

  const openTopUp = (amount: number, newCard = false) => {
    setTopUpNewCard(newCard);
    setTopUpAmount(amount);
  };

  /** Снять запланированный переход — это «выбрать текущий план ещё раз». */
  const cancelPending = async () => {
    if (!data?.plan) return;
    setCancelingPending(true);
    try {
      await changePlan(data.plan.id, crypto.randomUUID());
      for (const key of BILLING_QUERY_KEYS) void queryClient.invalidateQueries(key);
      toast.success(t("billing.plan.pending_canceled"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("billing.load_error"));
    } finally {
      setCancelingPending(false);
    }
  };

  return (
    <>
      <PageMeta title={t("billing.page_title")} description={t("billing.page_title")} />

      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold text-gray-900">{t("billing.page_title")}</h1>
            <p className="mt-1 text-sm text-gray-500">{t("billing.page_subtitle")}</p>
          </div>
          {subStatus && (
            <Badge color={STATUS_BADGE[subStatus]}>{t(`billing.status.${subStatus}` as MessageKey)}</Badge>
          )}
        </header>

        {overview.isLoading && <PageSkeleton />}

        {overview.isError && !overview.isLoading && (
          <div className="rounded-2xl border border-error-200 bg-error-50 px-5 py-4 text-sm text-error-700">
            {overview.error instanceof Error ? overview.error.message : t("billing.load_error")}
          </div>
        )}

        {data && (
          <>
            {inDebt && (
              <DebtStrip
                readOnly={subStatus === "read_only"}
                amount={toPay}
                daysLeft={data.status.banner.days_left ?? null}
                graceUntil={data.status.grace_until}
                payLabel={
                  paymeConfig
                    ? usableCard
                      ? t("billing.debt.pay_saved", { card: shortCard(usableCard.pan_masked) })
                      : t("billing.banner.pay_card")
                    : null
                }
                onPay={() => openTopUp(toPay)}
                cardUnavailable={cardUnavailable}
              />
            )}

            {canceled && <CanceledStrip />}

            <div className={`grid grid-cols-1 gap-4 ${canceled ? "lg:grid-cols-2" : "lg:grid-cols-[3fr_2fr]"}`}>
              {!canceled && data.plan && (
                <PlanSummaryCard
                  data={data}
                  ai={data.status.ai ?? status?.ai ?? null}
                  inDebt={inDebt}
                  cancelingPending={cancelingPending}
                  onChangePlan={() => setPlanChangeOpen(true)}
                  onCancelPending={() => void cancelPending()}
                />
              )}
              <PaymentMethodCard
                cardsSupported={cardsSupported}
                card={savedCard}
                balance={data.account.balance_uzs}
                canceled={canceled}
                canPay={Boolean(paymeConfig)}
                cardUnavailable={cardUnavailable}
                onTopUp={() => openTopUp(inDebt ? toPay : 0)}
                onChangeCard={() => openTopUp(inDebt ? toPay : 0, true)}
              />
            </div>

            {SHOW_INVOICES_TO_CLIENT && <InvoicesSection />}
            <HistorySection />
          </>
        )}
      </div>

      {paymeConfig && (
        <TopUpModal
          isOpen={topUpAmount !== null}
          onClose={() => {
            setTopUpAmount(null);
            setTopUpNewCard(false);
            setResumePlanId(null);
          }}
          config={paymeConfig}
          defaultAmount={topUpAmount ?? 0}
          canceled={canceled}
          preferNewCard={topUpNewCard}
          onSucceeded={
            resumePlanId
              ? (topup: Topup) => {
                  // Деньги на балансе — снова окно смены плана со свежим расчётом.
                  setTopUpAmount(null);
                  setTopUpNewCard(false);
                  toast.success(t("billing.plan_change.topped_up", { amount: formatUzs(topup.credited_uzs) }));
                  if (topup.card_save === "saved") toast.success(t("billing.topup.card_saved", { card: shortCard(topup.card_mask) }));
                  setPlanChangeInitial(resumePlanId);
                  setResumePlanId(null);
                  setPlanChangeOpen(true);
                }
              : undefined
          }
        />
      )}
      {data?.plan && (
        <PlanChangeModal
          isOpen={planChangeOpen}
          onClose={() => {
            setPlanChangeOpen(false);
            setPlanChangeInitial(null);
          }}
          currentPlanId={data.plan.id}
          pendingPlan={data.pending_plan}
          nextRenewalDate={data.subscription?.next_renewal_date ?? null}
          initialPlanId={planChangeInitial}
          onTopUp={
            paymeConfig
              ? (amount, planId) => {
                  setPlanChangeOpen(false);
                  setPlanChangeInitial(null);
                  setResumePlanId(planId);
                  setTopUpAmount(amount);
                }
              : null
          }
        />
      )}
    </>
  );
};

const BTN_PRIMARY =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white shadow-theme-xs transition-colors hover:bg-brand-600 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";
const BTN_SECONDARY =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 transition-colors hover:bg-gray-50 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";
const BTN_ICON =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-brand-500";
const BTN_LINK =
  "font-medium text-brand-600 underline-offset-2 hover:underline disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-brand-500";
/** Подпись над значением: «ТАРИФ», «БАЛАНС» — как в референсе. */
const CAPTION = "text-xs font-medium uppercase tracking-wide text-gray-500";

/** Карточка с заголовком в полосе и действием справа, как «Current Plan Summary». */
const Panel: React.FC<{ title: string; action?: ReactNode; className?: string; children: ReactNode }> = ({
  title,
  action,
  className = "",
  children,
}) => (
  <section className={`flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white ${className}`}>
    <div className="flex min-h-[60px] flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {action}
    </div>
    <div className="flex flex-1 flex-col p-5">{children}</div>
  </section>
);

/**
 * Долг во всю ширину над карточками: сколько внести, сколько дней до «только
 * просмотра» (grace_until — первый день блокировки) и одна кнопка оплаты.
 */
const DebtStrip: React.FC<{
  readOnly: boolean;
  amount: number;
  daysLeft: number | null;
  graceUntil: string | null;
  payLabel: string | null;
  onPay: () => void;
  cardUnavailable: boolean;
}> = ({ readOnly, amount, daysLeft, graceUntil, payLabel, onPay, cardUnavailable }) => {
  const { t } = useTranslation();
  const Icon = readOnly ? Lock : AlertTriangle;
  const hint = readOnly
    ? t("billing.debt.read_only_hint")
    : daysLeft && daysLeft > 0
      ? t("billing.debt.days_left", { days: daysLeft, date: formatDate(graceUntil) })
      : t("billing.debt.last_day");
  return (
    <section
      className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 ${
        readOnly ? "border-error-200 bg-error-25" : "border-warning-200 bg-warning-25"
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            readOnly ? "bg-error-100 text-error-600" : "bg-warning-100 text-warning-600"
          }`}
        >
          <Icon size={18} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">
            {t(readOnly ? "billing.debt.title_read_only" : "billing.debt.title_past_due")}
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-gray-900">{formatUzs(amount)}</p>
          <p className="mt-1 text-sm text-gray-700">{hint}</p>
        </div>
      </div>
      {payLabel ? (
        <button type="button" className={BTN_PRIMARY} onClick={onPay}>
          <CreditCard size={16} aria-hidden />
          {payLabel}
        </button>
      ) : cardUnavailable ? (
        <p className="max-w-xs text-sm text-gray-700">{t("billing.open_invoice.card_unavailable")}</p>
      ) : null}
    </section>
  );
};

/** Подписка остановлена: плана на странице нет, только куда обратиться. */
const CanceledStrip: React.FC = () => {
  const { t } = useTranslation();
  return (
    <section className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-5">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-600">
        <Ban size={18} aria-hidden />
      </span>
      <div>
        <p className="text-sm font-semibold text-gray-900">{t("billing.canceled.title")}</p>
        <p className="mt-1 text-sm text-gray-600">{t("billing.canceled.hint")}</p>
      </div>
    </section>
  );
};

/** Полоса расхода: сотрудники в тарифе, лимит AI. */
const Meter: React.FC<{ label: string; value: string; share: number; tone: string }> = ({ label, value, share, tone }) => {
  const bar = Math.round(Math.min(Math.max(share, 0), 1) * 100);
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className={CAPTION}>{label}</span>
        <span className="text-sm tabular-nums text-gray-700">{value}</span>
      </div>
      <div
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={bar}
        aria-label={`${label}: ${value}`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${tone}`}
          style={{ width: `${bar}%` }}
        />
      </div>
    </div>
  );
};

/** Цена тарифа без нулевых центов: «$250», но «$12.50». */
const planPrice = (usd: number): string => (Number.isInteger(usd) ? `$${usd}` : formatUsd(usd));

const Column: React.FC<{ label: string; note?: string | null; children: ReactNode }> = ({ label, note, children }) => (
  <div className="min-w-0">
    <p className={`${CAPTION} truncate`}>{label}</p>
    <p className="mt-1.5 whitespace-nowrap text-lg font-semibold tabular-nums text-gray-900">{children}</p>
    {note && <p className="mt-0.5 text-sm text-gray-500">{note}</p>}
  </div>
);

/**
 * «Текущий план»: тариф, когда следующее списание, цена; ниже расход мест и AI.
 * В долгу следующего списания нет — месяц начнётся с дня оплаты.
 */
const PlanSummaryCard: React.FC<{
  data: BillingOverview;
  ai: BillingStatus["ai"];
  inDebt: boolean;
  cancelingPending: boolean;
  onChangePlan: () => void;
  onCancelPending: () => void;
}> = ({ data, ai, inDebt, cancelingPending, onChangePlan, onCancelPending }) => {
  const { t } = useTranslation();
  const plan = data.plan!;
  const sub = data.subscription;
  const cancelScheduled = Boolean(sub?.cancel_at_period_end);
  const canChangePlan = data.status.status === "active" && !cancelScheduled;

  const nextDate = sub?.next_renewal_date ?? data.status.next_renewal_date;
  const accessDays = daysFromToday(sub?.current_period_end);
  const nextDays = daysFromToday(nextDate);
  const middle = cancelScheduled
    ? {
        label: t("billing.summary.access_until"),
        value: formatDate(sub?.current_period_end),
        note: accessDays !== null && accessDays >= 0 ? t("billing.summary.days", { days: accessDays }) : null,
      }
    : inDebt
      ? { label: t("billing.summary.next_charge"), value: t("billing.summary.after_payment"), note: null }
      : {
          label: t("billing.summary.next_charge"),
          value: formatDate(nextDate),
          note:
            nextDays === null
              ? null
              : nextDays <= 0
                ? t("billing.summary.today")
                : t("billing.summary.in_days", { days: nextDays }),
        };

  const included = plan.included_seats;
  const over = data.over_seats_now;
  const seatShare = included > 0 ? data.seats_now / included : data.seats_now > 0 ? 1 : 0;
  const aiPercent = ai?.enabled ? Math.round(Math.max(0, ai.used_share ?? 0) * 100) : null;

  const action = canChangePlan ? (
    plan.is_active === false ? (
      <span className="text-sm text-gray-500" title={t("billing.plan.individual")}>
        {t("billing.summary.individual")}
      </span>
    ) : (
      <button type="button" className={BTN_PRIMARY} onClick={onChangePlan}>
        <ArrowRightLeft size={16} aria-hidden />
        {t("billing.plan.change")}
      </button>
    )
  ) : null;

  return (
    <Panel title={t("billing.summary.title")} action={action}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)]">
        <Column label={t("billing.summary.plan")}>{plan.title}</Column>
        <Column label={middle.label} note={middle.note}>
          {middle.value}
        </Column>
        <Column label={t("billing.summary.price")}>{t("billing.summary.per_month", { price: planPrice(plan.price_usd) })}</Column>
      </div>

      {data.pending_plan && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <span>{t("billing.summary.pending", { date: formatDate(nextDate), plan: data.pending_plan.title })}</span>
          <button
            type="button"
            className={BTN_ICON}
            disabled={cancelingPending}
            onClick={onCancelPending}
            title={t("billing.plan.pending_cancel")}
            aria-label={t("billing.plan.pending_cancel")}
          >
            <X size={15} aria-hidden />
          </button>
        </div>
      )}

      <div className="mt-6 space-y-5">
        <Meter
          label={t("billing.summary.seats")}
          value={
            over > 0
              ? t("billing.summary.seats_over", {
                  now: data.seats_now,
                  included,
                  over,
                  price: formatUsd(plan.overage_price_usd),
                })
              : t("billing.summary.seats_value", { now: data.seats_now, included })
          }
          share={seatShare}
          tone={over > 0 ? "bg-warning-500" : "bg-brand-500"}
        />
        {aiPercent !== null && (
          <Meter
            label={t("billing.summary.ai")}
            value={t("billing.summary.ai_used", { percent: aiPercent })}
            share={aiPercent / 100}
            // Последний ответ копилот не обрывает — доля может быть чуть больше 100 %.
            tone={aiPercent >= 100 ? "bg-error-500" : aiPercent >= 80 ? "bg-warning-500" : "bg-brand-500"}
          />
        )}
      </div>
    </Panel>
  );
};

/** Знак платёжной системы: цветная плашка с надписью (логотипов в проекте нет). */
const BRAND: Record<string, { label: string; className: string }> = {
  UZCARD: { label: "UZCARD", className: "bg-[#1d4ed8]" },
  HUMO: { label: "HUMO", className: "bg-[#ea7a0f]" },
};

const BrandMark: React.FC<{ type: string }> = ({ type }) => {
  const brand = BRAND[type.toUpperCase()] ?? { label: type || "CARD", className: "bg-gray-700" };
  return (
    <span
      className={`flex h-9 w-14 shrink-0 items-center justify-center rounded-md text-[10px] font-bold tracking-wide text-white ${brand.className}`}
    >
      {brand.label}
    </span>
  );
};

/**
 * «Способ оплаты»: сохранённая карта компании (одна) плашкой, как в референсе,
 * со значками «сменить» и «удалить»; ниже баланс и «Пополнить». Касса выключена —
 * платить нечем, но удалить карту можно.
 */
const PaymentMethodCard: React.FC<{
  cardsSupported: boolean;
  card: SavedCard | null;
  balance: number;
  canceled: boolean;
  canPay: boolean;
  cardUnavailable: boolean;
  onTopUp: () => void;
  onChangeCard: () => void;
}> = ({ cardsSupported, card, balance, canceled, canPay, cardUnavailable, onTopUp, onChangeCard }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    if (!card) return;
    setDeleting(true);
    try {
      await deleteSavedCard(card.id);
      await queryClient.invalidateQueries(PAYME_CONFIG_KEY);
      toast.success(t("billing.payment_method.deleted"));
      setConfirming(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("billing.load_error"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Panel title={t("billing.payment_method.title")}>
      {cardsSupported &&
        (card ? (
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <BrandMark type={card.card_type} />
              <div className="ml-auto flex shrink-0 gap-1">
                {canPay && (
                  <button
                    type="button"
                    className={BTN_ICON}
                    onClick={onChangeCard}
                    title={t("billing.payment_method.change_card")}
                    aria-label={t("billing.payment_method.change_card")}
                  >
                    <Pencil size={15} aria-hidden />
                  </button>
                )}
                <button
                  type="button"
                  className={`${BTN_ICON} hover:text-error-600`}
                  onClick={() => setConfirming(true)}
                  title={t("billing.payment_method.delete_card")}
                  aria-label={t("billing.payment_method.delete_card")}
                >
                  <Trash2 size={15} aria-hidden />
                </button>
              </div>
            </div>
            <p className="mt-3 whitespace-nowrap text-base font-medium tabular-nums tracking-wider text-gray-900">
              {fullCardMask(card.pan_masked)}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
              <span className={`tabular-nums ${card.expired ? "font-medium text-error-600" : ""}`}>
                {t(card.expired ? "billing.payment_method.expired_on" : "billing.payment_method.expires", { expire: card.expire })}
              </span>
              {card.added_by?.name && (
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  <UserRound size={12} aria-hidden />
                  {card.added_by.name} · {formatDate(tashkentDay(card.created_at))}
                </span>
              )}
            </div>
            {confirming && (
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3 text-sm">
                <p className="text-gray-900">
                  {t("billing.payment_method.delete_confirm", { card: shortCard(card.pan_masked) })}
                </p>
                <div className="flex gap-3">
                  <button type="button" className={`${BTN_LINK} text-error-600`} disabled={deleting} onClick={() => void remove()}>
                    {t("billing.payment_method.delete_yes")}
                  </button>
                  <button type="button" className={BTN_LINK} disabled={deleting} onClick={() => setConfirming(false)}>
                    {t("billing.payment_method.cancel")}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-dashed border-gray-300 p-4">
            <CreditCard size={18} className="mt-0.5 shrink-0 text-gray-400" aria-hidden />
            <p className="text-sm text-gray-600">{t("billing.payment_method.none")}</p>
          </div>
        ))}

      <div className={`flex flex-wrap items-end justify-between gap-3 ${cardsSupported ? "mt-5 border-t border-gray-100 pt-5" : ""}`}>
        <div className="min-w-0">
          <p className={CAPTION}>{t("billing.balance.title")}</p>
          <p className={`mt-1.5 text-2xl font-semibold tabular-nums ${balance < 0 ? "text-error-600" : "text-gray-900"}`}>
            {formatUzs(balance)}
          </p>
          {balance !== 0 && (
            <p className="mt-1 text-sm text-gray-500">
              {canceled && balance < 0
                ? t("billing.payment_method.debt", { amount: formatUzs(-balance) })
                : t(balance < 0 ? "billing.balance.negative" : "billing.balance.positive")}
            </p>
          )}
        </div>
        {canPay && (
          <button type="button" className={BTN_SECONDARY} onClick={onTopUp}>
            <CreditCard size={16} aria-hidden />
            {t("billing.payment_method.top_up")}
          </button>
        )}
      </div>
      {canceled && canPay && <p className="mt-3 text-xs text-gray-500">{t("billing.topup.canceled_hint")}</p>}
      {cardUnavailable && <p className="mt-3 text-sm text-gray-600">{t("billing.open_invoice.card_unavailable")}</p>}
    </Panel>
  );
};

const HISTORY_STEP = 20;
const HISTORY_MAX = 200;

/** Метка типа операции: деньги пришли — зелёная, отсрочка — жёлтая, остальное — серая. */
const TX_TONE: Record<string, string> = {
  topup_card: "bg-success-50 text-success-700",
  topup_bank: "bg-success-50 text-success-700",
  adjustment_credit: "bg-success-50 text-success-700",
  refund: "bg-success-50 text-success-700",
  charge_grace_day: "bg-warning-50 text-warning-700",
};

const INVOICE_PREFIX = /^HRMS-\d{4}-\d+:\s*/;

/**
 * Подпись под меткой — по-человечески и без лишнего: без номера счёта (счета
 * клиенту не показываем) и без комментариев оператора (решение 28.09): у
 * корректировки подписи нет, у перевода — только номер платёжки.
 */
const txDetail = (t: T, tx: BillingTransaction): string | null => {
  switch (tx.type) {
    case "topup_card": {
      const mask = tx.description.match(/\d{4,6}\*+\d{4}/);
      return mask ? t("billing.tx.by_card", { card: shortCard(mask[0]) }) : null;
    }
    case "topup_bank": {
      const reference = typeof tx.meta?.reference === "string" ? tx.meta.reference.trim() : "";
      return reference ? t("billing.tx.bank_ref", { ref: reference }) : t("billing.tx.bank");
    }
    case "adjustment_credit":
    case "adjustment_debit":
    case "refund":
      return null;
    case "charge_grace_day": {
      const day = tx.description.match(/\d{4}-\d{2}-\d{2}/);
      return day ? t("billing.tx.grace_for", { date: formatDate(day[0]) }) : null;
    }
    case "charge_plan":
      return tx.description.replace(INVOICE_PREFIX, "").replace(/^Тариф\s+/, "") || null;
    default:
      return tx.description.replace(INVOICE_PREFIX, "") || null;
  }
};

const txTypeLabel = (t: T, type: string): string => {
  const key = `billing.tx_type.${type}` as MessageKey;
  const label = t(key);
  return label === key ? type : label;
};

/** «История списаний» строками-плашками, как таблица Invoice в референсе. */
const HistorySection: React.FC = () => {
  const { t } = useTranslation();
  const [limit, setLimit] = useState(HISTORY_STEP);
  const { data, isLoading, isFetching } = useBillingTransactions(limit);
  const rows = data?.transactions ?? [];
  const canLoadMore = rows.length >= limit && limit < HISTORY_MAX;
  const cols = "sm:grid-cols-[110px_minmax(0,1fr)_170px_150px]";

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-xl font-semibold text-gray-900">{t("billing.tx.title")}</h2>
        <p className="mt-1 text-sm text-gray-500">{t("billing.tx.subtitle")}</p>
      </div>

      {isLoading ? (
        <RowsSkeleton />
      ) : rows.length === 0 ? (
        <Empty text={t("billing.tx.empty")} />
      ) : (
        <div className="space-y-2">
          <div className={`hidden gap-4 px-4 pb-1 ${cols} sm:grid`}>
            <span className={CAPTION}>{t("billing.tx.date")}</span>
            <span className={CAPTION}>{t("billing.tx.operation")}</span>
            <span className={`${CAPTION} text-right`}>{t("billing.tx.amount")}</span>
            <span className={`${CAPTION} text-right`}>{t("billing.tx.balance_after")}</span>
          </div>
          {rows.map((tx) => {
            const detail = txDetail(t, tx);
            return (
              <div
                key={tx.id}
                className={`grid grid-cols-1 gap-1 rounded-xl border border-gray-200 bg-white px-4 py-3 sm:items-center sm:gap-4 ${cols}`}
              >
                <span className="text-sm tabular-nums text-gray-600">{formatDate(tashkentDay(tx.created_at))}</span>
                <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TX_TONE[tx.type] ?? "bg-gray-100 text-gray-700"}`}
                  >
                    {txTypeLabel(t, tx.type)}
                  </span>
                  {detail && <span className="min-w-0 break-words text-sm text-gray-700">{detail}</span>}
                </span>
                <span
                  className={`text-sm font-semibold tabular-nums sm:text-right ${
                    tx.amount_uzs < 0 ? "text-gray-900" : "text-success-600"
                  }`}
                >
                  {tx.amount_uzs > 0 ? "+" : ""}
                  {formatUzs(tx.amount_uzs)}
                </span>
                <span
                  className={`text-sm tabular-nums sm:text-right ${tx.balance_after_uzs < 0 ? "text-error-600" : "text-gray-500"}`}
                >
                  {formatUzs(tx.balance_after_uzs)}
                </span>
              </div>
            );
          })}
          {canLoadMore && (
            <div className="pt-2 text-center">
              <button
                type="button"
                className={BTN_SECONDARY}
                disabled={isFetching}
                onClick={() => setLimit(limit + HISTORY_STEP)}
              >
                {t("billing.tx.more")}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

// ───── счета: скрыты от клиента (SHOW_INVOICES_TO_CLIENT), код держим живым ─────

const PrintLink: React.FC<{ invoiceId: string; primary?: boolean }> = ({ invoiceId, primary }) => {
  const { t } = useTranslation();
  return (
    <a
      href={invoicePrintPath(invoiceId)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("billing.print")}
      title={t("billing.print")}
      className={
        primary
          ? "inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white shadow-theme-xs transition-colors hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          : "inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-500"
      }
    >
      <Printer size={primary ? 16 : 15} aria-hidden />
      {primary && t("billing.print")}
    </a>
  );
};

const TableShell: React.FC<{ title: string; children: ReactNode; footer?: ReactNode }> = ({
  title,
  children,
  footer,
}) => (
  <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
    <h2 className="border-b border-gray-100 px-5 py-4 text-base font-semibold text-gray-900">{title}</h2>
    <div className="overflow-x-auto">{children}</div>
    {footer}
  </section>
);

const TH = "px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500";
const TD = "px-5 py-3 text-sm text-gray-700";

const InvoicesSection: React.FC = () => {
  const { t } = useTranslation();
  const [offset, setOffset] = useState(0);
  const { data, isLoading, isFetching } = useBillingInvoices(offset);
  const invoices: BillingInvoice[] = data?.invoices ?? [];
  const total = data?.count ?? 0;

  const footer =
    total > INVOICES_PAGE_SIZE ? (
      <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-3 text-sm text-gray-600">
        <span className="tabular-nums">
          {t("billing.pagination.range", {
            from: offset + 1,
            to: Math.min(offset + INVOICES_PAGE_SIZE, total),
            total,
          })}
        </span>
        <div className="flex gap-2">
          <PagerButton disabled={offset === 0 || isFetching} onClick={() => setOffset(offset - INVOICES_PAGE_SIZE)}>
            {t("billing.pagination.prev")}
          </PagerButton>
          <PagerButton
            disabled={offset + INVOICES_PAGE_SIZE >= total || isFetching}
            onClick={() => setOffset(offset + INVOICES_PAGE_SIZE)}
          >
            {t("billing.pagination.next")}
          </PagerButton>
        </div>
      </div>
    ) : null;

  return (
    <TableShell title={t("billing.invoices.title")} footer={footer}>
      {isLoading ? (
        <RowsSkeleton />
      ) : invoices.length === 0 ? (
        <Empty text={t("billing.invoices.empty")} />
      ) : (
        <table className="w-full min-w-[640px]">
          <thead className="bg-gray-50">
            <tr>
              <th className={TH}>{t("billing.invoices.number")}</th>
              <th className={TH}>{t("billing.invoices.period")}</th>
              <th className={`${TH} text-right`}>{t("billing.invoices.amount")}</th>
              <th className={TH}>{t("billing.invoices.status")}</th>
              <th className={TH}>
                <span className="sr-only">{t("billing.print")}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.map((invoice) => (
              <tr key={invoice.id} className="transition-colors hover:bg-gray-25">
                <td className={`${TD} font-medium text-gray-900`}>{invoice.number}</td>
                <td className={`${TD} whitespace-nowrap tabular-nums`}>
                  {formatDate(invoice.period_start)} – {formatDate(invoice.period_end)}
                </td>
                <td className={`${TD} whitespace-nowrap text-right tabular-nums`}>{formatUzs(invoice.amount_uzs)}</td>
                <td className={TD}>
                  <Badge size="sm" color={INVOICE_BADGE[invoice.status]}>
                    {t(`billing.invoice_status.${invoice.status}` as MessageKey)}
                  </Badge>
                </td>
                <td className={`${TD} w-12 text-right`}>
                  <PrintLink invoiceId={invoice.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </TableShell>
  );
};

const PagerButton: React.FC<{ disabled: boolean; onClick: () => void; children: ReactNode }> = ({
  disabled,
  onClick,
  children,
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="cursor-pointer rounded-lg px-3 py-1.5 font-medium text-gray-700 ring-1 ring-inset ring-gray-300 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
  >
    {children}
  </button>
);

const Empty: React.FC<{ text: string }> = ({ text }) => (
  <p className="rounded-xl border border-dashed border-gray-200 px-5 py-10 text-center text-sm text-gray-500">{text}</p>
);

const RowsSkeleton: React.FC = () => (
  <div className="space-y-2" aria-hidden>
    {[0, 1, 2].map((i) => (
      <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100 motion-reduce:animate-none" />
    ))}
  </div>
);

/** Функция бывает холодной — первый ответ идёт секунды, держим форму страницы. */
const PageSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]" aria-busy="true">
    {[0, 1].map((i) => (
      <div key={i} className="h-64 animate-pulse rounded-2xl bg-gray-100 motion-reduce:animate-none" />
    ))}
  </div>
);

export default BillingSettingsPage;
