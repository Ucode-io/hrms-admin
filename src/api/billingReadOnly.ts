// Режим «только просмотр» по биллингу — общее для HTTP-клиента, queryClient и
// сервиса биллинга. Отдельным файлом, потому что httpRequest и billing.service
// импортируют друг друга, а этот файл не импортирует никого из них.
// См. docs/adr/0009-billing-read-only-is-enforced-in-the-http-client.md.

import { toast } from "sonner";
import { translate } from "../i18n";

export const BILLING_STATUS_KEY = "billing-status";

/** Тот же префикс, с которым отказывает сервер udevs-hrms-reports. */
export const BILLING_READ_ONLY_CODE = "BILLING_READ_ONLY";

export const isBillingReadOnlyError = (error: unknown): boolean =>
  error instanceof Error && error.message.startsWith(BILLING_READ_ONLY_CODE);

/** Один тост на пачку отказов: форма может сделать несколько запросов подряд. */
export const notifyBillingReadOnly = () =>
  toast.error(translate("billing.read_only_toast"), { id: BILLING_READ_ONLY_CODE });

const WRITE_METHODS = new Set(["post", "put", "patch", "delete"]);

/** Запись в items, а не чтение: POST …/aggregation — это выборка. */
export const isItemsWrite = (method: string | undefined, url: string): boolean =>
  WRITE_METHODS.has((method || "get").toLowerCase()) && !/\/aggregation\/?$/.test(url);
