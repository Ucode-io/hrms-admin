import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "react-query";
import { CheckCircle2, CreditCard, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { Modal } from "../../../components/ui/modal";
import { useTranslation } from "../../../i18n";
import {
  BILLING_QUERY_KEYS,
  PAYME_CONFIG_KEY,
  topupCard,
  topupStatus,
  type PaymeConfig,
  type SavedCard,
  type Topup,
  type TopupResult,
  type TopupSource,
} from "../../../api/services/billing.service";
import { createCard, sendCode, verifyCode } from "./paymeClient";
import { formatUzs, shortCard } from "./format";

// Пополнение баланса картой через Payme. Карту токенизирует браузер прямо в
// Payme; в HRMS уходят только сумма и токен. Форма по требованиям Payme: у
// полей нет name, у формы нет action, есть логотип, оферта и «Powered by Payme».
//
// Сохранённая карта компании (решение 28.09): если она есть, окно открывается
// сразу с ней — сумма и одна кнопка «Оплатить X с •••• 6311», без кода из SMS.
// «Запомнить карту» у новой карты включено по умолчанию; сервер сохранит её
// только после успешной оплаты. Старая функция без cards_supported — форма
// как раньше, разовым токеном.

type Step = "form" | "code" | "processing" | "result";
type Mode = "saved" | "new";

const POLL_EVERY_MS = 3000;
const POLL_FOR_MS = 2 * 60 * 1000;
const OFFER_URL = "https://cdn.payme.uz/terms/main.html";

const digits = (value: string) => value.replace(/\D+/g, "");
const formatPan = (value: string) => digits(value).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
const formatExpiry = (value: string) => {
  const d = digits(value).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

const INPUT =
  "h-11 w-full rounded-lg border border-gray-300 px-3 text-sm tabular-nums text-gray-900 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10";
const PRIMARY =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";
const LINK =
  "text-sm font-medium text-brand-600 underline-offset-2 hover:underline disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500";

const PaymeMark: React.FC = () => (
  <span className="inline-flex items-center rounded-md bg-[#00CCCC] px-2 py-0.5 text-xs font-bold tracking-wide text-white">
    payme
  </span>
);

const usable = (card: SavedCard | null | undefined): card is SavedCard => Boolean(card && !card.expired);

const TopUpModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  config: PaymeConfig;
  /** Подставляется в поле суммы: обычно «осталось внести» или нехватка для смены плана. */
  defaultAmount: number;
  canceled?: boolean;
  /** Сразу форма новой карты — «Сменить» в «Способе оплаты». */
  preferNewCard?: boolean;
  /** Деньги на балансе: окно закрывает родитель (например, возвращает в смену плана). */
  onSucceeded?: (topup: Topup) => void;
}> = ({ isOpen, onClose, config, defaultAmount, canceled, preferNewCard, onSucceeded }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const cardsSupported = config.cards_supported === true;
  const [step, setStep] = useState<Step>("form");
  const [mode, setMode] = useState<Mode>("new");
  // Карта компании на время окна: ответ оплаты может её заменить или убрать.
  const [card, setCard] = useState<SavedCard | null>(null);
  const [remember, setRemember] = useState(true);
  const [cardGone, setCardGone] = useState(false);
  const [amount, setAmount] = useState(String(defaultAmount || ""));
  const [pan, setPan] = useState("");
  const [expiry, setExpiry] = useState("");
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topup, setTopup] = useState<Topup | null>(null);
  const tokenRef = useRef<string | null>(null);
  const saveRef = useRef(false);
  // Один request_id на попытку: повтор после сбоя сети не спишет второй раз.
  const requestIdRef = useRef<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const stopPolling = () => {
    if (pollRef.current) window.clearTimeout(pollRef.current);
    pollRef.current = null;
  };

  useEffect(() => {
    if (!isOpen) return;
    const saved = cardsSupported ? config.card ?? null : null;
    setCard(saved);
    setMode(usable(saved) && !preferNewCard ? "saved" : "new");
    setRemember(true);
    setCardGone(false);
    setStep("form");
    setAmount(String(defaultAmount || ""));
    setPan("");
    setExpiry("");
    setCode("");
    setError(null);
    setTopup(null);
    tokenRef.current = null;
    requestIdRef.current = null;
    // Карту берём в момент открытия; config.card меняется после оплаты — окно не сбрасываем.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, defaultAmount, preferNewCard]);

  useEffect(() => () => stopPolling(), []);

  const amountValue = Number(digits(amount));

  const finish = (result: TopupResult, paidWithSaved: boolean) => {
    setTopup(result.topup);
    if (result.card !== undefined) setCard(result.card ?? null);
    if (result.topup.state === "pending") {
      setStep("processing");
      return;
    }
    // Карта компании могла появиться, смениться или исчезнуть.
    void queryClient.invalidateQueries(PAYME_CONFIG_KEY);
    if (result.topup.state === "succeeded") {
      for (const key of BILLING_QUERY_KEYS) void queryClient.invalidateQueries(key);
      if (onSucceeded) {
        onSucceeded(result.topup);
        return;
      }
    }
    if (result.topup.state === "failed" && paidWithSaved && result.card === null) setCardGone(true);
    setStep("result");
  };

  const poll = (startedAt: number, paidWithSaved: boolean) => {
    pollRef.current = window.setTimeout(async () => {
      const requestId = requestIdRef.current;
      if (!requestId) return;
      try {
        const result = await topupStatus(requestId);
        finish(result, paidWithSaved);
        if (result.topup.state === "pending" && Date.now() - startedAt < POLL_FOR_MS) poll(startedAt, paidWithSaved);
        else if (result.topup.state === "pending") setStep("result");
      } catch {
        if (Date.now() - startedAt < POLL_FOR_MS) poll(startedAt, paidWithSaved);
        else setStep("result");
      }
    }, POLL_EVERY_MS);
  };

  const pay = async (source: TopupSource) => {
    const paidWithSaved = "cardId" in source;
    requestIdRef.current = requestIdRef.current || crypto.randomUUID();
    setStep("processing");
    setError(null);
    try {
      const result = await topupCard(requestIdRef.current, amountValue, source);
      finish(result, paidWithSaved);
      if (result.topup.state === "pending") poll(Date.now(), paidWithSaved);
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      // Ответ сервера с текстом — запрос дошёл и отклонён: деньги не брали.
      if (message && !/Network Error|timeout/i.test(message)) {
        setError(message);
        setStep("form");
        requestIdRef.current = null;
        // Карту удалили в другой вкладке или у неё истёк срок — на форму новой.
        if (paidWithSaved) void queryClient.invalidateQueries(PAYME_CONFIG_KEY);
        return;
      }
      // Ответа нет — судьба платежа неизвестна: спрашиваем по тому же request_id.
      poll(Date.now(), paidWithSaved);
    }
  };

  const amountOk = () => {
    if (amountValue >= config.min_uzs && amountValue <= config.max_uzs) return true;
    setError(t("billing.topup.err_amount", { min: formatUzs(config.min_uzs), max: formatUzs(config.max_uzs) }));
    return false;
  };

  const submitSaved = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!card || !amountOk()) return;
    await pay({ cardId: card.id });
  };

  const submitCard = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!amountOk()) return;
    const number = digits(pan);
    const exp = digits(expiry);
    if (number.length !== 16) return setError(t("billing.topup.err_pan"));
    if (exp.length !== 4) return setError(t("billing.topup.err_expiry"));
    // Тип токена выбирается здесь: save:true даёт многоразовый.
    saveRef.current = cardsSupported && remember;
    setBusy(true);
    try {
      const created = await createCard(config, number, exp, saveRef.current);
      setPan(""); // номер больше не нужен — не держим его в памяти страницы
      tokenRef.current = created.token;
      if (created.verify) {
        await pay({ token: created.token, saveCard: saveRef.current });
        return;
      }
      const sent = await sendCode(config, created.token);
      setPhone(sent.phone);
      setStep("code");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("billing.topup.err_card"));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tokenRef.current) return;
    setError(null);
    setBusy(true);
    try {
      await verifyCode(config, tokenRef.current, digits(code));
      await pay({ token: tokenRef.current, saveCard: saveRef.current });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("billing.topup.err_code"));
    } finally {
      setBusy(false);
    }
  };

  const retry = () => {
    stopPolling();
    requestIdRef.current = null;
    tokenRef.current = null;
    setTopup(null);
    setError(null);
    // «Попробовать другой картой» — на форму новой карты.
    setMode("new");
    setStep("form");
  };

  const close = () => {
    stopPolling();
    onClose();
  };

  const cardLabel = (value: SavedCard) =>
    t("billing.topup.saved_card", { type: value.card_type, card: shortCard(value.pan_masked), expire: value.expire });

  const amountField = (
    <>
      <label className="block">
        <span className="mb-1 block text-sm text-gray-600">{t("billing.topup.amount")}</span>
        <input className={INPUT} inputMode="numeric" value={amount} onChange={(e) => setAmount(digits(e.target.value))} />
      </label>
      {canceled && <p className="text-xs text-warning-700">{t("billing.topup.canceled_hint")}</p>}
    </>
  );

  const footer = (privacyKey: "billing.topup.privacy" | "billing.topup.saved_privacy") => (
    <>
      <div className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-gray-400" aria-hidden />
        <span>
          {t(privacyKey)}{" "}
          <a href={OFFER_URL} target="_blank" rel="noreferrer" className="underline">
            {t("billing.topup.offer")}
          </a>
          .
        </span>
      </div>
      <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
        Powered by <PaymeMark />
      </div>
    </>
  );

  const cardSaveNote = (value: Topup) => {
    if (value.card_save === "saved") return t("billing.topup.card_saved", { card: shortCard(value.card_mask) });
    if (value.card_save === "not_recurrent") return t("billing.topup.card_not_recurrent");
    if (value.card_save === "failed") return t("billing.topup.card_save_failed");
    return null;
  };

  return (
    <Modal isOpen={isOpen} onClose={close} className="max-w-md p-6">
      <div className="mb-4 flex items-center gap-2 pr-8">
        <h3 className="text-lg font-semibold text-gray-900">{t("billing.topup.title")}</h3>
        {config.test && (
          <span className="rounded bg-warning-100 px-1.5 py-0.5 text-[10px] font-semibold text-warning-700">
            {t("billing.topup.test")}
          </span>
        )}
      </div>

      {step === "form" && mode === "saved" && usable(card) && (
        <form onSubmit={submitSaved} autoComplete="off" className="space-y-3">
          {amountField}
          <div className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5">
            <CreditCard size={18} className="shrink-0 text-gray-400" aria-hidden />
            <span className="flex-1 text-sm tabular-nums text-gray-900">{cardLabel(card)}</span>
            <button type="button" className={LINK} onClick={() => setMode("new")}>
              {t("billing.topup.other_card")}
            </button>
          </div>
          {error && <p className="text-sm text-error-600">{error}</p>}
          <button type="submit" className={`${PRIMARY} w-full`}>
            {t("billing.topup.pay_saved", {
              amount: amountValue > 0 ? formatUzs(amountValue) : "",
              card: shortCard(card.pan_masked),
            })}
          </button>
          {footer("billing.topup.saved_privacy")}
        </form>
      )}

      {step === "form" && (mode === "new" || !usable(card)) && (
        // Без action и без name у полей: браузер не должен сам отправить карту.
        <form onSubmit={submitCard} autoComplete="off" className="space-y-3">
          {amountField}
          {card?.expired && (
            <p className="text-sm text-warning-700">{t("billing.topup.saved_expired", { card: shortCard(card.pan_masked) })}</p>
          )}
          <label className="block">
            <span className="mb-1 block text-sm text-gray-600">{t("billing.topup.card_number")}</span>
            <input
              className={INPUT}
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="8600 0000 0000 0000"
              value={pan}
              onChange={(e) => setPan(formatPan(e.target.value))}
            />
          </label>
          <label className="block w-32">
            <span className="mb-1 block text-sm text-gray-600">{t("billing.topup.expiry")}</span>
            <input
              className={INPUT}
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder={t("billing.topup.expiry_placeholder")}
              value={expiry}
              onChange={(e) => setExpiry(formatExpiry(e.target.value))}
            />
          </label>
          {cardsSupported && (
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 accent-brand-500"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span className="text-sm text-gray-700">
                {t("billing.topup.remember")}
                <span className="mt-0.5 block text-xs text-gray-500">
                  {t("billing.topup.remember_hint")}
                  {remember && card ? ` ${t("billing.topup.remember_replace", { card: shortCard(card.pan_masked) })}` : ""}
                </span>
              </span>
            </label>
          )}
          {error && <p className="text-sm text-error-600">{error}</p>}
          <button type="submit" className={`${PRIMARY} w-full`} disabled={busy}>
            {busy && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden />}
            {t("billing.topup.pay", { amount: amountValue > 0 ? formatUzs(amountValue) : "" })}
          </button>
          {usable(card) && (
            <p className="text-center">
              <button type="button" className={LINK} onClick={() => { setError(null); setMode("saved"); }}>
                {t("billing.topup.use_saved", { card: shortCard(card.pan_masked) })}
              </button>
            </p>
          )}
          {footer("billing.topup.privacy")}
        </form>
      )}

      {step === "code" && (
        <form onSubmit={submitCode} autoComplete="off" className="space-y-3">
          <p className="text-sm text-gray-600">{t("billing.topup.code_sent", { phone })}</p>
          <input
            className={INPUT}
            inputMode="numeric"
            placeholder={t("billing.topup.code_placeholder")}
            value={code}
            onChange={(e) => setCode(digits(e.target.value).slice(0, 6))}
          />
          {error && <p className="text-sm text-error-600">{error}</p>}
          <button type="submit" className={`${PRIMARY} w-full`} disabled={busy || digits(code).length < 4}>
            {busy && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden />}
            {t("billing.topup.confirm")}
          </button>
          <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
            Powered by <PaymeMark />
          </div>
        </form>
      )}

      {step === "processing" && (
        <div className="flex flex-col items-center gap-3 py-6 text-center" role="status">
          <Loader2 size={32} className="animate-spin text-brand-500 motion-reduce:animate-none" aria-hidden />
          <p className="text-sm text-gray-700">{t("billing.topup.processing")}</p>
          <p className="text-xs text-gray-400">{t("billing.topup.processing_hint")}</p>
        </div>
      )}

      {step === "result" && topup && (
        <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
          {topup.state === "succeeded" ? (
            <>
              <CheckCircle2 size={36} className="text-success-600" aria-hidden />
              <p className="text-base font-medium text-gray-900">
                {t("billing.topup.succeeded", { amount: formatUzs(topup.credited_uzs) })}
              </p>
              {topup.card_mask && (
                <p className="text-xs text-gray-400">
                  {t("billing.topup.card_order", { card: topup.card_mask, order: topup.order_id })}
                </p>
              )}
              {cardSaveNote(topup) && <p className="text-sm text-gray-600">{cardSaveNote(topup)}</p>}
              <button type="button" className={PRIMARY} onClick={close}>
                {t("billing.topup.done")}
              </button>
            </>
          ) : topup.state === "failed" ? (
            <>
              <XCircle size={36} className="text-error-500" aria-hidden />
              <p className="text-base font-medium text-gray-900">{t("billing.topup.failed")}</p>
              {topup.error && <p className="text-sm text-gray-500">{topup.error}</p>}
              {cardGone && <p className="text-sm text-gray-600">{t("billing.topup.card_removed")}</p>}
              <button type="button" className={PRIMARY} onClick={retry}>
                {t("billing.topup.retry")}
              </button>
            </>
          ) : (
            <>
              <Loader2 size={32} className="text-warning-500" aria-hidden />
              <p className="text-base font-medium text-gray-900">{t("billing.topup.pending")}</p>
              <p className="text-sm text-gray-500">{t("billing.topup.pending_hint")}</p>
              <button type="button" className={PRIMARY} onClick={close}>
                {t("billing.topup.close")}
              </button>
            </>
          )}
        </div>
      )}
    </Modal>
  );
};

export default TopUpModal;
