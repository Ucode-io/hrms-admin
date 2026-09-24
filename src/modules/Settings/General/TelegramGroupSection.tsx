import { useEffect, useState } from "react";
import { toast } from "sonner";
import Button from "../../../components/ui/button/Button";
import {
  telegramGroupService,
  type TelegramGroupPass,
  type TelegramGroupStatus,
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
  code_required: "settings_general.telegram.poll_reason.code_required",
};

// `conflict` намеренно не расшифровывается: в проде у бота вебхук, опрос
// отвечает им всегда, и «очередь читает кто-то ещё» выглядело бы поломкой
// там, где её нет. Правду говорит сам бот — в группе.
const describePoll = (result: TelegramGroupPollResult): string => {
  const refusal = result.results?.find((item) => !item.linked && item.reason);
  const reason = refusal?.reason || result.reason;
  return translate(
    (reason && POLL_REASON_KEYS[reason]) || "settings_general.telegram.poll_reason.default"
  );
};

/**
 * Подключение групп, в которые бот шлёт опоздания и дневной лист посещаемости:
 * одна строка на всю компанию и по строке на филиал (ADR-0010).
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
   * ждать перезагрузки после «Проверить» человеку не за что. true — есть хоть
   * одна группа: галочка «В группу» одна на все группы компании.
   */
  onLinkedChange?: (linked: boolean) => void;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<TelegramGroupStatus | null>(null);
  // Пропуск выдаётся на один охват: null — вся компания, иначе филиал.
  const [pass, setPass] = useState<(TelegramGroupPass & { locationsId: string | null }) | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Одна точка смены состояния, чтобы колбэк нельзя было забыть в одной из
  // веток.
  const applyStatus = (next: TelegramGroupStatus) => {
    setStatus(next);
    onLinkedChange?.(next.linked);
  };

  useEffect(() => {
    if (!companiesId) return;
    let cancelled = false;

    telegramGroupService
      .status(companiesId)
      .then((next) => !cancelled && applyStatus(next))
      .catch(() => !cancelled && applyStatus({ linked: false, companyLinked: false, branches: [] }));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companiesId]);

  const countLinked = (value: TelegramGroupStatus | null) =>
    value ? Number(value.companyLinked) + value.branches.filter((branch) => branch.linked).length : 0;

  const isScopeLinked = (next: TelegramGroupStatus, locationsId: string | null) =>
    locationsId === null
      ? next.companyLinked
      : next.branches.some((branch) => branch.locationsId === locationsId && branch.linked);

  const handleCreate = async (locationsId: string | null) => {
    setIsBusy(true);
    try {
      setPass({ ...(await telegramGroupService.createPass(companiesId, locationsId)), locationsId });
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
      const next = await telegramGroupService.status(companiesId);
      applyStatus(next);

      // Успех — по статусу этой компании, а не по ответу опроса: при вебхуке
      // опрос всегда `conflict`, крон мог привязать раньше нажатия, а сам
      // опрос общий на все компании. Без кода — «групп стало больше».
      if (pass ? isScopeLinked(next, pass.locationsId) : countLinked(next) > countLinked(status)) {
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

  const handleUnlink = async (locationsId: string | null) => {
    setIsBusy(true);
    try {
      await telegramGroupService.unlink(companiesId, locationsId);
      // Строку гасим сами, без перечитывания: иначе сбой одного лишь чтения
      // выглядел бы как сбой уже состоявшегося отключения.
      if (status) {
        const companyLinked = locationsId === null ? false : status.companyLinked;
        const branches = status.branches.map((branch) =>
          branch.locationsId === locationsId ? { ...branch, linked: false } : branch
        );
        applyStatus({ companyLinked, branches, linked: companyLinked || branches.some((branch) => branch.linked) });
      }
      // Незавершённый код другой строки остаётся: его ещё могут вводить в группу.
      if (pass?.locationsId === locationsId) setPass(null);
      toast.success(t("settings_general.telegram.group_disconnected"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("settings_general.telegram.error.unlink_failed"));
    } finally {
      setIsBusy(false);
    }
  };

  if (!companiesId) return null;

  const scopes = status
    ? [
        { locationsId: null, title: t("settings_general.telegram.scope_company"), linked: status.companyLinked },
        ...status.branches,
      ]
    : [];

  const passPanel = pass && (
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
  );

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold text-gray-900">{t("settings_general.telegram.heading")}</h2>
      <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
        <p className="text-sm text-gray-600">
          {t("settings_general.telegram.description")}
        </p>

        {status === null ? (
          <p className="text-sm text-gray-500">{t("settings_general.telegram.loading")}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {scopes.map((scope) => (
              <li key={scope.locationsId ?? "company"} className="space-y-3 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1 text-sm font-medium text-gray-900">{scope.title}</span>
                  {scope.linked ? (
                    <>
                      <span className="text-sm font-medium text-success-600">
                        {t("settings_general.telegram.connected_label")}
                      </span>
                      <Button size="sm" variant="outline" disabled={isBusy} onClick={() => handleUnlink(scope.locationsId)}>
                        {t("settings_general.telegram.action.disconnect")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-gray-500">
                        {t("settings_general.telegram.not_connected_label")}
                      </span>
                      <Button size="sm" disabled={isBusy} onClick={() => handleCreate(scope.locationsId)}>
                        {t("settings_general.telegram.action.connect")}
                      </Button>
                    </>
                  )}
                </div>
                {pass?.locationsId === scope.locationsId && passPanel}
              </li>
            ))}
          </ul>
        )}

        {status !== null && !pass && (
          <Button size="sm" variant="outline" disabled={isBusy} onClick={handleCheck}>
            {t("settings_general.telegram.action.check")}
          </Button>
        )}
      </div>
    </section>
  );
}
