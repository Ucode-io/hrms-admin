import { useCallback, useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { Plus, X } from "lucide-react";

import PageMeta from "../../../components/common/PageMeta";
import Button from "../../../components/ui/button/Button";
import Spinner from "../../../components/ui/Spinner";
import { Modal } from "../../../components/ui/modal";
import { BCP47, useTranslation } from "../../../i18n";
import type { MessageKey } from "../../../i18n/messages";
import {
  broadcastsService,
  DELIVERY_STATUSES,
  type Broadcast,
  type DeliveryStatus,
  type Recipient,
} from "../../../api/services/broadcasts.service";

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

// Пока у рассылки есть доставки в очереди, счётчики обновляются опросом.
export const POLL_MS = 5000;

/** Вкладки «События» и «Рассылки» — общие у обеих страниц «Уведомлений бота». */
export function BotNotificationsTabs() {
  const { t } = useTranslation();
  const tab = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
      isActive
        ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white"
        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
    }`;
  return (
    <nav className="inline-flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900">
      <NavLink to="/settings/notifications" end className={tab}>
        {t("settings_misc.broadcasts.tab_events")}
      </NavLink>
      <NavLink to="/settings/notifications/broadcasts" className={tab}>
        {t("settings_misc.broadcasts.tab_broadcasts")}
      </NavLink>
    </nav>
  );
}

// Отказы reports приходят текстом ошибки; человеку — по-человечески.
const SERVER_ERRORS: Record<string, MessageKey> = {
  Forbidden: "settings_misc.broadcasts.error_forbidden",
  "Broadcast was changed": "settings_misc.broadcasts.error_changed",
  "Only drafts can be edited": "settings_misc.broadcasts.error_already_sent",
  "Only drafts can be deleted": "settings_misc.broadcasts.error_already_sent",
  "Broadcast is already sent": "settings_misc.broadcasts.error_already_sent",
  "Broadcast cannot be recalled": "settings_misc.broadcasts.error_recall_expired",
  "Broadcast not found": "settings_misc.broadcasts.error_not_found",
  "Broadcast text is too long": "settings_misc.broadcasts.error_input_too_long",
};

export const isForbidden = (error: unknown) => error instanceof Error && error.message === "Forbidden";

export const broadcastError = (error: unknown, t: T) => {
  const message = error instanceof Error ? error.message : "";
  const key = SERVER_ERRORS[message];
  return key ? t(key) : message || t("settings_misc.broadcasts.error_generic");
};

export const formatDateTime = (value: string | null, locale: keyof typeof BCP47) =>
  value
    ? new Date(value).toLocaleString(BCP47[locale], {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

/** Текст Telegram → одна строка для списка. */
const excerpt = (body: string) =>
  body
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

export function StatusBadge({ broadcast }: { broadcast: Broadcast }) {
  const { t } = useTranslation();
  const [key, cls] =
    broadcast.status === "draft"
      ? (["settings_misc.broadcasts.status_draft", "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-400"] as const)
      : broadcast.status === "recalled"
        ? (["settings_misc.broadcasts.status_recalled", "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400"] as const)
        : broadcast.in_progress
          ? (["settings_misc.broadcasts.status_sending", "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"] as const)
          : (["settings_misc.broadcasts.status_sent", "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500"] as const);
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{t(key)}</span>;
}

const COUNTER_STYLE: Record<DeliveryStatus, string> = {
  sent: "text-success-700 dark:text-success-500",
  queued: "text-brand-600 dark:text-brand-400",
  blocked: "text-error-600 dark:text-error-500",
  no_recipient: "text-warning-700 dark:text-warning-400",
  failed: "text-error-600 dark:text-error-500",
  recalled: "text-gray-500 dark:text-gray-400",
};

/**
 * Счётчики доставок. Клик — список людей и групп с этим статусом: отсюда HR
 * идёт просить перезапустить бота.
 */
export function DeliveryCounters({ broadcast }: { broadcast: Broadcast }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<DeliveryStatus | null>(null);
  const shown = DELIVERY_STATUSES.filter((status) => broadcast.counts[status] > 0);

  if (broadcast.status === "draft") return <span className="text-gray-300 dark:text-gray-600">—</span>;
  if (!shown.length) return <span className="text-xs text-gray-400">{t("settings_misc.broadcasts.no_deliveries")}</span>;

  // Счётчики стоят в кликабельной строке списка, а модалка без портала:
  // клик по ней иначе всплыл бы до строки и увёл на рассылку.
  return (
    <div onClick={(event) => event.stopPropagation()}>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {shown.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setOpen(status)}
            className={`cursor-pointer whitespace-nowrap rounded text-xs hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${COUNTER_STYLE[status]}`}
          >
            <span className="font-semibold tabular-nums">{broadcast.counts[status]}</span>{" "}
            {t(`settings_misc.broadcasts.count_${status}` as MessageKey)}
          </button>
        ))}
      </div>
      {open && <RecipientsModal guid={broadcast.guid} status={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function RecipientsModal({ guid, status, onClose }: { guid: string; status: DeliveryStatus; onClose: () => void }) {
  const { t, locale } = useTranslation();
  const [items, setItems] = useState<Recipient[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    broadcastsService
      .recipients(guid, status)
      .then((list) => !cancelled && setItems(list))
      .catch((reason) => !cancelled && setError(broadcastError(reason, t)));
    return () => {
      cancelled = true;
    };
  }, [guid, status]);

  const groupName = (item: Recipient) =>
    item.company
      ? t("settings_misc.broadcasts.group_company")
      : item.branches.length
        ? t("settings_misc.broadcasts.group_of", { names: item.branches.join(", ") })
        : t("settings_misc.broadcasts.group_unknown");

  return (
    <Modal isOpen onClose={onClose} showCloseButton={false} className="mx-4 w-full max-w-[560px] overflow-hidden rounded-2xl border border-gray-200 p-0 shadow-xl dark:border-gray-800">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white/90">
          {t(`settings_misc.broadcasts.count_${status}` as MessageKey)}
          {items && <span className="ml-1.5 font-normal text-gray-400">{items.length}</span>}
        </h3>
        <button type="button" onClick={onClose} aria-label={t("settings_misc.broadcasts.close")} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/5">
          <X size={16} />
        </button>
      </div>
      {(status === "blocked" || status === "no_recipient") && (
        <p className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-600 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400">
          {t(status === "blocked" ? "settings_misc.broadcasts.hint_blocked" : "settings_misc.broadcasts.hint_no_recipient")}
        </p>
      )}
      <div className="max-h-[60vh] overflow-y-auto px-4 py-2">
        {error ? (
          <p className="py-6 text-center text-sm text-error-600">{error}</p>
        ) : items === null ? (
          <div className="flex justify-center py-6"><Spinner size="sm" /></div>
        ) : !items.length ? (
          <p className="py-6 text-center text-sm text-gray-500">{t("settings_misc.broadcasts.nobody")}</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((item, index) => (
              <li key={index} className="py-2 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-gray-800 dark:text-white/90">
                    {item.kind === "group" ? groupName(item) : item.name || t("settings_misc.broadcasts.unnamed")}
                  </span>
                  {item.sent_at && <span className="shrink-0 text-xs text-gray-400">{formatDateTime(item.sent_at, locale)}</span>}
                </div>
                {item.error && <p className="mt-0.5 break-words text-xs text-gray-500 dark:text-gray-400">{item.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

/** Настройки → «Уведомления бота» → «Рассылки»: журнал рассылок компании. */
export default function BroadcastsPage() {
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const [items, setItems] = useState<Broadcast[] | null>(null);
  const [error, setError] = useState<"forbidden" | "failed" | null>(null);

  const load = useCallback(
    () =>
      broadcastsService
        .list()
        .then((list) => {
          setItems(list);
          setError(null);
        })
        .catch((reason) => {
          console.error("broadcasts: загрузка не удалась", reason);
          setError(isForbidden(reason) ? "forbidden" : "failed");
        }),
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  const inProgress = Boolean(items?.some((item) => item.in_progress));
  useEffect(() => {
    if (!inProgress) return;
    const timer = window.setTimeout(load, POLL_MS);
    return () => clearTimeout(timer);
  }, [items, inProgress, load]);

  return (
    <>
      <PageMeta title={t("settings_misc.broadcasts.page_title")} description={t("settings_misc.broadcasts.page_subtitle")} />

      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            {t("settings_misc.bot_notifications.page_title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("settings_misc.broadcasts.page_subtitle")}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <BotNotificationsTabs />
          {error !== "forbidden" && (
            <Button size="sm" startIcon={<Plus className="size-4" aria-hidden />} onClick={() => navigate("/settings/notifications/broadcasts/new")}>
              {t("settings_misc.broadcasts.new")}
            </Button>
          )}
        </div>

        {error ? (
          <div className="rounded-xl border border-gray-200 p-8 text-center dark:border-gray-800">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {t(error === "forbidden" ? "settings_misc.broadcasts.forbidden" : "settings_misc.broadcasts.load_error")}
            </p>
            {error === "failed" && (
              <Button size="sm" variant="outline" className="mt-4" onClick={() => void load()}>
                {t("settings_misc.bot_notifications.retry")}
              </Button>
            )}
          </div>
        ) : items === null ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : !items.length ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
            <p className="text-sm text-gray-700 dark:text-gray-300">{t("settings_misc.broadcasts.empty")}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("settings_misc.broadcasts.empty_hint")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left dark:border-gray-800 dark:bg-white/[0.03]">
                  <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{t("settings_misc.broadcasts.col_text")}</th>
                  <th className="w-32 px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{t("settings_misc.broadcasts.col_status")}</th>
                  <th className="w-72 px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{t("settings_misc.broadcasts.col_delivery")}</th>
                  <th className="w-44 px-4 py-3 font-medium text-gray-700 dark:text-gray-300">{t("settings_misc.broadcasts.col_date")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.guid}
                    onClick={() => navigate(`/settings/notifications/broadcasts/${item.guid}`)}
                    className="cursor-pointer border-t border-gray-100 align-top transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/[0.02]"
                  >
                    <td className="max-w-0 px-4 py-3">
                      <p className="truncate text-gray-800 dark:text-white/90">
                        {excerpt(item.body) || (
                          <span className="text-gray-400">
                            {item.form.attachment ? item.form.attachment.name || t("settings_misc.broadcasts.attachment_only") : t("settings_misc.broadcasts.no_text")}
                          </span>
                        )}
                      </p>
                      {item.author_name && <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{item.author_name}</p>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge broadcast={item} /></td>
                    <td className="px-4 py-3"><DeliveryCounters broadcast={item} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-gray-400">
                      {formatDateTime(item.sent_at || item.created_at, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
