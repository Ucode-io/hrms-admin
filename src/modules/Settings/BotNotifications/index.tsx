import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PencilLine, Plus, RotateCcw, TriangleAlert } from "lucide-react";
import Select from "react-select";

import PageMeta from "../../../components/common/PageMeta";
import Button from "../../../components/ui/button/Button";
import Checkbox from "../../../components/form/input/Checkbox";
import companyStore from "../../../store/company.store";
import { getCompaniesId } from "../../../api/httpRequest";
import { telegramGroupService } from "../../../api/services/telegramGroup.service";
import TelegramGroupSection from "../General/TelegramGroupSection";
import {
  notificationSettingsService,
  type NotificationEvent,
  type NotificationGroup,
} from "../../../api/services/notificationSettings.service";
import { useTranslation } from "../../../i18n";
import type { MessageKey } from "../../../i18n/messages";
import { BotNotificationsTabs } from "./Broadcasts";
import { getDepartmentSelectStyles } from "../Departments/utils";

/**
 * Каталог приходит с бэкенда по-русски. Разделы переводятся по русскому
 * названию, события — по `event_type`; чего в локалях ещё нет, показываем как
 * прислал бэкенд, чтобы новое событие не превращалось в ключ перевода.
 */
const SECTION_KEYS: Record<string, string> = {
  Турникет: "turnstile",
  "Отметки времени": "time_marks",
  Начисления: "payroll",
  KPI: "kpi",
  "Рабочий график": "schedule",
  Задачи: "tasks",
};

/**
 * Что бот шлёт сотруднику и что — в группу компании.
 *
 * Перечень событий приходит с бэкенда целиком: их состав задаётся кодом, а не
 * этой страницей, потому что за каждым событием стоит выборка, которая умеет
 * найти факт. Здесь только маршрутизация и свой текст сообщения.
 *
 * Свой текст — «Дорогой {{first_name}}, …» вместо стандартного. Какие
 * переменные есть у события, тоже говорит бэкенд; пустой список значит, что
 * своего текста у события не бывает (дневной лист — таблица, а не фраза).
 *
 * Колонка «В группу» есть не у всех: зарплата, бонусы, KPI и корректировки
 * времени в общий чат не уходят никогда — отправленное в группу не
 * отзывается.
 *
 * «В группу» у каждой группы своё (ADR-0012): выпадающий список над таблицей
 * переключает только эту колонку, правки по разным группам копятся здесь и
 * сохраняются одной кнопкой. «Лично» — одно на всю компанию: личный чат
 * принадлежит сотруднику, а не группе его филиала.
 */
