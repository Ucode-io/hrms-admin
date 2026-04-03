import {
  Bell,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  Calendar,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Sparkles,
} from "lucide-react";
import { Icon } from "@iconify/react";
import DOMPurify from "dompurify";
import { observer } from "mobx-react-lite";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import PageMeta from "../../components/common/PageMeta";
import Spinner from "../../components/ui/Spinner";
import AbsenceRequestModal, {
  type AbsenceRequestAttachmentItem,
  type AbsenceRequestBreakdownItem,
  type AbsenceRequestPolicyOption,
} from "../../components/absences/AbsenceRequestModal";
import { type NotificationItem, useNotificationsQuery } from "../../api/services/notification.service";
import {
  useDashboardAgendaHolidaysQuery,
  useDashboardVacationSummariesQuery,
} from "../../api/services/dashboard.service";
import { useCreateAbsence } from "../../api/services/absenceRequest.service";
import { useUploadFile } from "../../api/services/file-upload.service";
import { type SettingsDirectoryItem, useSettingsDirectoryItemQuery } from "../../api/services/settingsDirectory.service";
import authStore from "../../store/auth.store";
import companyStore from "../../store/company.store";

type AgendaDay = {
  id: string;
  label: string;
  dateKey: string;
  dateLabel: string;
};

const WEEKDAY_LABELS_RU = ["ВС", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ"] as const;
const WEEKDAY_SHORT_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MONTH_SHORT_RU = [
  "янв.",
  "фев.",
  "мар.",
  "апр.",
  "май",
  "июн.",
  "июл.",
  "авг.",
  "сен.",
  "окт.",
  "ноя.",
  "дек.",
];
const FEED_PAGE_SIZE = 4;
const MAX_ATTACHMENTS = 10;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const formatFeedDate = (value: string) => {
  if (!value) return "Без даты";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Без даты";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const htmlToPlainText = (value: string) => {
  const cleaned = DOMPurify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  return cleaned.replace(/\s+/g, " ").trim();
};

const toIsoDate = (value: Date): string => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseIsoDate = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const getWeekStartMonday = (value: Date): Date => {
  const base = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const dayOfWeek = base.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  base.setDate(base.getDate() + diff);
  return base;
};

const buildAgendaWeek = (baseDate: Date): AgendaDay[] => {
  const weekStart = getWeekStartMonday(baseDate);
  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(weekStart);
    current.setDate(weekStart.getDate() + index);
    const dateKey = toIsoDate(current);

    return {
      id: dateKey,
      label: WEEKDAY_LABELS_RU[current.getDay()],
      dateKey,
      dateLabel: String(current.getDate()).padStart(2, "0"),
    };
  });
};

const formatAgendaInfoDate = (value: string, todayIso: string): string => {
  const date = parseIsoDate(value);
  if (!date) return "Без даты";

  const formatted = date
    .toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/\sг\.$/u, "");

  return value === todayIso ? `Сегодня, ${formatted}` : formatted;
};

const formatDays = (value: number, fixed = 1): string => {
  if (!Number.isFinite(value)) return fixed > 0 ? "0.0" : "0";
  return value.toFixed(fixed);
};

const resolveHexColor = (value: string | undefined, fallback: string): string => {
  if (!value) return fallback;
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
};

