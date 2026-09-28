import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useSearchParams } from "react-router";
import { useQueryClient } from "react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowRightLeft, CreditCard, Printer, Sparkles, Users, Wallet } from "lucide-react";
import PageMeta from "../../../components/common/PageMeta";
import Badge from "../../../components/ui/badge/Badge";
import { useTranslation } from "../../../i18n";
import type { MessageKey } from "../../../i18n/messages";
import {
  BILLING_QUERY_KEYS,
  INVOICES_PAGE_SIZE,
  SHOW_INVOICES_TO_CLIENT,
  changePlan,
  useBillingInvoices,
  useBillingOverview,
  useBillingStatus,
  useBillingTransactions,
  usePaymeConfig,
  type BillingInvoice,
  type InvoiceStatus,
  type SubscriptionStatus,
} from "../../../api/services/billing.service";
import { invoicePrintPath } from "../../../layout/BillingBanner";
import { formatDate, formatUsd, formatUzs } from "./format";
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

/**
 * Деньги здесь меняют только три действия, и все их правила — на сервере:
 * пополнение картой (Payme, номер карты к нам не приходит), смена плана
 * (предпросмотр → подтверждение) и отмена запланированного перехода.
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
  const [planChangeOpen, setPlanChangeOpen] = useState(false);
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
  const openInvoice = data?.open_invoices[0];
  const toPay = data?.status.open_invoice?.amount_to_pay_uzs ?? openInvoice?.amount_uzs ?? 0;
  const ai = data?.status.ai ?? status?.ai;
  const cancelScheduled = Boolean(data?.subscription?.cancel_at_period_end);
  const canChangePlan = subStatus === "active" && Boolean(data?.plan) && !cancelScheduled;
  // Как оплатить долг. Без счёта на клиенте путь один — карта; касса выключена — к Udevs.
  const howToPay = SHOW_INVOICES_TO_CLIENT
    ? t(paymeConfig ? "billing.open_invoice.how_card" : "billing.open_invoice.how")
    : paymeConfig
      ? t("billing.open_invoice.how_card_only")
      : cardUnavailable
        ? t("billing.open_invoice.card_unavailable")
        : null;

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
        <header className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold text-gray-900">{t("billing.page_title")}</h1>
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
            {openInvoice && !canceled && (
              <section
                className={`rounded-2xl border p-5 ${
                  subStatus === "read_only" ? "border-error-200 bg-error-25" : "border-warning-200 bg-warning-25"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <AlertTriangle
                        size={16}
                        className={subStatus === "read_only" ? "text-error-600" : "text-warning-600"}
                        aria-hidden
                      />
                      {t("billing.open_invoice.title")} · {openInvoice.number}
                    </p>
                    <p className="mt-2 text-3xl font-semibold tabular-nums text-gray-900">{formatUzs(toPay)}</p>
                    <p className="mt-1 text-sm text-gray-600">{t("billing.open_invoice.to_pay")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {paymeConfig && (
                      <button type="button" className={BTN_PRIMARY} onClick={() => setTopUpAmount(toPay)}>
                        <CreditCard size={16} aria-hidden />
                        {t("billing.banner.pay_card")}
                      </button>
                    )}
                    {SHOW_INVOICES_TO_CLIENT && <PrintLink invoiceId={openInvoice.id} primary={!paymeConfig} />}
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                  <Fact label={t("billing.open_invoice.amount")} value={formatUzs(openInvoice.amount_uzs)} />
                  <Fact label={t("billing.open_invoice.due")} value={formatDate(openInvoice.due_date)} />
                  <Fact
                    label={t("billing.invoices.period")}
                    value={`${formatDate(openInvoice.period_start)} – ${formatDate(openInvoice.period_end)}`}
                  />
                </dl>
                {howToPay && <p className="mt-4 text-sm text-gray-600">{howToPay}</p>}
              </section>
            )}

            {!canceled && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Card icon={Wallet} title={data.plan?.title ?? "—"}>
                  {data.plan && (
                    <p className="text-2xl font-semibold tabular-nums text-gray-900">
                      {t("billing.plan.per_month", { price: formatUsd(data.plan.price_usd) })}
                    </p>
                  )}
                  {cancelScheduled ? (
                    // Отмена в конце периода: списания не будет — пишем, до какого дня доступ.
                    <p className="mt-2 text-sm text-gray-600">
                      {t("billing.plan.access_until")}:{" "}
                      <span className="font-medium text-gray-900">{formatDate(data.subscription?.current_period_end)}</span>
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-gray-600">
                      {t("billing.plan.next_renewal")}:{" "}
                      <span className="font-medium text-gray-900">
                        {formatDate(data.subscription?.next_renewal_date ?? data.status.next_renewal_date)}
                      </span>
                    </p>
                  )}
                  {data.status.grace_until && (
                    <p className="mt-1 text-sm text-gray-600">
                      {t("billing.plan.grace_until")}:{" "}
                      <span className="font-medium text-gray-900">{formatDate(data.status.grace_until)}</span>
                    </p>
                  )}
                  {data.pending_plan && (
                    <p className="mt-2 text-sm text-gray-600">
                      {t("billing.plan.pending", {
                        date: formatDate(data.subscription?.next_renewal_date),
                        plan: data.pending_plan.title,
                      })}{" "}
                      <button
                        type="button"
                        className={BTN_LINK}
                        disabled={cancelingPending}
                        onClick={() => void cancelPending()}
                      >
                        {t("billing.plan.pending_cancel")}
                      </button>
                    </p>
                  )}
                  {canChangePlan &&
                    (data.plan?.is_active === false ? (
                      <p className="mt-3 text-sm text-gray-500">{t("billing.plan.individual")}</p>
                    ) : (
                      <button type="button" className={`${BTN_CARD} mt-3`} onClick={() => setPlanChangeOpen(true)}>
                        <ArrowRightLeft size={15} aria-hidden />
                        {t("billing.plan.change")}
                      </button>
                    ))}
                </Card>

                <Card icon={Wallet} title={t("billing.balance.title")}>
                  <p
                    className={`text-2xl font-semibold tabular-nums ${
                      data.account.balance_uzs < 0 ? "text-error-600" : "text-gray-900"
                    }`}
                  >
                    {formatUzs(data.account.balance_uzs)}
                  </p>
                  {data.account.balance_uzs !== 0 && (
                    <p className="mt-2 text-sm text-gray-600">
                      {t(data.account.balance_uzs < 0 ? "billing.balance.negative" : "billing.balance.positive")}
                    </p>
                  )}
                  {/* При открытом счёте оплата картой — в блоке счёта выше, второй кнопки не нужно. */}
                  {paymeConfig && !openInvoice && (
                    <button type="button" className={`${BTN_CARD} mt-3`} onClick={() => setTopUpAmount(0)}>
                      <CreditCard size={15} aria-hidden />
                      {t("billing.topup.button")}
                    </button>
                  )}
                </Card>

                <Card icon={Users} title={t("billing.seats.title")}>
                  <p className="text-2xl font-semibold tabular-nums text-gray-900">{data.seats_now}</p>
                  {data.plan && (
                    <p className="mt-2 text-sm text-gray-600">
                      {t("billing.seats.value", { now: data.seats_now, included: data.plan.included_seats })}
                    </p>
                  )}
                  {data.over_seats_now > 0 && data.plan && (
                    <p className="mt-1 text-sm font-medium text-warning-700">
                      {t("billing.seats.over", {
                        count: data.over_seats_now,
                        price: formatUsd(data.plan.overage_price_usd),
                      })}
                    </p>
                  )}
                </Card>

                {ai?.enabled && <AiCard share={ai.used_share} />}
              </div>
            )}

            {SHOW_INVOICES_TO_CLIENT && <InvoicesSection />}
            <TransactionsSection />
          </>
        )}
      </div>

      {paymeConfig && (
        <TopUpModal
          isOpen={topUpAmount !== null}
          onClose={() => setTopUpAmount(null)}
          config={paymeConfig}
          defaultAmount={topUpAmount ?? 0}
          canceled={canceled}
        />
      )}
      {data?.plan && (
        <PlanChangeModal
          isOpen={planChangeOpen}
          onClose={() => setPlanChangeOpen(false)}
          currentPlanId={data.plan.id}
          pendingPlan={data.pending_plan}
          nextRenewalDate={data.subscription?.next_renewal_date ?? null}
          onTopUp={
            paymeConfig
              ? (amount) => {
                  setPlanChangeOpen(false);
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
  "inline-flex shrink-0 items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white shadow-theme-xs transition-colors hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";
/** Действие внутри узкой карточки: без рамки, чтобы не переносилось на две строки. */
const BTN_CARD =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded text-sm font-medium text-brand-600 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";
const BTN_LINK =
  "font-medium text-brand-600 underline-offset-2 hover:underline disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-brand-500";

const Card: React.FC<{ icon: typeof Wallet; title: string; children: ReactNode }> = ({
  icon: Icon,
  title,
  children,
}) => (
  <section className="rounded-2xl border border-gray-200 bg-white p-5">
    <p className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-500">
      <span className="flex h-7 w-7 items-center justify-center rounded-md border border-brand-100 bg-brand-50 text-brand-500">
        <Icon size={14} aria-hidden />
      </span>
      {title}
    </p>
    {children}
  </section>
);

const Fact: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <dt className="text-gray-500">{label}</dt>
    <dd className="mt-0.5 font-medium tabular-nums text-gray-900">{value}</dd>
  </div>
);

/** Лимит AI — в долларах себестоимости, клиенту показываем только процент. */
const AiCard: React.FC<{ share: number }> = ({ share }) => {
  const { t } = useTranslation();
  // spent может чуть превысить лимит — последний ответ копилот не обрывает.
  const percent = Math.round(Math.max(0, share) * 100);
  const bar = Math.min(percent, 100);
  const tone = percent >= 100 ? "bg-error-500" : percent >= 80 ? "bg-warning-500" : "bg-brand-500";
  return (
    <Card icon={Sparkles} title={t("billing.ai.title")}>
      <p className="text-2xl font-semibold tabular-nums text-gray-900">{percent}%</p>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={bar}
        aria-label={t("billing.ai.used", { percent })}
      >
        <div className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${tone}`} style={{ width: `${bar}%` }} />
      </div>
      <p className="mt-2 text-sm text-gray-600">{t("billing.ai.used", { percent })}</p>
    </Card>
  );
};

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

const TransactionsSection: React.FC = () => {
  const { t } = useTranslation();
  const { data, isLoading } = useBillingTransactions();
  const rows = data?.transactions ?? [];

  return (
    <TableShell title={t("billing.tx.title")}>
      {isLoading ? (
        <RowsSkeleton />
      ) : rows.length === 0 ? (
        <Empty text={t("billing.tx.empty")} />
      ) : (
        <table className="w-full min-w-[640px]">
          <thead className="bg-gray-50">
            <tr>
              <th className={TH}>{t("billing.tx.date")}</th>
              <th className={TH}>{t("billing.tx.operation")}</th>
              <th className={`${TH} text-right`}>{t("billing.tx.amount")}</th>
              <th className={`${TH} text-right`}>{t("billing.tx.balance_after")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((tx) => (
              <tr key={tx.id}>
                <td className={`${TD} whitespace-nowrap tabular-nums`}>{formatDate(tx.created_at)}</td>
                <td className={TD}>
                  <p className="font-medium text-gray-900">{txTypeLabel(t, tx.type)}</p>
                  {tx.description && <p className="mt-0.5 text-xs text-gray-500">{tx.description}</p>}
                </td>
                <td
                  className={`${TD} whitespace-nowrap text-right font-medium tabular-nums ${
                    tx.amount_uzs < 0 ? "text-error-600" : "text-success-600"
                  }`}
                >
                  {tx.amount_uzs > 0 ? "+" : ""}
                  {formatUzs(tx.amount_uzs)}
                </td>
                <td
                  className={`${TD} whitespace-nowrap text-right tabular-nums ${
                    tx.balance_after_uzs < 0 ? "text-error-600" : ""
                  }`}
                >
                  {formatUzs(tx.balance_after_uzs)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </TableShell>
  );
};

const txTypeLabel = (t: (key: MessageKey) => string, type: string): string => {
  const key = `billing.tx_type.${type}` as MessageKey;
  const label = t(key);
  return label === key ? type : label;
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
  <p className="px-5 py-10 text-center text-sm text-gray-500">{text}</p>
);

const RowsSkeleton: React.FC = () => (
  <div className="space-y-3 px-5 py-4" aria-hidden>
    {[0, 1, 2].map((i) => (
      <div key={i} className="h-5 animate-pulse rounded bg-gray-100 motion-reduce:animate-none" />
    ))}
  </div>
);

/** Функция бывает холодной — первый ответ идёт секунды, держим форму страницы. */
const PageSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" aria-busy="true">
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="h-36 animate-pulse rounded-2xl bg-gray-100 motion-reduce:animate-none" />
    ))}
  </div>
);

export default BillingSettingsPage;
