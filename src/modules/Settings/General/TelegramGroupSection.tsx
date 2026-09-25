import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import Button from "../../../components/ui/button/Button";
import MultiSelect from "../../../components/form/MultiSelect";
import { Modal } from "../../../components/ui/modal";
import {
  telegramGroupService,
  type TelegramGroup,
  type TelegramGroupPass,
  type TelegramGroupScope,
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
  scope_mismatch: "settings_general.telegram.poll_reason.scope_mismatch",
  company_taken: "settings_general.telegram.poll_reason.company_taken",
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

// Значение пункта «Вся компания» в мульти-селекте; филиалы — своими guid.
const COMPANY = "company";

const scopeOf = (group: TelegramGroup): string[] => [
  ...(group.company ? [COMPANY] : []),
  ...group.branches.map((branch) => branch.locationsId),
];

const toScope = (values: string[]): TelegramGroupScope =>
  values.includes(COMPANY)
    ? { company: true, locationsIds: [] }
    : { company: false, locationsIds: values };

/**
 * «Вся компания» исключает филиалы (ADR-0012): группа компании и так видит
 * всех, а филиалы рядом с ней только пускали бы в общий чат рассылки,
 * адресованные одному филиалу. Выбрали компанию — филиалы снимаются, выбрали
 * филиал — снимается компания.
 */
const nextScope = (previous: string[], next: string[]): string[] => {
  const added = next.filter((value) => !previous.includes(value));
  if (added.includes(COMPANY)) return [COMPANY];
  if (added.length && next.includes(COMPANY)) return next.filter((value) => value !== COMPANY);
  return next;
};

const sameScope = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value) => b.includes(value));

type Draft = { chatId: string | null; values: string[] };

