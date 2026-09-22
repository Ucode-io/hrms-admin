import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react-lite";
import { Calendar, Edit3, Plus, Search, Trash2 } from "lucide-react";
import DOMPurify from "dompurify";
import { Link } from "react-router";
import { toast } from "sonner";
import PageMeta from "../../components/common/PageMeta";
import Spinner from "../../components/ui/Spinner";
import Button from "../../components/ui/button/Button";
import {
  NotificationItem,
  useDeleteNotification,
  useNotificationsQuery,
} from "../../api/services/notification.service";
import { translate, useTranslation } from "../../i18n";

const formatDisplayDate = (value: string, locale: string) => {
  if (!value) return translate("notifications_news.no_date");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return translate("notifications_news.no_date");
  return date.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
};

const htmlToPlainText = (value: string) => {
  const cleaned = DOMPurify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  return cleaned.replace(/\s+/g, " ").trim();
};

function NewsListPage() {
  const { t, locale } = useTranslation();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const {
    data: newsData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useNotificationsQuery({
    params: {
      search: search || undefined,
      limit: 100,
    },
  });

  const deleteMutation = useDeleteNotification();
  const newsItems = useMemo(() => newsData?.response ?? [], [newsData?.response]);

  const handleDelete = async (item: NotificationItem) => {
    const confirmed = window.confirm(t("notifications_news.delete_confirm", { title: item.title }));
    if (!confirmed) return;

    try {
      await deleteMutation.mutateAsync(item.guid);
      toast.success(t("notifications_news.deleted"));
    } catch (deleteError) {
      toast.error(getErrorMessage(deleteError, t("notifications_news.delete_error")));
    }
  };

  return (
    <>
      <PageMeta title={t("notifications_news.page_title")} description={t("notifications_news.subtitle")} />

      <div className="space-y-4">
        <section className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{t("notifications_news.title")}</h1>
              <p className="mt-1 text-sm text-gray-500">{t("notifications_news.subtitle")}</p>
            </div>
            <Link to="/settings/news/new">
              <Button size="sm" startIcon={<Plus size={16} />}>
                {t("notifications_news.create")}
              </Button>
            </Link>
          </div>

          <div className="mt-4">
            <label className="relative block">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t("notifications_news.search_placeholder")}
                className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm text-gray-700 outline-none transition focus:border-brand-300"
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 md:p-5">
          {isLoading ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <Spinner />
            </div>
          ) : isError ? (
            <div className="rounded-xl border border-error-200 bg-error-50 p-4">
              <p className="text-sm font-medium text-error-700">
                {getErrorMessage(error, t("notifications_news.load_error"))}
              </p>
              <button
                type="button"
                onClick={() => {
                  void refetch();
                }}
                className="mt-3 inline-flex h-9 items-center rounded-lg bg-error-600 px-3 text-sm font-semibold text-white transition hover:bg-error-700"
              >
                {t("common.retry")}
              </button>
            </div>
          ) : newsItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
              {t("notifications_news.empty")}
            </div>
          ) : (
            <div className="grid gap-3">
              {newsItems.map((item) => (
                <article
                  key={item.guid}
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:border-gray-300"
                >
                  <div className="flex flex-col gap-3 p-4 md:flex-row md:items-start">
                    {item.photo ? (
                      <img
                        src={item.photo}
                        alt={item.title}
                        className="h-32 w-full rounded-xl border border-gray-100 object-cover md:h-24 md:w-40"
                      />
                    ) : null}

                    <div className="min-w-0 flex-1 space-y-2">
                      {!item.is_active ? (
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-500">
                          {t("notifications_news.inactive")}
                        </span>
                      ) : null}

                      <h3 className="text-base font-semibold text-gray-900">{item.title}</h3>
                      <p className="line-clamp-3 text-sm text-gray-600">{htmlToPlainText(item.text || "") || "—"}</p>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
                          <Calendar size={14} />
                          {formatDisplayDate(item.published_at, locale)}
                        </div>

                        <div className="inline-flex items-center gap-2">
                          <Link
                            to={`/settings/news/${item.guid}/edit`}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                          >
                            <Edit3 size={13} />
                            {t("common.edit")}
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              void handleDelete(item);
                            }}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                          >
                            <Trash2 size={13} />
                            {t("common.delete")}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {isFetching && !isLoading ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-500">
              <Spinner size="sm" className="h-4 w-4" />
              {t("common.updating")}
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}

export default observer(NewsListPage);
