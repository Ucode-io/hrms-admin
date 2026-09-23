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

const BILLING_BASE_URL = "https://api.admin.u-code.io";
const BILLING_FUNCTION_PATH =
  "/v2/invoke_function/udevs-hrms-billing?project-id=9a462573-ce11-4288-928a-a6ba754b6998";

export type SubscriptionStatus = "unbilled" | "active" | "past_due" | "read_only" | "canceled";
export type BannerKind = "none" | "renewal_soon" | "past_due" | "read_only" | "canceled";

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

export type BillingOverview = {
  subscription: {
    status: SubscriptionStatus;
    current_period_start: string | null;
    current_period_end: string | null;
    next_renewal_date: string | null;
    grace_until: string | null;
  } | null;
  status: BillingStatus;
  plan: {
    id: string;
    code: string;
    title: string;
    price_usd: number;
    included_seats: number;
    overage_price_usd: number;
    included_ai_usd: number;
    ai_enabled: boolean;
  } | null;
  seats_now: number;
  over_seats_now: number;
  projected: {
    renewal_date: string;
    plan_usd: number;
    overage_seat_days_so_far: number;
    overage_usd_so_far: number;
    amount_usd_so_far: number;
    fx_rate: number;
    fx_date: string;
    amount_uzs_estimate: number;
  } | null;
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