export default function BotNotificationsSettingsPage() {
  const { t } = useTranslation();
  // Тот же источник, что у «Интеграций»: authStore заполнен к моменту, когда
  // защищённый маршрут вообще отрисовался, а companyStore — observable, и эта
  // страница не observer. На прямом заходе по ссылке он мог бы ещё не
  // гидратироваться, и companies_id уехал бы пустым.
  const companiesId = getCompaniesId() || companyStore.company?.guid || "";

  const [events, setEvents] = useState<NotificationEvent[] | null>(null);
  const [groups, setGroups] = useState<NotificationGroup[]>([]);
  const [selectedChat, setSelectedChat] = useState("");
  // Названия групп — от Telegram, через статус привязки.
  const [groupTitles, setGroupTitles] = useState<Map<string, string | null>>(new Map());
  const [loadError, setLoadError] = useState(false);
  const [isGroupLinked, setIsGroupLinked] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Сохранённое состояние — чтобы липкая плашка говорила правду о правках.
  const [savedEvents, setSavedEvents] = useState("");
  const [savedGroups, setSavedGroups] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    if (!companiesId) return;
    let cancelled = false;

    setLoadError(false);

    notificationSettingsService
      .get(companiesId)
      .then((settings) => {
        if (cancelled) return;
        const list = settings.events;
        setEvents(list);
        applyGroups(settings.groups);
        setSavedEvents(JSON.stringify(list));
        setSavedGroups(JSON.stringify(settings.groups));
        // Пустой ответ — это не «событий нет», это метод, которого на бэкенде
        // ещё нет: каталог непустой всегда. Сохранять поверх такого нельзя.
        if (!list.length) {
          console.error("notification settings: бэкенд вернул пустой каталог событий");
          setLoadError(true);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        // Подробности — разработчику в консоль. На странице настроек человек
        // не может сделать с «Unsupported method» ничего, кроме как испугаться.
        console.error("notification settings: загрузка не удалась", error);
        // events остаётся null: пустая таблица плюс активная кнопка — это
        // способ стереть настройки компании одним кликом, не увидев их.
        setLoadError(true);
        toast.error(t("settings_misc.bot_notifications.load_error"));
      });

    // Включить «в группу» без привязанной группы можно, но отправка молча
    // превратится в ничто. Поэтому колонка блокируется, пока группы нет.
    telegramGroupService
      .status(companiesId)
      .then((status) => {
        if (cancelled) return;
        setIsGroupLinked(status.linked);
        setGroupTitles(new Map(status.groups.map((group) => [group.chatId, group.title])));
      })
      .catch(() => !cancelled && setIsGroupLinked(false));

    return () => {
      cancelled = true;
    };
  }, [companiesId, reloadToken]);

  // Подзаголовки в том порядке, в котором события пришли с бэкенда: там они
  // разложены осмысленно, пересортировывать здесь нечего.
  const sections = useMemo(() => {
    const grouped = new Map<string, NotificationEvent[]>();
    for (const event of events || []) {
      const list = grouped.get(event.section);
      if (list) list.push(event);
      else grouped.set(event.section, [event]);
    }
    return [...grouped.entries()];
  }, [events]);

  const selectedGroup = groups.find((group) => group.chatId === selectedChat) || null;

  const catalogText = (key: string, fallback: string) => {
    const fullKey = `settings_misc.bot_notifications.${key}`;
    const text = t(fullKey as MessageKey);
    return text === fullKey ? fallback : text;
  };

  const applyGroups = (next: NotificationGroup[]) => {
    setGroups(next);
    setSelectedChat((current) =>
      next.some((group) => group.chatId === current) ? current : next[0]?.chatId || ""
    );
  };

  /**
   * Группу подключили прямо здесь — перечитываем только группы. Всю страницу
   * нельзя: несохранённые правки «Лично» и текстов пропали бы молча. Галочек
   * групп до этого не было — секция подключения видна, только пока групп нет.
   */
  const reloadGroups = () => {
    notificationSettingsService
      .get(companiesId)
      .then((settings) => {
        applyGroups(settings.groups);
        setSavedGroups(JSON.stringify(settings.groups));
      })
      .catch(() => toast.error(t("settings_misc.bot_notifications.load_error")));
    telegramGroupService
      .status(companiesId)
      .then((status) => setGroupTitles(new Map(status.groups.map((group) => [group.chatId, group.title]))))
      .catch(() => undefined);
  };

  const groupLabel = (group: NotificationGroup) =>
    groupTitles.get(group.chatId) ||
    (group.company
      ? t("settings_general.telegram.scope_company")
      : group.branches.join(", ")) ||
    t("settings_general.telegram.group_untitled");

  const isDirty = JSON.stringify(events) !== savedEvents || JSON.stringify(groups) !== savedGroups;

  const groupOptions = groups.map((group) => ({ value: group.chatId, label: groupLabel(group) }));

  const toggle = (eventType: string) => {
    setEvents((current) =>
      (current || []).map((event) =>
        event.event_type === eventType ? { ...event, to_employee: !event.to_employee } : event
      )
    );
  };

  const toggleGroup = (eventType: string) => {
    setGroups((current) =>
      current.map((group) =>
        group.chatId === selectedChat
          ? { ...group, toGroup: { ...group.toGroup, [eventType]: !group.toGroup[eventType] } }
          : group
      )
    );
  };

  const setTemplate = (eventType: string, field: TemplateField, template: string) => {
    setEvents((current) =>
      (current || []).map((event) =>
        event.event_type === eventType ? { ...event, [field]: template } : event
      )
    );
  };

  const handleSave = async () => {
    if (!events) return;
    setIsSaving(true);
    try {
      await notificationSettingsService.save(companiesId, events, groups);
      setSavedEvents(JSON.stringify(events));
      setSavedGroups(JSON.stringify(groups));
      toast.success(t("settings_misc.bot_notifications.save_success"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("settings_misc.bot_notifications.save_error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <PageMeta title={t("settings_misc.bot_notifications.page_title")} description={t("settings_misc.bot_notifications.page_description")} />

      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            {t("settings_misc.bot_notifications.page_title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("settings_misc.bot_notifications.page_subtitle")}
          </p>
        </div>

        <BotNotificationsTabs />

        {/*
          Пока группы нет, колонка «В группу» ничего не значит — поэтому прямо
          здесь стоит та же секция подключения, что и в «Общих». Отправлять
          человека на другую страницу за действием, без которого половина этой
          не работает, незачем.

          Когда группа подключена, секция не показывается: отключение живёт в
          «Общих», а тут это лишний повод промахнуться.
        */}
        {isGroupLinked === false && (
          <TelegramGroupSection
            companiesId={companiesId}
            onLinkedChange={(linked) => {
              setIsGroupLinked(linked);
              if (linked) reloadGroups();
            }}
          />
        )}

        {groups.length > 1 && events !== null && !loadError && (
          <div className="flex flex-wrap items-center gap-3">
            <label
              htmlFor="notification-group"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {t("settings_misc.bot_notifications.group_select")}
            </label>
            <div className="w-full max-w-xs">
              <Select
                inputId="notification-group"
                options={groupOptions}
                value={groupOptions.find((option) => option.value === selectedChat) || null}
                onChange={(option) => option && setSelectedChat(option.value)}
                styles={getDepartmentSelectStyles()}
                menuPortalTarget={document.body}
                menuPosition="fixed"
                isSearchable={false}
              />
            </div>
          </div>
        )}

        {loadError ? (
          <div className="rounded-xl border border-gray-200 p-8 text-center dark:border-gray-800">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {t("settings_misc.bot_notifications.unavailable")}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("settings_misc.bot_notifications.unavailable_hint")}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={() => setReloadToken((value) => value + 1)}
            >
              {t("settings_misc.bot_notifications.retry")}
            </Button>
          </div>
        ) : events === null ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t("settings_misc.bot_notifications.loading")}</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left dark:border-gray-800 dark:bg-white/[0.03]">
                  <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                    {t("settings_misc.bot_notifications.col_event")}
                  </th>
                  <th className="w-40 px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                    {t("settings_misc.bot_notifications.col_to_employee")}
                  </th>
                  <th className="w-48 px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                    {t("settings_misc.bot_notifications.col_to_group")}
                    {selectedGroup && (
                      <span className="block max-w-[12rem] truncate text-xs font-normal text-gray-500 dark:text-gray-400">
                        {groupLabel(selectedGroup)}
                      </span>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sections.map(([section, sectionEvents]) => (
                  <Fragment key={section}>
                    <tr className="bg-gray-50/60 dark:bg-white/[0.02]">
                      <td
                        colSpan={3}
                        className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                      >
                        {catalogText(`section.${SECTION_KEYS[section]}`, section)}
                      </td>
                    </tr>
                    {sectionEvents.map((event) => (
                      <Fragment key={event.event_type}>
                        <tr className="border-t border-gray-100 dark:border-gray-800">
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-gray-800 dark:text-white/90">
                                {catalogText(`event.${event.event_type}.title`, event.title)}
                              </span>
                              {(event.template.trim() ||
                                event.group_template.trim()) && (
                                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                                  {t(
                                    "settings_misc.bot_notifications.text_custom",
                                  )}
                                </span>
                              )}
                            </div>
                            {event.hint && (
                              <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                {catalogText(`event.${event.event_type}.hint`, event.hint)}
                              </div>
                            )}
                            {event.variables.length > 0 && (
                              <button
                                type="button"
                                aria-expanded={editing === event.event_type}
                                onClick={() =>
                                  setEditing(
                                    editing === event.event_type
                                      ? null
                                      : event.event_type,
                                  )
                                }
                                className="mt-1.5 inline-flex cursor-pointer items-center gap-1 rounded text-xs font-medium text-brand-500 transition-colors hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-brand-400 dark:hover:text-brand-300"
                              >
                                <PencilLine className="size-3.5" aria-hidden />
                                {t("settings_misc.bot_notifications.text_edit")}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {event.employee_applicable ? (
                              <Checkbox
                                checked={event.to_employee}
                                onChange={() => toggle(event.event_type)}
                              />
                            ) : (
                              <span className="text-gray-300 dark:text-gray-600">
                                —
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {event.group_applicable ? (
                              <Checkbox
                                checked={Boolean(selectedGroup?.toGroup[event.event_type])}
                                disabled={!selectedGroup}
                                onChange={() => toggleGroup(event.event_type)}
                              />
                            ) : (
                              <span className="text-gray-300 dark:text-gray-600">
                                —
                              </span>
                            )}
                          </td>
                        </tr>
                        {editing === event.event_type && (
                          <tr>
                            <td colSpan={3} className="px-4 pb-4 pt-1">
                              <TemplateEditor
                                event={event}
                                groupOn={groups.some((group) => group.toGroup[event.event_type])}
                                onChange={(field, template) =>
                                  setTemplate(event.event_type, field, template)
                                }
                                onClose={() => setEditing(null)}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/*
          Кнопка живёт только при успешно загруженном непустом каталоге.
          Сохранение шлёт матрицу целиком, а бэкенд перекладывает отличия
          через DELETE + INSERT — значит клик поверх пустого списка стёр бы
          настройки компании, которых человек даже не видел.
        */}
        {!loadError && events !== null && events.length > 0 && (
          <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white/95 p-4 backdrop-blur">
            <div className="text-sm text-gray-500">
              {isDirty
                ? t("settings_general.status.unsaved")
                : t("settings_misc.bot_notifications.all_saved")}
            </div>
            <Button onClick={handleSave} disabled={isSaving} className="min-w-[170px]">
              {isSaving ? t("settings_general.action.saving") : t("settings_general.action.save_changes")}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

const TEMPLATE_MAX_LENGTH = 800;

// Та же регулярка, что у бэкенда (renderTemplate в reports и hickvision):
// предпросмотр обязан видеть переменные ровно так, как их увидит отправка.
const VARIABLE_PATTERN = /\{\{\s*(\w+)\s*\}\}/g;

type TemplateField = "template" | "group_template";

type TemplatePart = { text: string } | { key: string };

function splitTemplate(template: string): TemplatePart[] {
  const result: TemplatePart[] = [];
  let last = 0;
  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) result.push({ text: template.slice(last, index) });
    result.push({ key: match[1] });
    last = index + match[0].length;
  }
  if (last < template.length) result.push({ text: template.slice(last) });
  return result;
}

/**
 * Свой текст события: канал, поле, переменные и предпросмотр.
 *
 * Поле начинается со стандартного текста (default_template), но сохраняется
 * только отличие от него: совпавший текст уходит пустым, и бот шлёт прежнее
 * сообщение — с жирным шрифтом и строками, которых в своём тексте нет. Поле,
 * стёртое до пустоты, тоже значит «стандартный»; черновик держим здесь, чтобы
 * оно не заполнялось обратно на последнем Backspace.
 *
 * Для группы текст отдельный: «Дорогой {{first_name}}» в общем чате читается
 * как обращение ко всем. Вкладка есть, только если событие туда вообще уходит.
 *
 * Предпросмотр нужен ради опечаток: `{{frist_name}}` бэкенд молча заменит
 * пустотой, и заметно это станет только в чате. Здесь такая переменная красная
 * и названа под предпросмотром.
 */
function TemplateEditor({
  event,
  groupOn,
  onChange,
  onClose,
}: {
  event: NotificationEvent;
  /** Уходит ли событие хоть в одну группу: текст для группы общий на все. */
  groupOn: boolean;
  onChange: (field: TemplateField, template: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [field, setField] = useState<TemplateField>("template");
  const [drafts, setDrafts] = useState<Record<TemplateField, string>>(() => ({
    template: event.template || event.default_template,
    group_template: event.group_template || event.default_template,
  }));
  const draft = drafts[field];
  const inputId = `notification-template-${event.event_type}`;
  const isDefault = draft.trim() === event.default_template.trim();
  const channelOff = field === "template" ? !event.to_employee : !groupOn;

  const labels = useMemo(
    () => new Map(event.variables.map((variable) => [variable.key, variable.label || variable.key])),
    [event.variables]
  );

  const parts = useMemo(() => splitTemplate(draft), [draft]);

  const unknown = [
    ...new Set(parts.flatMap((part) => ("key" in part && !labels.has(part.key) ? [part.key] : []))),
  ];

  const update = (value: string) => {
    const text = value.slice(0, TEMPLATE_MAX_LENGTH);
    setDrafts((current) => ({ ...current, [field]: text }));
    onChange(field, text.trim() === event.default_template.trim() ? "" : text);
  };

  // Вставка туда, где стоит курсор, а не в конец: переменную обычно ставят
  // посреди фразы.
  const insertVariable = (key: string) => {
    const token = `{{${key}}}`;
    const area = textareaRef.current;
    const start = area?.selectionStart ?? draft.length;
    const end = area?.selectionEnd ?? draft.length;
    update(draft.slice(0, start) + token + draft.slice(end));
    requestAnimationFrame(() => {
      area?.focus();
      area?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
      {event.group_text_applicable && (
        <div role="tablist" className="mb-4 inline-flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900">
          {(["template", "group_template"] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={field === item}
              onClick={() => setField(item)}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
                field === item
                  ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {t(
                item === "template"
                  ? "settings_misc.bot_notifications.col_to_employee"
                  : "settings_misc.bot_notifications.col_to_group"
              )}
              {event[item] && (
                <span
                  className="size-1.5 rounded-full bg-brand-500"
                  title={t("settings_misc.bot_notifications.text_custom")}
                />
              )}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <label htmlFor={inputId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("settings_misc.bot_notifications.text_label")}
            </label>
            <span
              className={`text-xs tabular-nums ${
                draft.length >= TEMPLATE_MAX_LENGTH
                  ? "text-error-600 dark:text-error-500"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {draft.length} / {TEMPLATE_MAX_LENGTH}
            </span>
          </div>
          {/*
            Голый textarea, а не TextArea: тот не отдаёт ref, а без него
            переменную некуда вставить, кроме конца. 800 — лимит бэкенда:
            подпись к фото в Telegram режется на 1024, остаток под значения.
          */}
          <textarea
            id={inputId}
            ref={textareaRef}
            rows={7}
            autoFocus
            maxLength={TEMPLATE_MAX_LENGTH}
            value={draft}
            placeholder={t("settings_misc.bot_notifications.text_preview_default")}
            onChange={(e) => update(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && onClose()}
            className="w-full resize-y rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-900 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
          />
          {channelOff && (
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              {t("settings_misc.bot_notifications.text_channel_off")}
            </p>
          )}

          <p className="mb-1.5 mt-3 text-xs font-medium text-gray-500 dark:text-gray-400">
            {t("settings_misc.bot_notifications.text_variables")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {event.variables.map((variable) => (
              <button
                key={variable.key}
                type="button"
                title={`{{${variable.key}}}`}
                onClick={() => insertVariable(variable.key)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:border-brand-800 dark:hover:bg-brand-500/15 dark:hover:text-brand-300"
              >
                <Plus className="size-3" aria-hidden />
                {variable.label || variable.key}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("settings_misc.bot_notifications.text_preview")}
          </p>
          <div className="min-h-[8.5rem] rounded-lg bg-gray-100 p-3 dark:bg-gray-900">
            {draft.trim() ? (
              <div className="max-w-md whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm leading-relaxed text-gray-800 shadow-theme-xs dark:bg-gray-800 dark:text-white/90">
                {parts.map((part, index) =>
                  "text" in part ? (
                    <Fragment key={index}>{part.text}</Fragment>
                  ) : labels.has(part.key) ? (
                    <span
                      key={index}
                      className="rounded bg-brand-50 px-1 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                    >
                      {labels.get(part.key)}
                    </span>
                  ) : (
                    <span
                      key={index}
                      className="rounded bg-error-50 px-1 text-error-600 dark:bg-error-500/15 dark:text-error-500"
                    >
                      {`{{${part.key}}}`}
                    </span>
                  )
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t("settings_misc.bot_notifications.text_preview_default")}
              </p>
            )}
          </div>
          {unknown.length > 0 && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-error-600 dark:text-error-500">
              <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
              {t("settings_misc.bot_notifications.text_unknown", {
                names: unknown.map((key) => `{{${key}}}`).join(", "),
              })}
            </p>
          )}
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {t("settings_misc.bot_notifications.text_lines_hint")}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {t("settings_misc.bot_notifications.text_hint")}
        </span>
        <div className="flex gap-2">
          {!isDefault && (
            <Button
              size="sm"
              variant="outline"
              startIcon={<RotateCcw className="size-4" aria-hidden />}
              onClick={() => update(event.default_template)}
            >
              {t("settings_misc.bot_notifications.text_reset")}
            </Button>
          )}
          <Button size="sm" onClick={onClose}>
            {t("settings_misc.bot_notifications.text_done")}
          </Button>
        </div>
      </div>
    </div>
  );
}
