// Payme Subscribe API прямо из браузера: номер карты уходит только в Payme,
// в HRMS — лишь разовый токен (требование Payme, developer.help.paycom.uz/
// protokol-subscribe-api). X-Auth здесь — id кассы без ключа, он публичный.

import { translate } from "../../../i18n";
import type { PaymeConfig } from "../../../api/services/billing.service";

type PaymeCard = {
  number: string;
  expire: string;
  token: string;
  recurrent?: boolean;
  verify: boolean;
};

/** Payme присылает message строкой или объектом {ru, uz, en}. */
const localized = (message: unknown): string => {
  if (!message) return "";
  if (typeof message === "string") return message;
  if (typeof message === "object") {
    const m = message as Record<string, string>;
    return m.ru || m.uz || m.en || "";
  }
  return "";
};

const rpc = async <T>(config: PaymeConfig, method: string, params: Record<string, unknown>): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(config.api_url as string, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Auth": config.merchant_id as string },
      body: JSON.stringify({ id: Date.now(), method, params }),
    });
  } catch {
    throw new Error(translate("billing.topup.payme_offline"));
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) throw new Error(translate("billing.topup.payme_down"));
  if (body.error) throw new Error(localized(body.error.message) || translate("billing.topup.payme_rejected"));
  return body.result as T;
};

/**
 * save:false — разовый токен, карта нигде не сохраняется. save:true — «Запомнить
 * карту»: многоразовый токен (если Payme разрешит, recurrent:true); сервер
 * сохранит его только после успешной оплаты.
 */
export const createCard = (config: PaymeConfig, number: string, expire: string, save = false) =>
  rpc<{ card: PaymeCard }>(config, "cards.create", { card: { number, expire }, save }).then((r) => r.card);

export const sendCode = (config: PaymeConfig, token: string) =>
  rpc<{ sent: boolean; phone: string; wait: number }>(config, "cards.get_verify_code", { token });

export const verifyCode = (config: PaymeConfig, token: string, code: string) =>
  rpc<{ card: PaymeCard }>(config, "cards.verify", { token, code }).then((r) => r.card);