const withOpacity = (hexColor: string, alpha: number): string => {
  const normalized = hexColor.replace("#", "");
  const numeric = Number.parseInt(normalized, 16);
  const red = (numeric >> 16) & 255;
  const green = (numeric >> 8) & 255;
  const blue = numeric & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const getDateBreakdown = (from: string, to: string): AbsenceRequestBreakdownItem[] => {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (!start || !end || start > end) return [];

  const list: AbsenceRequestBreakdownItem[] = [];
  const cursor = new Date(start);
  let guard = 0;

  while (cursor <= end && guard < 400) {
    const dayOfWeek = cursor.getDay();
    list.push({
      iso: toIsoDate(cursor),
      day: String(cursor.getDate()),
      month: MONTH_SHORT_RU[cursor.getMonth()],
      weekday: WEEKDAY_SHORT_RU[dayOfWeek],
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      value: 1,
    });

    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }

  return list;
};

const resolveRelationTitle = (value: unknown): string => {
  if (!value || typeof value !== "object") return "";
  const source = value as Record<string, unknown>;
  const title = source.title;
  return typeof title === "string" ? title : "";
};

function DashboardPage() {
  const user = authStore.user_data || authStore.user;
  const userBaseId = typeof user?.guid === "string" ? user.guid : "";
  const departmentId = typeof user?.departments_id === "string" ? user.departments_id : "";
  const locationId = typeof user?.locations_id === "string" ? user.locations_id : "";
  const employmentTypeId = typeof user?.employment_types_id === "string" ? user.employment_types_id : "";
  const displayName = user?.first_name || user?.login || "Сотрудник";
  const avatar =
    (typeof user?.photo === "string" && user.photo) ||
    (typeof user?.avatar === "string" && user.avatar) ||
    "/images/user/owner.jpg";

  const { data: departmentData } = useSettingsDirectoryItemQuery({
    slug: "departments",
    guid: departmentId,
    querySettings: { enabled: Boolean(departmentId) },
  });
  const { data: locationData } = useSettingsDirectoryItemQuery({
    slug: "locations",
    guid: locationId,
    querySettings: { enabled: Boolean(locationId) },
  });
  const { data: employmentTypeData } = useSettingsDirectoryItemQuery({
    slug: "employment_types",
    guid: employmentTypeId,
    querySettings: { enabled: Boolean(employmentTypeId) },
  });
  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const agendaDays = useMemo(() => buildAgendaWeek(new Date()), []);
  const [selectedAgendaDate, setSelectedAgendaDate] = useState<string>(todayIso);

  const agendaDateFrom = agendaDays[0]?.dateKey || todayIso;
  const agendaDateTo = agendaDays[agendaDays.length - 1]?.dateKey || todayIso;

  const {
    data: agendaHolidays = [],
    isLoading: isAgendaLoading,
    isFetching: isAgendaFetching,
    isError: isAgendaError,
    refetch: refetchAgenda,
  } = useDashboardAgendaHolidaysQuery({
    params: {
      userBaseId,
      dateFrom: agendaDateFrom,
      dateTo: agendaDateTo,
    },
    querySettings: {
      keepPreviousData: true,
    },
  });

  const {
    data: vacationSummaries = [],
    isLoading: isVacationLoading,
    isFetching: isVacationFetching,
    isError: isVacationError,
    refetch: refetchVacation,
  } = useDashboardVacationSummariesQuery({
    params: {
      userBaseId,
    },
  });
  const [vacationSlideIndex, setVacationSlideIndex] = useState(0);
  const createAbsenceMutation = useCreateAbsence();
  const uploadFileMutation = useUploadFile({ folder: "Media" });
  const [isVacationRequestModalOpen, setIsVacationRequestModalOpen] = useState(false);
  const [requestPolicyId, setRequestPolicyId] = useState("");
  const [requestDateFrom, setRequestDateFrom] = useState(todayIso);
  const [requestDateTo, setRequestDateTo] = useState(todayIso);
  const [requestNote, setRequestNote] = useState("");
  const [requestAttachments, setRequestAttachments] = useState<AbsenceRequestAttachmentItem[]>([]);
  const [isUploadingRequestAttachments, setIsUploadingRequestAttachments] = useState(false);

  const agendaEventsByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of agendaHolidays) {
      if (!item.date || !item.title) continue;
      const list = map.get(item.date) || [];
      if (!list.includes(item.title)) {
        list.push(item.title);
      }
      map.set(item.date, list);
    }
    return map;
  }, [agendaHolidays]);

  const selectedAgendaEvents = useMemo(
    () => agendaEventsByDate.get(selectedAgendaDate) || [],
    [agendaEventsByDate, selectedAgendaDate]
  );

  const selectedAgendaInfoDate = useMemo(
    () => formatAgendaInfoDate(selectedAgendaDate, todayIso),
    [selectedAgendaDate, todayIso]
  );

  useEffect(() => {
    if (vacationSummaries.length === 0) {
      setVacationSlideIndex(0);
      return;
    }
    if (vacationSlideIndex > vacationSummaries.length - 1) {
      setVacationSlideIndex(0);
    }
  }, [vacationSlideIndex, vacationSummaries.length]);

  const activeVacation = vacationSummaries[vacationSlideIndex] || null;
  const activeVacationIcon = activeVacation?.icon || "mdi:airplane";
  const activeVacationColor = resolveHexColor(activeVacation?.color, "#10B981");

  const departmentTitle =
    resolveRelationTitle(user?.departments_id_data) ||
    String((departmentData as SettingsDirectoryItem | null)?.title || "—");
  const locationTitle =
    resolveRelationTitle(user?.locations_id_data) ||
    String((locationData as SettingsDirectoryItem | null)?.title || "—");
  const employmentTypeTitle =
    resolveRelationTitle(user?.employment_types_id_data) ||
    String((employmentTypeData as SettingsDirectoryItem | null)?.title || "—");
  const profileHighlights = useMemo(
    () => [
      { value: departmentTitle || "—", icon: Building2 },
      { value: locationTitle || "—", icon: MapPin },
      { value: employmentTypeTitle || "—", icon: Briefcase },
    ],
    [departmentTitle, locationTitle, employmentTypeTitle]
  );
  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
    []
  );

  const requestPolicyOptions = useMemo<AbsenceRequestPolicyOption[]>(
    () =>
      vacationSummaries.map((item) => ({
        guid: item.policyGuid,
        title: item.policyTitle,
        icon: item.icon,
        color: item.color,
      })),
    [vacationSummaries]
  );

  const requestAvailableByPolicy = useMemo(
    () => new Map(vacationSummaries.map((item) => [item.policyGuid, item.availableDays])),
    [vacationSummaries]
  );

  const requestBreakdown = useMemo(
    () => getDateBreakdown(requestDateFrom, requestDateTo),
    [requestDateFrom, requestDateTo]
  );
  const requestRequestedDays = requestBreakdown.length;
  const requestAvailableDays = requestAvailableByPolicy.get(requestPolicyId) || 0;
  const requestForecastDays = requestAvailableDays - requestRequestedDays;

  const vacationAvailableLabel = useMemo(
    () => formatDays(activeVacation?.availableDays ?? 0, 1),
    [activeVacation?.availableDays]
  );

  const vacationSlideLabel = useMemo(() => {
    if (vacationSummaries.length === 0) return "0 из 0";
    return `${vacationSlideIndex + 1} из ${vacationSummaries.length}`;
  }, [vacationSlideIndex, vacationSummaries.length]);

  const canSlideVacation = vacationSummaries.length > 1;

  const handleVacationPrev = () => {
    if (!canSlideVacation) return;
    setVacationSlideIndex((prev) =>
      prev === 0 ? vacationSummaries.length - 1 : prev - 1
    );
  };

  const handleVacationNext = () => {
    if (!canSlideVacation) return;
    setVacationSlideIndex((prev) =>
      prev === vacationSummaries.length - 1 ? 0 : prev + 1
    );
  };

  const openVacationRequestModal = () => {
    if (!userBaseId) {
      toast.error("Не найден сотрудник.");
      return;
    }

    const fallbackPolicyId = activeVacation?.policyGuid || vacationSummaries[0]?.policyGuid || "";
    if (!fallbackPolicyId) {
      toast.error("Тип отсутствия не найден.");
      return;
    }

    setRequestPolicyId(fallbackPolicyId);
    setRequestDateFrom(todayIso);
    setRequestDateTo(todayIso);
    setRequestNote("");
    setRequestAttachments([]);
    setIsVacationRequestModalOpen(true);
  };

  const closeVacationRequestModal = () => {
    if (createAbsenceMutation.isLoading || isUploadingRequestAttachments) return;
    setIsVacationRequestModalOpen(false);
  };

  const handleRequestDateFromChange = (value: string) => {
    setRequestDateFrom(value);
    if (requestDateTo && value && requestDateTo < value) {
      setRequestDateTo(value);
    }
  };

  const handleRequestAttachmentFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    event.target.value = "";
    if (!files || files.length === 0) return;

    const remainingSlots = MAX_ATTACHMENTS - requestAttachments.length;
    if (remainingSlots <= 0) {
      toast.error(`Можно добавить максимум ${MAX_ATTACHMENTS} файлов.`);
      return;
    }

    const queue = Array.from(files).slice(0, remainingSlots);
    const rejectedBySize = queue.filter((file) => file.size > MAX_FILE_SIZE_BYTES);
    if (rejectedBySize.length > 0) {
      toast.error("Размер каждого файла должен быть не больше 50MB.");
    }

    const accepted = queue.filter((file) => file.size <= MAX_FILE_SIZE_BYTES);
    if (accepted.length === 0) return;

    try {
      setIsUploadingRequestAttachments(true);
      const uploadedItems: AbsenceRequestAttachmentItem[] = [];

      for (const file of accepted) {
        const url = await uploadFileMutation.mutateAsync(file);
        uploadedItems.push({
          name: file.name,
          size: file.size,
          url,
        });
      }

      setRequestAttachments((prev) => [...prev, ...uploadedItems]);
      toast.success("Файлы успешно загружены.");
    } catch (error) {
      console.error("Failed to upload dashboard absence attachments:", error);
      toast.error("Не удалось загрузить вложения.");
    } finally {
      setIsUploadingRequestAttachments(false);
    }
  };

  const removeRequestAttachment = (url: string) => {
    setRequestAttachments((prev) => prev.filter((item) => item.url !== url));
  };

  const submitVacationRequest = async () => {
    if (!userBaseId) {
      toast.error("Не найден сотрудник.");
      return;
    }

    if (!requestPolicyId) {
      toast.error("Выберите тип отсутствия.");
      return;
    }

    if (!requestDateFrom || !requestDateTo) {
      toast.error("Укажите диапазон дат.");
      return;
    }

    if (requestDateFrom > requestDateTo) {
      toast.error("Дата начала не может быть позже даты окончания.");
      return;
    }

    if (requestRequestedDays <= 0) {
      toast.error("В запросе должен быть хотя бы один день.");
      return;
    }

    try {
      await createAbsenceMutation.mutateAsync({
        user_base_id: userBaseId,
        absence_policies_id: requestPolicyId,
        date_from: requestDateFrom,
        date_to: requestDateTo,
        requested_days: requestRequestedDays,
        requested_breakdown: JSON.stringify(
          requestBreakdown.map((item) => ({
            date: item.iso,
            value: item.value ?? 1,
          }))
        ),
        note: requestNote.trim() || null,
        attachments: JSON.stringify(requestAttachments.map((item) => item.url)),
        status: ["pending"],
      });

      toast.success("Запрос на отсутствие создан.");
      closeVacationRequestModal();
    } catch (error) {
      console.error("Failed to create absence request from dashboard:", error);
      toast.error("Не удалось создать запрос.");
    }
  };

  const [feedOffset, setFeedOffset] = useState(0);
  const [feedItems, setFeedItems] = useState<NotificationItem[]>([]);
  const [feedTotalCount, setFeedTotalCount] = useState(0);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const isNextPageRequestedRef = useRef(false);
  const {
    data: feedData,
    isLoading: isFeedLoading,
    isFetching: isFeedFetching,
    isError: isFeedError,
    refetch: refetchFeed,
  } = useNotificationsQuery({
    params: {
      limit: FEED_PAGE_SIZE,
      offset: feedOffset,
      is_active: true,
    },
    querySettings: {
      keepPreviousData: true,
    },
  });
  const currentPageItems = useMemo(() => feedData?.response ?? [], [feedData?.response]);
  const hasFeedItems = feedItems.length > 0;

  useEffect(() => {
    if (!feedData) return;
    if (typeof feedData.count === "number" && Number.isFinite(feedData.count)) {
      setFeedTotalCount(feedData.count);
    }

    setFeedItems((prev) => {
      if (feedOffset === 0) {
        return currentPageItems;
      }

      const merged = [...prev];
      const indexByGuid = new Map(merged.map((item, index) => [item.guid, index]));

      for (const item of currentPageItems) {
        const existingIndex = indexByGuid.get(item.guid);
        if (existingIndex === undefined) {
          indexByGuid.set(item.guid, merged.length);
          merged.push(item);
        } else {
          merged[existingIndex] = item;
        }
      }

      return merged;
    });
  }, [currentPageItems, feedData, feedOffset]);

  useEffect(() => {
    if (!isFeedFetching) {
      isNextPageRequestedRef.current = false;
    }
  }, [isFeedFetching]);

  const hasMoreFeed =
    feedTotalCount > 0 ? feedItems.length < feedTotalCount : currentPageItems.length === FEED_PAGE_SIZE;
  const isInitialFeedLoading = isFeedLoading && !hasFeedItems;
  const isLoadingMoreFeed = isFeedFetching && hasFeedItems;

  useEffect(() => {
    if (!hasMoreFeed) return;
    if (isFeedFetching) return;
    if (isFeedError) return;

    const sentinel = loadMoreRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (isNextPageRequestedRef.current) return;

        isNextPageRequestedRef.current = true;
        setFeedOffset((prev) => prev + FEED_PAGE_SIZE);
      },
      { rootMargin: "240px 0px 240px 0px", threshold: 0.01 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreFeed, isFeedError, isFeedFetching]);

  return (
    <>
      <PageMeta title="Главная страница" description="Главная страница" />

      <div className="grid gap-4 pb-2 xl:grid-cols-12">
        <aside className="space-y-4 xl:col-span-4 xl:order-2">
          <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                <CalendarDays size={17} />
              </span>
              <h3 className="text-xl font-semibold text-gray-900">Повестка дня</h3>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="grid grid-cols-7 gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2.5">
                {agendaDays.map((day) => (
                  <button
                    type="button"
                    key={day.id}
                    onClick={() => setSelectedAgendaDate(day.dateKey)}
                    className={`rounded-lg px-1 py-2 text-center ${
                      selectedAgendaDate === day.dateKey
                        ? "bg-rose-50 text-rose-500"
                        : "bg-white text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <div className="text-[11px] font-medium uppercase opacity-70">{day.label}</div>
                    <div className="mt-1 text-lg font-semibold">{day.dateLabel}</div>
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <CalendarClock size={14} className="text-gray-500" />
                  {selectedAgendaInfoDate}
                </div>

                {isAgendaLoading ? (
                  <p className="mt-1 text-sm text-gray-500">Загрузка событий...</p>
                ) : isAgendaError ? (
                  <div className="mt-2 rounded-lg border border-error-200 bg-error-50 p-2">
                    <p className="text-xs font-medium text-error-700">Не удалось загрузить праздники</p>
                    <button
                      type="button"
                      onClick={() => {
                        void refetchAgenda();
                      }}
                      className="mt-2 inline-flex h-7 items-center rounded-lg bg-error-600 px-2.5 text-xs font-semibold text-white transition hover:bg-error-700"
                    >
                      Повторить
                    </button>
                  </div>
                ) : selectedAgendaEvents.length === 0 ? (
                  <p className="mt-1 text-sm text-gray-500">Нет событий</p>
                ) : (
                  <div className="mt-1 space-y-1">
                    {selectedAgendaEvents.map((event) => (
                      <p key={`${selectedAgendaDate}-${event}`} className="text-sm text-gray-700">
                        {event}
                      </p>
                    ))}
                  </div>
                )}

                {isAgendaFetching && !isAgendaLoading ? (
                  <p className="mt-2 text-xs text-gray-400">Обновление...</p>
                ) : null}
              </div>
            </div>
          </article>

          <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: withOpacity(activeVacationColor, 0.14) }}
                >
                  <Icon icon={activeVacationIcon} width={18} height={18} color={activeVacationColor} />
                </span>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {activeVacation?.policyTitle || "Отпуск"}
                  </h3>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleVacationPrev}
                  disabled={!canSlideVacation}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft size={14} />
                </button>
                {vacationSummaries.length > 1 ? (
                  <span className="text-sm text-gray-500">{isVacationLoading ? "..." : vacationSlideLabel}</span>
                ) : null}
                <button
                  type="button"
                  onClick={handleVacationNext}
                  disabled={!canSlideVacation}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <div className="space-y-4 px-5 py-4">
              {isVacationError ? (
                <div className="rounded-xl border border-error-200 bg-error-50 p-3">
                  <p className="text-xs font-medium text-error-700">Не удалось загрузить данные по отпуску</p>
                  <button
                    type="button"
                    onClick={() => {
                      void refetchVacation();
                    }}
                    className="mt-2 inline-flex h-8 items-center rounded-lg bg-error-600 px-3 text-xs font-semibold text-white transition hover:bg-error-700"
                  >
                    Повторить
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-3xl font-semibold text-brand-500">
                    {vacationAvailableLabel}{" "}
                    <span className="text-base font-medium text-gray-600">доступные дни</span>
                  </p>
                </>
              )}
              <button
                type="button"
                onClick={openVacationRequestModal}
                className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
              >
                Запросить выходной
              </button>
              {canSlideVacation ? (
                <div className="flex items-center justify-center gap-1">
                  {vacationSummaries.map((item, index) => (
                    <span
                      key={item.policyGuid}
                      className={`h-1.5 rounded-full transition-all ${
                        index === vacationSlideIndex ? "w-4 bg-brand-500" : "w-1.5 bg-gray-300"
                      }`}
                    />
                  ))}
                </div>
              ) : null}
              {isVacationFetching && !isVacationLoading ? (
                <p className="text-xs text-gray-400">Обновление баланса...</p>
              ) : null}
            </div>
          </article>

        </aside>

        <main className="space-y-4 xl:col-span-8 xl:order-1">
          <section
            className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-5 sm:p-6"
            style={
              companyStore.company?.company_cover
                ? {
                    backgroundImage: `linear-gradient(95deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.72) 45%, rgba(255,255,255,0.25) 100%), url(${companyStore.company.company_cover})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
          >
            <div className="absolute -left-20 -top-20 h-44 w-44 rounded-full bg-brand-100/70 blur-2xl" />
            <div className="absolute -bottom-20 right-0 h-44 w-44 rounded-full bg-cyan-100/80 blur-2xl" />

            <div className="relative space-y-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3.5 sm:gap-4">
                  <img
                    src={avatar}
                    alt="user"
                    className="h-12 w-12 rounded-full border-2 border-white object-cover shadow-sm sm:h-14 sm:w-14"
                  />
                  <div className="space-y-1">
                    <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
                      Добрый день, {String(displayName).toUpperCase()}{" "}
                      <Sparkles className="mb-1 inline-flex text-amber-400" size={20} />
                    </h1>
                    <p className="text-sm font-medium text-slate-500">Хорошего и продуктивного дня</p>
                  </div>
                </div>

                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3.5 py-1.5 text-xs font-semibold text-slate-600 backdrop-blur-sm">
                  <CalendarDays size={14} className="text-brand-500" />
                  {todayLabel}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                {profileHighlights.map((item, index) => {
                  const ItemIcon = item.icon;
                  return (
                    <span
                      key={`${item.value}-${index}`}
                      className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/65 px-3.5 py-2 text-sm font-semibold text-slate-800 shadow-theme-xs backdrop-blur-sm sm:text-[15px]"
                    >
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                        <ItemIcon size={13} />
                      </span>
                      <span>{item.value}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          </section>

          <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Лента новостей</h2>
                <p className="text-xs text-gray-500">Корпоративные объявления и события</p>
              </div>
            </div>

            {isInitialFeedLoading ? (
              <div className="flex min-h-[220px] items-center justify-center px-5 py-4">
                <Spinner />
              </div>
            ) : isFeedError && !hasFeedItems ? (
              <div className="px-5 py-4">
                <div className="rounded-xl border border-error-200 bg-error-50 p-3">
                  <p className="text-sm font-medium text-error-700">Не удалось загрузить ленту новостей</p>
                  <button
                    type="button"
                    onClick={() => {
                      void refetchFeed();
                    }}
                    className="mt-2 inline-flex h-8 items-center rounded-lg bg-error-600 px-3 text-xs font-semibold text-white transition hover:bg-error-700"
                  >
                    Повторить
                  </button>
                </div>
              </div>
            ) : feedItems.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-gray-500">Пока нет активных новостей</div>
            ) : (
              <>
                <div className="space-y-4 px-5 py-4">
                  {feedItems.map((item) => (
                    <article
                      key={item.guid}
                      className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-theme-xs"
                    >
                      <div className="relative aspect-[16/8] w-full overflow-hidden bg-gray-100">
                        {item.photo ? (
                          <img src={item.photo} alt={item.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(120deg,#f3f4f6_0%,#eef2ff_100%)] text-gray-400">
                            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/80">
                              <Bell size={26} />
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 p-4">
                        <h3 className="line-clamp-2 text-lg font-semibold leading-snug text-gray-900">{item.title}</h3>

                        <p className="line-clamp-4 text-sm leading-6 text-gray-600">
                          {htmlToPlainText(item.text || "") || "—"}
                        </p>

                        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400">
                          <Calendar size={13} />
                          {formatFeedDate(item.published_at)}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {isFeedError ? (
                  <div className="px-5 pb-4">
                    <div className="rounded-xl border border-error-200 bg-error-50 p-3">
                      <p className="text-xs font-medium text-error-700">Не удалось подгрузить следующие новости</p>
                      <button
                        type="button"
                        onClick={() => {
                          void refetchFeed();
                        }}
                        className="mt-2 inline-flex h-8 items-center rounded-lg bg-error-600 px-3 text-xs font-semibold text-white transition hover:bg-error-700"
                      >
                        Повторить
                      </button>
                    </div>
                  </div>
                ) : null}

                {isLoadingMoreFeed ? (
                  <div className="px-5 pb-4 text-center text-xs font-medium text-gray-400">Загрузка новостей...</div>
                ) : null}

                {hasMoreFeed && !isFeedError ? <div ref={loadMoreRef} className="h-1 w-full" /> : null}
              </>
            )}

            {isFeedFetching && !isFeedLoading ? (
              <div className="border-t border-gray-100 px-5 py-2 text-xs text-gray-400">Обновление ленты...</div>
            ) : null}
          </article>
        </main>
      </div>

      <AbsenceRequestModal
        isOpen={isVacationRequestModalOpen}
        onClose={closeVacationRequestModal}
        policies={requestPolicyOptions}
        policyId={requestPolicyId}
        onPolicyIdChange={setRequestPolicyId}
        dateFrom={requestDateFrom}
        onDateFromChange={handleRequestDateFromChange}
        dateTo={requestDateTo}
        onDateToChange={setRequestDateTo}
        note={requestNote}
        onNoteChange={setRequestNote}
        attachmentInputId="dashboard-absence-attachments"
        attachments={requestAttachments}
        onAttachmentFiles={(event) => void handleRequestAttachmentFiles(event)}
        onRemoveAttachment={removeRequestAttachment}
        isUploadingAttachments={isUploadingRequestAttachments}
        maxAttachments={MAX_ATTACHMENTS}
        breakdown={requestBreakdown}
        availableDays={requestAvailableDays}
        requestedDays={requestRequestedDays}
        forecastDays={requestForecastDays}
        brandColor="var(--color-brand-500)"
        isSubmitting={createAbsenceMutation.isLoading}
        submitDisabled={
          createAbsenceMutation.isLoading ||
          isUploadingRequestAttachments ||
          !requestPolicyId ||
          requestRequestedDays <= 0
        }
        onSubmit={() => void submitVacationRequest()}
        submitIdleLabel="Создать запрос"
        submitLoadingLabel="Отправка..."
      />
    </>
  );
}

export default observer(DashboardPage);
