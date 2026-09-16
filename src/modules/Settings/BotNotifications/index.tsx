import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import PageMeta from "../../../components/common/PageMeta";
import Button from "../../../components/ui/button/Button";
import Checkbox from "../../../components/form/input/Checkbox";
import companyStore from "../../../store/company.store";
import { telegramGroupService } from "../../../api/services/telegramGroup.service";
import {
  notificationSettingsService,
  type NotificationEvent,
} from "../../../api/services/notificationSettings.service";

/**
 * Что бот шлёт сотруднику и что — в группу компании.
 *
 * Перечень событий приходит с бэкенда целиком: их состав задаётся кодом, а не
 * этой страницей, потому что за каждым событием стоит выборка, которая умеет
 * найти факт. Здесь только маршрутизация.
 *
 * Колонка «В группу» есть не у всех: зарплата, бонусы, KPI и корректировки
 * времени в общий чат не уходят никогда — группа одна на всю компанию, а
 * отправленное в неё не отзывается.
 */
export default function BotNotificationsSettingsPage() {
  const companiesId = companyStore.company?.guid || "";

  const [events, setEvents] = useState<NotificationEvent[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [isGroupLinked, setIsGroupLinked] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!companiesId) return;
    let cancelled = false;

    setLoadError(false);

    notificationSettingsService
      .get(companiesId)
      .then((list) => {
        if (cancelled) return;
        setEvents(list);
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
        toast.error("Не удалось загрузить настройки уведомлений");
      });

    // Включить «в группу» без привязанной группы можно, но отправка молча
    // превратится в ничто. Поэтому колонка блокируется, пока группы нет.
    telegramGroupService
      .status(companiesId)
      .then((linked) => !cancelled && setIsGroupLinked(linked))
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

  const toggle = (eventType: string, channel: "to_employee" | "to_group") => {
    setEvents((current) =>
      (current || []).map((event) =>
        event.event_type === eventType ? { ...event, [channel]: !event[channel] } : event
      )
    );
  };

  const handleSave = async () => {
    if (!events) return;
    setIsSaving(true);
    try {
      await notificationSettingsService.save(companiesId, events);
      toast.success("Настройки сохранены");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <PageMeta title="Уведомления бота" description="Что бот шлёт сотрудникам и в группу компании" />

      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            Уведомления бота
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Что приходит сотруднику в личный чат и что — в общую группу компании.
          </p>
        </div>

        {isGroupLinked === false && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            Группа компании не подключена — колонка «В группу» недоступна.{" "}
            <Link to="/settings/general" className="font-medium underline">
              Подключить группу
            </Link>
          </div>
        )}

        {loadError ? (
          <div className="rounded-xl border border-gray-200 p-8 text-center dark:border-gray-800">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Настройки сейчас недоступны
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Попробуйте ещё раз. Если не поможет — напишите в поддержку.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={() => setReloadToken((value) => value + 1)}
            >
              Повторить
            </Button>
          </div>
        ) : events === null ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Загрузка…</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left dark:border-gray-800 dark:bg-white/[0.03]">
                  <th className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                    Событие
                  </th>
                  <th className="w-40 px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                    Сотруднику
                  </th>
                  <th className="w-40 px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                    В группу
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
                        {section}
                      </td>
                    </tr>
                    {sectionEvents.map((event) => (
                      <tr
                        key={event.event_type}
                        className="border-t border-gray-100 dark:border-gray-800"
                      >
                        <td className="px-4 py-3">
                          <div className="text-gray-800 dark:text-white/90">{event.title}</div>
                          {event.hint && (
                            <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                              {event.hint}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {event.employee_applicable ? (
                            <Checkbox
                              checked={event.to_employee}
                              onChange={() => toggle(event.event_type, "to_employee")}
                            />
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {event.group_applicable ? (
                            <Checkbox
                              checked={event.to_group}
                              disabled={isGroupLinked === false}
                              onChange={() => toggle(event.event_type, "to_group")}
                            />
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600">—</span>
                          )}
                        </td>
                      </tr>
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
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Сохранение…" : "Сохранить"}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