/**
 * Подключение групп, в которые бот шлёт опоздания и дневной лист посещаемости
 * (ADR-0012): строка — это группа, у неё охват — вся компания или набор
 * филиалов. Два-три филиала в одном чате — одна строка, а не три «Подключена».
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
  const [status, setStatus] = useState<TelegramGroupStatus | null>(null);
  // Правки строк — черновики по chat_id, новая строка — под ключом "".
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [pass, setPass] = useState<TelegramGroupPass | null>(null);
  const [unlinking, setUnlinking] = useState<TelegramGroup | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Одна точка смены состояния, чтобы колбэк нельзя было забыть в одной из
  // веток.
  const applyStatus = (next: TelegramGroupStatus) => {
    setStatus(next);
    onLinkedChange?.(next.linked);
  };

  const reload = async () => applyStatus(await telegramGroupService.status(companiesId));

  useEffect(() => {
    if (!companiesId) return;
    let cancelled = false;

    telegramGroupService
      .status(companiesId)
      .then((next) => !cancelled && applyStatus(next))
      .catch(() => !cancelled && applyStatus({ linked: false, branches: [], groups: [] }));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companiesId]);

  const run = async (action: () => Promise<void>, fallback: MessageKey) => {
    setIsBusy(true);
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t(fallback));
    } finally {
      setIsBusy(false);
    }
  };

  const groupLabel = (group: TelegramGroup) =>
    group.title ||
    (group.company
      ? t("settings_general.telegram.scope_company")
      : group.branches.map((branch) => branch.title).join(", ")) ||
    t("settings_general.telegram.group_untitled");

  /**
   * Пункты охвата для строки. Филиал может быть в нескольких группах
   * (ADR-0013), поэтому его пункт всегда активен. «Вся компания» неактивна с
   * подписью, если группа компании уже другая: молча она не переносится —
   * перенос это тишина в прежней группе.
   */
  const optionsFor = (chatId: string | null) => {
    if (!status) return [];
    const companyGroup = status.groups.find((group) => group.company && group.chatId !== chatId);
    const companyHint = companyGroup
      ? t("settings_general.telegram.taken_by", { name: groupLabel(companyGroup) })
      : undefined;

    return [
      {
        value: COMPANY,
        text: t("settings_general.telegram.scope_company"),
        disabled: Boolean(companyHint),
        hint: companyHint,
      },
      ...status.branches.map((branch) => ({ value: branch.locationsId, text: branch.title || "—" })),
    ];
  };

  const setDraft = (key: string, draft: Draft | null) =>
    setDrafts((current) => {
      const next = { ...current };
      if (draft) next[key] = draft;
      else delete next[key];
      return next;
    });

  /**
   * Код выдан на прежний выбор — гасим его, иначе он привязал бы не то, что
   * сейчас выбрано. С ожиданием ответа: пока отмена не дошла, кнопки
   * заблокированы, иначе она могла бы долететь после нового «Получить код» и
   * погасить уже его. Не погасился — выбор не меняется, и человек это видит.
   */
  const dropPassThen = (apply: () => void) => {
    if (!pass) return apply();
    return run(async () => {
      await telegramGroupService.cancelPass(companiesId);
      setPass(null);
      apply();
    }, "settings_general.telegram.error.cancel_failed");
  };

  const changeNewRow = (values: string[]) => {
    const previous = drafts[""]?.values || [];
    dropPassThen(() => setDraft("", { chatId: null, values: nextScope(previous, values) }));
  };

  const handleCreate = () =>
    run(async () => {
      setPass(await telegramGroupService.createPass(companiesId, toScope(drafts[""]?.values || [])));
    }, "settings_general.telegram.error.pass_failed");

  const removeNewRow = () => dropPassThen(() => setDraft("", null));

  /**
   * Забрать очередь Telegram сейчас, не дожидаясь крона, и перечитать статус.
   *
   * Крон опрашивает раз в пять минут, и без этой кнопки человек после
   * добавления бота видит ровно ничего — что неотличимо от поломки.
   */
  const handleCheck = () =>
    run(async () => {
      const result = await hickvisionService.pollTelegramGroupLinks();
      const next = await telegramGroupService.status(companiesId, pass?.token);
      const before = status?.groups.length ?? 0;
      applyStatus(next);

      // Успех — по ответу сервера, а не опроса: при вебхуке опрос всегда
      // `conflict`, крон мог привязать раньше нажатия, а сам опрос общий на все
      // компании. С кодом — погашен ли он привязкой: по одним группам этого не
      // видно, филиал мог состоять в той же группе и до кода (ADR-0013). Без
      // кода — «групп стало больше».
      if (pass ? next.passUsed : next.groups.length > before) {
        setPass(null);
        setDraft("", null);
        toast.success(t("settings_general.telegram.group_connected"));
      } else {
        toast.error(describePoll(result));
      }
    }, "settings_general.telegram.error.check_failed");

  const handleSave = (group: TelegramGroup) =>
    run(async () => {
      await telegramGroupService.update(companiesId, group.chatId, toScope(drafts[group.chatId].values));
      setDraft(group.chatId, null);
      toast.success(t("settings_general.telegram.scope_saved"));
      // Как и после отключения: сбой перечитывания — не сбой сохранения.
      await reload().catch(() => undefined);
    }, "settings_general.telegram.error.update_failed");

  const handleUnlink = (group: TelegramGroup) =>
    run(async () => {
      await telegramGroupService.unlink(companiesId, group.chatId);
      setUnlinking(null);
      setDraft(group.chatId, null);
      toast.success(t("settings_general.telegram.group_disconnected"));
      // Перечитывание отдельно: его сбой не должен выглядеть сбоем уже
      // состоявшегося отключения.
      await reload().catch(() => undefined);
    }, "settings_general.telegram.error.unlink_failed");

  if (!companiesId) return null;

  const newRow = drafts[""];

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

  // Под названием — только то, что требует внимания: сама строка уже значит
  // «подключена», и зелёная подпись на каждой — шум.
  const stateNote = (group: TelegramGroup) =>
    group.state === "bot_missing" || group.state === "migrated" ? (
      <p className="text-xs font-medium text-warning-600">
        {t(`settings_general.telegram.state.${group.state}`)}
      </p>
    ) : null;

  /**
   * Строка группы в одну линию: название, охват, действия. На узком экране —
   * столбиком. `below` — то, что шире строки: код привязки, пояснение.
   */
  const row = (key: string, title: string, note: ReactNode, select: ReactNode, actions: ReactNode, below?: ReactNode) => (
    <li key={key} className="space-y-3 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
        <div className="min-w-0 md:w-44 md:shrink-0">
          <p className="truncate text-sm font-medium text-gray-900" title={title}>
            {title}
          </p>
          {note}
        </div>
        <div className="min-w-0 flex-1">{select}</div>
        <div className="flex shrink-0 justify-end gap-2">{actions}</div>
      </div>
      {below}
    </li>
  );

  const scopeSelect = (chatId: string | null, values: string[], onChange: (next: string[]) => void) => (
    <MultiSelect
      inline
      label={t("settings_general.telegram.scope_label")}
      placeholder={t("settings_general.telegram.scope_placeholder")}
      options={optionsFor(chatId)}
      value={values}
      disabled={isBusy}
      onChange={onChange}
    />
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
            {status.groups.map((group) => {
              const saved = scopeOf(group);
              const draft = drafts[group.chatId];
              const values = draft?.values ?? saved;
              const isDirty = Boolean(draft) && !sameScope(draft.values, saved);

              return row(
                group.chatId,
                groupLabel(group),
                stateNote(group),
                scopeSelect(group.chatId, values, (next) =>
                  setDraft(group.chatId, { chatId: group.chatId, values: nextScope(values, next) })
                ),
                isDirty ? (
                  <>
                    <Button size="sm" variant="outline" disabled={isBusy} onClick={() => setDraft(group.chatId, null)}>
                      {t("settings_general.telegram.action.cancel")}
                    </Button>
                    <Button size="sm" disabled={isBusy || values.length === 0} onClick={() => handleSave(group)}>
                      {t("settings_general.telegram.action.save")}
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" disabled={isBusy} onClick={() => setUnlinking(group)}>
                    {t("settings_general.telegram.action.disconnect")}
                  </Button>
                ),
                group.state === "migrated" && (
                  <p className="text-xs text-gray-500">{t("settings_general.telegram.state.migrated_hint")}</p>
                )
              );
            })}

            {newRow &&
              row(
                "new",
                t("settings_general.telegram.new_group_title"),
                null,
                scopeSelect(null, newRow.values, changeNewRow),
                <>
                  <Button size="sm" variant="outline" disabled={isBusy} onClick={removeNewRow}>
                    {t("settings_general.telegram.action.cancel")}
                  </Button>
                  {!pass && (
                    <Button size="sm" disabled={isBusy || newRow.values.length === 0} onClick={handleCreate}>
                      {t("settings_general.telegram.action.get_code")}
                    </Button>
                  )}
                </>,
                passPanel
              )}
          </ul>
        )}

        {status !== null && !pass && (
          <div className="flex flex-wrap gap-3">
            {!newRow && (
              <Button
                size="sm"
                disabled={isBusy}
                startIcon={<Plus className="size-4" aria-hidden />}
                onClick={() => setDraft("", { chatId: null, values: [] })}
              >
                {t("settings_general.telegram.action.add")}
              </Button>
            )}
            <Button size="sm" variant="outline" disabled={isBusy} onClick={handleCheck}>
              {t("settings_general.telegram.action.check")}
            </Button>
          </div>
        )}
      </div>

      {unlinking && (
        <Modal
          isOpen
          onClose={() => setUnlinking(null)}
          showCloseButton={false}
          className="mx-4 w-full max-w-[440px] rounded-2xl p-6"
        >
          <h3 className="text-base font-semibold text-gray-900 dark:text-white/90">
            {t("settings_general.telegram.disconnect_title")}
          </h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t("settings_general.telegram.disconnect_text", { name: groupLabel(unlinking) })}
          </p>
          <div className="mt-5 flex gap-3">
            <Button size="sm" variant="outline" className="w-full" disabled={isBusy} onClick={() => setUnlinking(null)}>
              {t("settings_general.telegram.action.cancel")}
            </Button>
            <Button
              size="sm"
              className="w-full bg-error-600 hover:bg-error-700"
              disabled={isBusy}
              onClick={() => handleUnlink(unlinking)}
            >
              {t("settings_general.telegram.action.disconnect")}
            </Button>
          </div>
        </Modal>
      )}
    </section>
  );
}
