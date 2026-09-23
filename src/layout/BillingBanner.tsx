import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, CalendarClock, Download, Lock, X } from "lucide-react";
import {
  useBillingStatus,
  useCanManageBilling,
  type BillingStatus,
} from "../api/services/billing.service";
import { formatUsd, formatUzs } from "../modules/Settings/Billing/format";
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
  // Скрытие renewal_soon — до следующей даты списания, а не навсегда.
  const dismissKey = status?.next_renewal_date ?? "";
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

      {content.action === "details" && (
        <Link
          to="/settings/billing"
          className="shrink-0 rounded-lg px-3 py-1.5 font-semibold underline-offset-2 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {t("billing.banner.details")}
        </Link>
      )}

      {content.action === "invoice" && status.open_invoice && (
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
    case "past_due":
      return {
        tone: "warning",
        icon: AlertTriangle,
        text: t(days === 0 ? "billing.banner.past_due_last_day" : "billing.banner.past_due", vars),
        action: "invoice",
        dismissible: false,
      };
    case "read_only":
      return { tone: "error", icon: Lock, text: t("billing.banner.read_only", vars), action: "invoice", dismissible: false };
    case "canceled":
      return { tone: "error", icon: Lock, text: t("billing.banner.canceled"), action: null, dismissible: false };
    default:
      return null;
  }
};
