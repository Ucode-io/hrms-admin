import { useEffect, useState } from "react";
import { toast } from "sonner";
import Button from "../../../components/ui/button/Button";
import {
  telegramGroupService,
  type TelegramGroupPass,
} from "../../../api/services/telegramGroup.service";
import hickvisionService, {
  type TelegramGroupPollResult,
} from "../../../api/services/hickvision.service";
import { translate, useTranslation } from "../../../i18n";
import type { MessageKey } from "../../../i18n/messages";

/**
 * Почему опрос не привязался — словами.
 *
 * Бот пишет то же самое в саму группу, но человек в этот момент смотрит в
 * админку, и «ничего не произошло» — худший из возможных ответов.
 */
const POLL_REASON_KEYS: Record<string, MessageKey> = {
  no_updates: "settings_general.telegram.poll_reason.no_updates",
  unknown_employee: "settings_general.telegram.poll_reason.unknown_employee",
  ambiguous_company: "settings_general.telegram.poll_reason.ambiguous_company",
  ambiguous_intent: "settings_general.telegram.poll_reason.ambiguous_intent",
  group_taken: "settings_general.telegram.poll_reason.group_taken",
  unknown_token: "settings_general.telegram.poll_reason.unknown_token",
  conflict: "settings_general.telegram.poll_reason.conflict",
};

const describePoll = (result: TelegramGroupPollResult): string => {
  const refusal = result.results?.find((item) => !item.linked && item.reason);
  const reason = refusal?.reason || result.reason;
  return translate(
    (reason && POLL_REASON_KEYS[reason]) || "settings_general.telegram.poll_reason.default"
  );
};

/**
 * Подключение группы, в которую бот шлёт опоздания и дневной лист посещаемости.
 *
 * Пропуск показывается двумя способами не для красоты: ссылка добавляет бота в
 * группу и работает, только если его там ещё нет — иначе членство не меняется и
 * Telegram не присылает ничего. Для группы, где бот уже сидит, остаётся код.
 */
export default function TelegramGroupSection({
  companiesId,
  onLinkedChange,
}: {
  companiesId: string;
  /**
   * Для страниц, у которых от привязки что-то зависит прямо сейчас: на
   * «Уведомлениях бота» этой секцией разблокируется колонка «В группу», и
   * ждать перезагрузки после «Проверить» человеку не за что.
   */
  onLinkedChange?: (linked: boolean) => void;
}) {
  const { t } = useTranslation();
  const [isLinked, setIsLinked] = useState<boolean | null>(null);
  const [pass, setPass] = useState<TelegramGroupPass | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Одна точка смены состояния, чтобы колбэк нельзя было забыть в одной из
  // четырёх веток.
  const applyLinked = (linked: boolean) => {
    setIsLinked(linked);
    onLinkedChange?.(linked);
  };

  useEffect(() => {
    if (!companiesId) return;
    let cancelled = false;

    telegramGroupService
      .status(companiesId)
      .then((linked) => !cancelled && applyLinked(linked))
      .catch(() => !cancelled && applyLinked(false));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companiesId]);

  const handleCreate = async () => {
    setIsBusy(true);
    try {
      setPass(await telegramGroupService.createPass(companiesId));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("settings_general.telegram.error.pass_failed"));
    } finally {
      setIsBusy(false);
    }
  };

  /**
   * Забрать очередь Telegram сейчас, не дожидаясь крона, и перечитать статус.
   *
   * Крон опрашивает раз в пять минут, и без этой кнопки человек после
   * добавления бота видит ровно ничего — что неотличимо от поломки.
   */
  const handleCheck = async () => {
    setIsBusy(true);
    try {
      const result = await hickvisionService.pollTelegramGroupLinks();
      const linked = await telegramGroupService.status(companiesId);
      applyLinked(linked);

      if (linked) {
        setPass(null);
        toast.success(t("settings_general.telegram.group_connected"));
      } else {
        toast.error(describePoll(result));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("settings_general.telegram.error.check_failed"));
    } finally {
      setIsBusy(false);
    }
  };

  const handleUnlink = async () => {
    setIsBusy(true);
    try {
      await telegramGroupService.unlink(companiesId);
      applyLinked(false);
      setPass(null);
      toast.success(t("settings_general.telegram.group_disconnected"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("settings_general.telegram.error.unlink_failed"));
    } finally {
      setIsBusy(false);
    }
  };

  if (!companiesId) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold text-gray-900">{t("settings_general.telegram.heading")}</h2>
      <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
        <p className="text-sm text-gray-600">
          {t("settings_general.telegram.description")}
        </p>

        {isLinked === null ? (
          <p className="text-sm text-gray-500">{t("settings_general.telegram.loading")}</p>
        ) : isLinked ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-success-600">{t("settings_general.telegram.connected_label")}</span>
            <Button size="sm" variant="outline" disabled={isBusy} onClick={handleUnlink}>
              {t("settings_general.telegram.action.disconnect")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" disabled={isBusy} onClick={handleCreate}>
              {t("settings_general.telegram.action.connect")}
            </Button>
            <Button size="sm" variant="outline" disabled={isBusy} onClick={handleCheck}>
              {t("settings_general.telegram.action.check")}
            </Button>
          </div>
        )}

        {pass && (
          <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div>
              <p className="text-sm font-medium text-gray-800">{t("settings_general.telegram.bot_not_in_group")}</p>
              {pass.link ? (
                <a
                  className="text-sm text-brand-600 underline"
                  href={pass.link}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("settings_general.telegram.select_group_link")}
                </a>
              ) : (
                <p className="text-sm text-error-600">
                  {t("settings_general.telegram.missing_bot_username")}
                </p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-gray-800">{t("settings_general.telegram.bot_already_in_group")}</p>
              <p className="text-sm text-gray-600">
                {t("settings_general.telegram.send_message_prefix")}{" "}
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-gray-900">
                  /bind {pass.token}
                </code>
              </p>
            </div>

            <p className="text-xs text-gray-500">
              {t("settings_general.telegram.pass_expiry_note", { minutes: pass.expiresInMinutes })}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" disabled={isBusy} onClick={handleCheck}>
                {t("settings_general.telegram.action.check")}
              </Button>
              <span className="text-xs text-gray-500">
                {t("settings_general.telegram.check_hint")}
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
