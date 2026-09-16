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

/**
 * Почему опрос не привязался — словами.
 *
 * Бот пишет то же самое в саму группу, но человек в этот момент смотрит в
 * админку, и «ничего не произошло» — худший из возможных ответов.
 */
const POLL_REASONS: Record<string, string> = {
  no_updates:
    "Telegram ничего не прислал. Добавьте бота в группу и нажмите «Проверить» ещё раз.",
  unknown_employee:
    "Ваш Telegram не привязан к HRMS. Откройте мини-приложение, затем добавьте бота заново.",
  ambiguous_company:
    "Не удалось определить компанию: ваш Telegram привязан к нескольким. Используйте код.",
  ambiguous_intent:
    "Открыто несколько подключений к разным компаниям. Дождитесь, пока лишние истекут, и повторите.",
  group_taken: "Эта группа уже привязана к другой компании.",
  unknown_token: "Код не подошёл: он уже использован или истёк. Получите новый.",
  conflict:
    "Очередь Telegram читает кто-то ещё: у бота выставлен webhook или запущена вторая копия сервиса.",
};

const describePoll = (result: TelegramGroupPollResult): string => {
  const refusal = result.results?.find((item) => !item.linked && item.reason);
  const reason = refusal?.reason || result.reason;
  return (
    (reason && POLL_REASONS[reason]) ||
    "Привязка не подтвердилась. Проверьте, что бот добавлен в группу."
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
      toast.error(error instanceof Error ? error.message : "Не удалось получить код");
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
        toast.success("Группа подключена.");
      } else {
        toast.error(describePoll(result));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось проверить");
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
      toast.success("Группа отключена.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось отключить группу");
    } finally {
      setIsBusy(false);
    }
  };

  if (!companiesId) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold text-gray-900">Telegram-группа</h2>
      <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
        <p className="text-sm text-gray-600">
          В эту группу бот присылает опоздания и ежедневный лист посещаемости.
          Одна группа принадлежит одной компании.
        </p>

        {isLinked === null ? (
          <p className="text-sm text-gray-500">Загрузка...</p>
        ) : isLinked ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-success-600">Группа подключена</span>
            <Button size="sm" variant="outline" disabled={isBusy} onClick={handleUnlink}>
              Отключить группу
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" disabled={isBusy} onClick={handleCreate}>
              Подключить Telegram-группу
            </Button>
            <Button size="sm" variant="outline" disabled={isBusy} onClick={handleCheck}>
              Проверить
            </Button>
          </div>
        )}

        {pass && (
          <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div>
              <p className="text-sm font-medium text-gray-800">Бота в группе ещё нет</p>
              {pass.link ? (
                <a
                  className="text-sm text-brand-600 underline"
                  href={pass.link}
                  target="_blank"
                  rel="noreferrer"
                >
                  Выбрать группу в Telegram
                </a>
              ) : (
                <p className="text-sm text-error-600">
                  Не задан TELEGRAM_BOT_USERNAME — ссылку собрать нечем, используйте код.
                </p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-gray-800">Бот уже в группе</p>
              <p className="text-sm text-gray-600">
                Отправьте в неё сообщение:{" "}
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-gray-900">
                  /bind {pass.token}
                </code>
              </p>
            </div>

            <p className="text-xs text-gray-500">
              Код одноразовый и действует {pass.expiresInMinutes} минут. Не пересылайте его
              посторонним: он привязывает группу именно к этой компании.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" disabled={isBusy} onClick={handleCheck}>
                Проверить
              </Button>
              <span className="text-xs text-gray-500">
                Бот узнаёт о добавлении не мгновенно — нажмите после того, как добавите его
                в группу.
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
