import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, CalendarClock, CreditCard, Download, Lock, X } from "lucide-react";
import {
  SHOW_INVOICES_TO_CLIENT,
  useBillingStatus,
  useCanManageBilling,
  usePaymeConfig,
  type BillingStatus,
} from "../api/services/billing.service";
import { formatDate, formatUsd, formatUzs } from "../modules/Settings/Billing/format";
import { useTranslation } from "../i18n";
import type { MessageKey } from "../i18n/messages";

const DISMISS_KEY = "billing-renewal-dismissed";

const TONES = {
  gray: "border-gray-200 bg-gray-50 text-gray-700",
  warning: "border-warning-200 bg-warning-50 text-warning-800",
  error: "border-error-200 bg-error-50 text-error-800",
} as const;

const readDismissed = (): string | null => {
  try {
    return sessionStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
};

export const invoicePrintPath = (invoiceId: string) => `/billing/invoices/${invoiceId}/print`;

/**
 * Полоса о подписке между шапкой и страницей. Вид задаёт banner.kind —
 * из дат здесь ничего не выводится (ADR-0009). Свою высоту кладёт в
 * --billing-banner-h: страницы с высотой «экран минус шапка» её вычитают.
 */
export default function BillingBanner() {
  const { t } = useTranslation();
  const { data: status } = useBillingStatus();
  const canManage = useCanManageBilling();
  const [dismissed, setDismissed] = useState(readDismissed);
  const ref = useRef<HTMLDivElement>(null);

  const content = status ? describe(status, canManage, t) : null;
  // «Оплатить картой» — только если касса включена; вопрос задаём, лишь когда есть что оплачивать.
  const payable = canManage && Boolean(status?.open_invoice) && !["none", "canceled"].includes(status?.banner.kind ?? "none");
  const { data: payme } = usePaymeConfig(payable);
  // Скрытие — до своей даты, а не навсегда: сдвинули дату списания или
  // окончания доступа — баннер снова виден.
  const dismissKey = status
    ? `${status.banner.kind}:${status.banner.kind === "cancel_scheduled" ? status.banner.ends_on ?? "" : status.next_renewal_date ?? ""}`
    : "";
  const visible = Boolean(content) && !(content?.dismissible && dismissed === dismissKey);

  useLayoutEffect(() => {
    const root = document.documentElement.style;
    const el = ref.current;
    if (!visible || !el) return;
    const observer = new ResizeObserver(() =>
      root.setProperty("--billing-banner-h", `${el.offsetHeight}px`)
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.removeProperty("--billing-banner-h");
    };
  }, [visible]);

  if (!visible || !content || !status) return null;

  const payByCard = content.action === "invoice" && Boolean(status.open_invoice) && payme?.enabled === true;
  const downloadInvoice = content.action === "invoice" && Boolean(status.open_invoice) && SHOW_INVOICES_TO_CLIENT;
  // Долг, а платить из баннера нечем (касса выключена, счёт не показываем) —
  // ведём на страницу: там сказано, что делать.
  const details = content.action === "details" || (content.action === "invoice" && !payByCard && !downloadInvoice);

  const Icon = content.icon;
  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, dismissKey);
    } catch {
      // Приватный режим: скроем до перезагрузки.
    }
    setDismissed(dismissKey);
  };

  return (
    <div
      ref={ref}
      role={content.tone === "gray" ? "status" : "alert"}
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2.5 text-sm lg:px-6 ${TONES[content.tone]}`}
    >
      <Icon size={18} className="shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 font-medium">{content.text}</p>

      {details && (
        <Link
          to="/settings/billing"
          className="shrink-0 rounded-lg px-3 py-1.5 font-semibold underline-offset-2 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {t("billing.banner.details")}
        </Link>
      )}

      {payByCard && (
        <Link
          to="/settings/billing?topup=1"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 font-semibold shadow-theme-xs ring-1 ring-inset ring-black/10 transition-colors hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <CreditCard size={15} aria-hidden />
          {t("billing.banner.pay_card")}
        </Link>
      )}

      {downloadInvoice && status.open_invoice && (
        <a
          href={invoicePrintPath(status.open_invoice.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 font-semibold shadow-theme-xs ring-1 ring-inset ring-black/10 transition-colors hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <Download size={15} aria-hidden />
          {t("billing.banner.download_invoice")}
        </a>
      )}

      {content.dismissible && (
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("billing.banner.dismiss")}
          title={t("billing.banner.dismiss")}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <X size={16} aria-hidden />
        </button>
      )}
    </div>
  );
}

type BannerContent = {
  tone: keyof typeof TONES;
  icon: typeof AlertTriangle;
  text: string;
  action: "details" | "invoice" | null;
  dismissible: boolean;
};

const describe = (
  status: BillingStatus,
  canManage: boolean,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
): BannerContent | null => {
  const { banner } = status;
  const blocked = banner.kind === "read_only" || banner.kind === "canceled";

  // Рядовому сотруднику суммы не показываем, но в блокировке он должен понять,
  // почему не работают кнопки.
  if (!canManage) {
    return blocked
      ? { tone: "error", icon: Lock, text: t("billing.banner.employee_read_only"), action: null, dismissible: false }
      : null;
  }

  const days = banner.days_left ?? 0;
  const vars = {
    days,
    number: banner.invoice_number ?? "",
    amount: formatUzs(banner.amount_uzs ?? 0),
  };

  switch (banner.kind) {
    case "renewal_soon":
      return {
        tone: "gray",
        icon: CalendarClock,
        text: t(days === 0 ? "billing.banner.renewal_today" : "billing.banner.renewal_soon", {
          days,
          amount: formatUsd(banner.amount_usd ?? 0),
        }),
        action: "details",
        dismissible: true,
      };
    case "cancel_scheduled":
      return {
        tone: "gray",
        icon: CalendarClock,
        text: t("billing.banner.cancel_scheduled", { date: formatDate(banner.ends_on) }),
        action: "details",
        dismissible: true,
      };
    // Номер счёта в тексте — только когда счёт клиенту показываем: иначе он ни к чему не ведёт.
    case "past_due":
      return {
        tone: "warning",
        icon: AlertTriangle,
        text: SHOW_INVOICES_TO_CLIENT
          ? t(days === 0 ? "billing.banner.past_due_last_day" : "billing.banner.past_due", vars)
          : t(days === 0 ? "billing.banner.past_due_amount_last_day" : "billing.banner.past_due_amount", vars),
        action: "invoice",
        dismissible: false,
      };
    case "read_only":
      return {
        tone: "error",
        icon: Lock,
        text: t(SHOW_INVOICES_TO_CLIENT ? "billing.banner.read_only" : "billing.banner.read_only_amount", vars),
        action: "invoice",
        dismissible: false,
      };
    case "canceled":
      return { tone: "error", icon: Lock, text: t("billing.banner.canceled"), action: null, dismissible: false };
    default:
      return null;
  }
};
