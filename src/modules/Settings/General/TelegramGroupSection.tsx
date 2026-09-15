import { useEffect, useState } from "react";
import { toast } from "sonner";
import Button from "../../../components/ui/button/Button";
import {
  telegramGroupService,
  type TelegramGroupPass,
} from "../../../api/services/telegramGroup.service";

/**
 * Подключение группы, в которую бот шлёт опоздания и дневной лист посещаемости.
 *
 * Пропуск показывается двумя способами не для красоты: ссылка добавляет бота в
 * группу и работает, только если его там ещё нет — иначе членство не меняется и
 * Telegram не присылает ничего. Для группы, где бот уже сидит, остаётся код.
 */
export default function TelegramGroupSection({ companiesId }: { companiesId: string }) {
  const [isLinked, setIsLinked] = useState<boolean | null>(null);
  const [pass, setPass] = useState<TelegramGroupPass | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!companiesId) return;
    let cancelled = false;

    telegramGroupService
      .status(companiesId)
      .then((linked) => !cancelled && setIsLinked(linked))
      .catch(() => !cancelled && setIsLinked(false));

    return () => {
      cancelled = true;
    };
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

  const handleUnlink = async () => {
    setIsBusy(true);
    try {
      await telegramGroupService.unlink(companiesId);
      setIsLinked(false);
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
          <Button size="sm" disabled={isBusy} onClick={handleCreate}>
            Подключить Telegram-группу
          </Button>
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
          </div>
        )}
      </div>
    </section>
  );
}
