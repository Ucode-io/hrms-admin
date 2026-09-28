// Биллинг — через шлюз udevs-hrms-billing, устроен как budget.service.ts.
// Фронт ничего не считает: суммы, статусы и вид баннера приходят готовыми.
// Спека: docs/adr/0009-billing-read-only-is-enforced-in-the-http-client.md.

import axios from "axios";
import { useQuery } from "react-query";
import { getCompaniesId, injectCompaniesIdIntoInvokeFunctionRequest } from "../httpRequest";
import authStore from "../../store/auth.store";
import { retryWithFreshToken } from "../unauthorizedHandler";
import { BILLING_STATUS_KEY } from "../billingReadOnly";
import { useCurrentUserAccess } from "./role.service";

// Локально против песочницы биллинга (`yarn sandbox` в udevs-hrms-billing):
// VITE_BILLING_BASE_URL=http://localhost:5199 yarn dev. В сборке переменной нет.
const BILLING_BASE_URL = import.meta.env.VITE_BILLING_BASE_URL || "https://api.admin.u-code.io";
const BILLING_FUNCTION_PATH =
  "/v2/invoke_function/udevs-hrms-billing?project-id=9a462573-ce11-4288-928a-a6ba754b6998";

/**
 * Оплата по счёту на клиенте (решение владельца 28.09): пока клиент платит только
 * картой. false прячет «Скачать счёт» в баннере, печать и текст про перевод в
 * блоке долга, таблицу «Счета» и номер счёта в текстах баннера. Счета при этом
 * выставляются как прежде, оператор их видит и печатает; страница печати
 * /billing/invoices/:id/print осталась. true — вернуть всё как было.
 */
export const SHOW_INVOICES_TO_CLIENT = false;

export type SubscriptionStatus = "unbilled" | "active" | "past_due" | "read_only" | "canceled";
export type BannerKind = "none" | "renewal_soon" | "cancel_scheduled" | "past_due" | "read_only" | "canceled";

export type BillingPlanRef = { id: string; code: string; title: string };

export type BillingStatus = {
  status: SubscriptionStatus;
  read_only: boolean;
  plan: BillingPlanRef | null;
  next_renewal_date: string | null;
  grace_until: string | null;
  balance_uzs: number;
  open_invoice: {
    id: string;
    number: string;
    amount_uzs: number;
    amount_usd: number;
    amount_to_pay_uzs: number;
  } | null;
  ai: {
    enabled: boolean;
    limit_usd: number;
    spent_usd: number;
    purchased_usd: number;
    remaining_usd: number;
    used_share: number;
    tokens_used: number;
  } | null;
  read_only_allows: string[];
  banner: {
    kind: BannerKind;
    days_left?: number;
    amount_uzs?: number;
    amount_usd?: number;
    invoice_number?: string;
    /** cancel_scheduled: последний день полного доступа. */
    ends_on?: string;
  };
};

export type InvoiceStatus = "open" | "paid" | "void";

export type BillingInvoice = {
  id: string;
  number: string;
  kind: "renewal" | "upgrade" | "manual";
  status: InvoiceStatus;
  plan_title: string;
  period_start: string;
  period_end: string;
  period_days: number;
  lines: { code: string; label: string; qty: number; unit_usd: number; amount_usd: number }[];
  amount_usd: number;
  fx_rate: number;
  fx_date: string;
  amount_uzs: number;
  amount_to_pay_uzs?: number;
  issued_on: string;
  due_date: string;
  paid_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  snapshot?: {
    requisites?: Record<string, string>;
    tenant?: { id: string; name: string };
  };
};

/** План из каталога. is_active = «видят клиенты»: закрытый план назначает только оператор. */
export type BillingPlan = {
  id: string;
  code: string;
  title: string;
  price_usd: number;
  included_seats: number;
  overage_price_usd: number;
  included_ai_usd: number;
  ai_enabled: boolean;
  is_active: boolean;
};

export type BillingOverview = {
  subscription: {
    status: SubscriptionStatus;
    current_period_start: string | null;
    current_period_end: string | null;
    next_renewal_date: string | null;
    grace_until: string | null;
    cancel_at_period_end?: boolean;
  } | null;
  status: BillingStatus;
  plan: BillingPlan | null;
  /** Переход на план дешевле, запланированный на next_renewal_date. */
  pending_plan: BillingPlan | null;
  seats_now: number;
  over_seats_now: number;
  account: { balance_uzs: number };
  open_invoices: BillingInvoice[];
};

export type BillingTransaction = {
  id: string;
  type: string;
  amount_uzs: number;
  balance_after_uzs: number;
  invoice_id: string | null;
  description: string;
  created_at: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const billingRequest = axios.create({
  baseURL: BILLING_BASE_URL,
  // Функция бывает холодной: первый ответ идёт несколько секунд.
  timeout: 60_000,
  headers: { "Content-Type": "application/json" },
});

// Только Bearer: с API-KEY сервер не знает человека и отвечает Forbidden.
billingRequest.interceptors.request.use((config) => {
  const token = authStore.token ?? localStorage.getItem("auth_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return injectCompaniesIdIntoInvokeFunctionRequest(config);
});

billingRequest.interceptors.response.use(
  (response) => response,
  retryWithFreshToken(billingRequest)
);

/** Ответ invoke_function завёрнут в несколько конвертов; ошибка метода — HTTP 200 с server_error. */
const findGatewayResult = (raw: unknown, method: string, depth = 0): unknown => {
  if (depth > 6 || !isRecord(raw)) return null;
  if (typeof raw.server_error === "string" && raw.server_error) {
    throw new Error(raw.server_error);
  }
  if (raw.method === method && isRecord(raw.result)) return raw.result;
  for (const key of ["data", "result", "response"]) {
    const found = findGatewayResult(raw[key], method, depth + 1);
    if (found) return found;
  }
  return null;
};

const invoke = async <T>(method: string, data: Record<string, unknown> = {}): Promise<T> => {
  const res = await billingRequest.post(BILLING_FUNCTION_PATH, { data: { method, data } });
  const result = findGatewayResult(res.data, method);
  if (!result) throw new Error(`${method}: пустой ответ`);
  return result as T;
};

/**
 * Единственный запрос биллинга при загрузке приложения: баннер и режим
 * «только просмотр». Статус меняется сам (фоновый процесс раз в 15 минут,
 * оператор отмечает оплату у себя) — поэтому перезапрос при возврате на вкладку.
 * Ошибка = статуса нет = работаем как оплачено.
 */
export const useBillingStatus = () => {
  const companiesId = getCompaniesId();
  return useQuery({
    queryKey: [BILLING_STATUS_KEY, companiesId],
    queryFn: () => invoke<BillingStatus>("billing_status"),
    enabled: Boolean(companiesId),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
};

export const useBillingReadOnly = (): boolean => useBillingStatus().data?.read_only === true;

/**
 * Суммы, счета и страницу биллинга видят владельцы модуля settings или
 * глобальной роли. Та же политика, что у сайдбара: без роли — полный доступ.
 */
export const useCanManageBilling = (): boolean => {
  const { data: access } = useCurrentUserAccess();
  const roleRestricts = Boolean(access?.role) && !access?.role?.isGlobal;
  return !roleRestricts || (access?.modules ?? []).includes("settings");
};

export const useBillingOverview = () =>
  useQuery({
    queryKey: ["billing-overview", getCompaniesId()],
    queryFn: () => invoke<BillingOverview>("billing_overview"),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

/** Каталог для смены плана: только открытые планы, от дешёвого к дорогому. */
export const useBillingPlans = (enabled: boolean) =>
  useQuery({
    queryKey: ["billing-plans"],
    queryFn: () => invoke<{ plans: BillingPlan[] }>("billing_plans_list"),
    select: (data) => data.plans,
    enabled,
    staleTime: 5 * 60_000,
  });

/**
 * Что будет при переходе (сервер считает и предпросмотр, и сам переход одной
 * функцией). upgrade — сразу с доплатой с баланса; insufficient — денег не
 * хватает, ничего не изменено; downgrade — со следующего продления;
 * cancel_pending — снят запланированный переход.
 */
export type PlanChangeMode = "upgrade" | "insufficient" | "downgrade" | "cancel_pending" | "noop";

export type PlanChangeResult = {
  preview: boolean;
  changed: boolean;
  mode: PlanChangeMode;
  from_plan: { id: string; title: string; price_usd: number };
  plan: { id: string; title: string; price_usd: number };
  applies_on: string | null;
  amount_usd: number;
  amount_uzs: number;
  shortfall_uzs: number;
  balance_uzs?: number;
  remaining_days?: number;
};

export const previewPlanChange = (planId: string) =>
  invoke<PlanChangeResult>("billing_plan_change", { plan_id: planId, preview: true });

/**
 * confirmAmountUzs — сумма из окна подтверждения: если за это время она
 * изменилась (курс, баланс), сервер откажет, и человек подтвердит заново.
 */
export const changePlan = (planId: string, requestId: string, confirmAmountUzs?: number) =>
  invoke<PlanChangeResult>("billing_plan_change", {
    plan_id: planId,
    request_id: requestId,
    ...(confirmAmountUzs === undefined ? {} : { confirm_amount_uzs: confirmAmountUzs }),
  });

// ───── пополнение картой (Payme) ─────

/** Сохранённая карта компании (одна). Платить и удалять может любой админ биллинга. */
export type SavedCard = {
  id: string;
  /** Маска от Payme: 860006******6311. */
  pan_masked: string;
  /** ММ/ГГ */
  expire: string;
  expired: boolean;
  card_type: string;
  added_by: { id: string; name: string } | null;
  created_at: string;
};

export type PaymeConfig = {
  enabled: boolean;
  merchant_id?: string;
  api_url?: string;
  test?: boolean;
  min_uzs: number;
  max_uzs: number;
  /** Сервер умеет сохранять карты. Нет поля — старая функция: форма без «Запомнить карту». */
  cards_supported?: boolean;
  card?: SavedCard | null;
};

export type Topup = {
  request_id: string;
  /** pending — Payme ещё решает (деньги могли списаться), succeeded — на балансе. */
  state: "pending" | "succeeded" | "failed";
  amount_uzs: number;
  credited_uzs: number;
  card_mask: string | null;
  /** Оплачено сохранённой картой. */
  saved_card?: boolean;
  /** Просили запомнить карту: чем кончилось; null — не просили. */
  card_save?: "pending" | "saved" | "not_recurrent" | "failed" | null;
  order_id: number;
  error: string | null;
};

/** card — карта компании после операции (null — её нет или она перестала действовать). */
export type TopupResult = { topup: Topup; balance_uzs: number; card?: SavedCard | null };

export const PAYME_CONFIG_KEY = "billing-payme-config";

/** id кассы и адрес Payme для формы карты; enabled:false — кнопок оплаты картой нет. */
export const usePaymeConfig = (enabled: boolean) =>
  useQuery({
    queryKey: [PAYME_CONFIG_KEY, getCompaniesId()],
    queryFn: () => invoke<PaymeConfig>("billing_payme_config"),
    enabled,
    staleTime: 10 * 60_000,
  });

/**
 * Чем платим: новой картой — токен от Payme (saveCard: запомнить её, токен тогда
 * из cards.create {save:true}), или сохранённой картой компании по её id.
 */
export type TopupSource = { token: string; saveCard?: boolean } | { cardId: string };

/** request_id один на попытку, при повторе тот же. */
export const topupCard = (requestId: string, amountUzs: number, source: TopupSource) =>
  invoke<TopupResult>("billing_topup_card", {
    request_id: requestId,
    amount_uzs: amountUzs,
    ...("cardId" in source
      ? { card_id: source.cardId }
      : { token: source.token, ...(source.saveCard ? { save_card: true } : {}) }),
  });

/** Удалить карту компании (у нас и в Payme). Повтор — не ошибка. */
export const deleteSavedCard = (cardId: string) =>
  invoke<{ card: SavedCard | null }>("billing_card_delete", { card_id: cardId });

export const topupStatus = (requestId: string) =>
  invoke<TopupResult>("billing_topup_status", { request_id: requestId });

/** После денег: статус (баннер, read_only), обзор, счета, история. */
export const BILLING_QUERY_KEYS = [BILLING_STATUS_KEY, "billing-overview", "billing-invoices", "billing-transactions"];

export const INVOICES_PAGE_SIZE = 20;

export const useBillingInvoices = (offset: number) =>
  useQuery({
    queryKey: ["billing-invoices", getCompaniesId(), offset],
    queryFn: () =>
      invoke<{ invoices: BillingInvoice[]; count: number }>("billing_invoices_list", {
        limit: INVOICES_PAGE_SIZE,
        offset,
      }),
    keepPreviousData: true,
  });

export const useBillingInvoice = (invoiceId: string) =>
  useQuery({
    queryKey: ["billing-invoice", invoiceId],
    queryFn: () =>
      invoke<{ invoice: BillingInvoice; transactions: BillingTransaction[] }>(
        "billing_invoice_get",
        { invoice_id: invoiceId }
      ),
    enabled: Boolean(invoiceId),
  });

export const useBillingTransactions = () =>
  useQuery({
    queryKey: ["billing-transactions", getCompaniesId()],
    queryFn: () =>
      invoke<{ transactions: BillingTransaction[]; balance_uzs: number }>(
        "billing_transactions_list",
        { limit: 50 }
      ),
  });

/** Пункт «Биллинг» в настройках: только когда статус пришёл и компания в биллинге. */
export const useBillingMenuVisible = (): boolean => {
  const status = useBillingStatus().data?.status;
  return Boolean(status) && status !== "unbilled";
};
