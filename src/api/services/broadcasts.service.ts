// Рассылки бота (ADR-0011): HR пишет сотрудникам и в группы Telegram.
//
// Всё считает reports: конвертер текста, охват, превью. Здесь только вызовы
// и приведение ответа к типам. companies_id подставляет интерцептор.

import { invokeTasksMethod } from "./taskDirectories.service";

export type BroadcastStatus = "draft" | "sent" | "recalled";
export type AttachmentKind = "photo" | "document";

/** Статусы доставки, которые показываются счётчиками. `queued` — pending + sending. */
export const DELIVERY_STATUSES = ["sent", "queued", "blocked", "no_recipient", "failed", "recalled"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

// Отозванное до отправки (cancelled) показывается вместе с удалённым из чата.
const STATUS_QUERY: Record<DeliveryStatus, string[]> = {
  sent: ["sent"],
  queued: ["queued"],
  blocked: ["blocked"],
  no_recipient: ["no_recipient"],
  failed: ["failed"],
  recalled: ["recalled", "cancelled"],
};

export type Option = { value: string; label: string };

export type BroadcastForm = {
  audience: "company" | "branches";
  locations: Option[];
  include_no_branch: boolean;
  to_employees: boolean;
  to_groups: boolean;
  /** Группы поимённо — chat_id (ADR-0012), а не выводятся из аудитории. */
  group_chat_ids: string[];
  /** HTML редактора; сервер сам превращает его в текст Telegram. */
  body: string;
  attachment: { url: string; name: string; kind: AttachmentKind } | null;
  with_app_button: boolean;
};

export type Broadcast = {
  guid: string;
  status: BroadcastStatus;
  /** Текст Telegram с `\n` — для списка; в редактор идёт `editor_body`. */
  body: string;
  editor_body: string;
  form: BroadcastForm;
  sent_at: string | null;
  created_at: string;
  author_name: string;
  revision: string;
  can_recall: boolean;
  in_progress: boolean;
  counts: Record<DeliveryStatus, number>;
};

export type PreviewText = { text: string; length: number; limit: number };

export type BroadcastPreview = {
  personal: PreviewText;
  group_branch: PreviewText;
  group_company: PreviewText;
  /** У админа нет филиала — в «Лично» подставлен этот пример. */
  branch_example: string | null;
  button_text: string;
  self_linked: boolean;
};

export type Problem = {
  kind: "employee" | "group";
  name?: string;
  chat_id?: string;
  company?: boolean;
  branches?: string[];
  reason: "empty" | "too_long";
  length?: number;
  limit?: number;
};

/** `ready: false` — рассылка неполна (нет канала, филиалов или текста). */
export type BroadcastAudience =
  | { ready: false; reason: string }
  | {
      ready: true;
      employees: { total: number; linked: number; not_linked: number };
      groups: { chat_id: string; company: boolean; branches: string[] }[];
      /** Выбранные группы, которые с тех пор отключили: рассылку они не получат. */
      groups_disconnected: number;
      revision: string;
      problems: Problem[];
      problems_total: number;
    };

export type Recipient = {
  kind: "employee" | "group";
  chat_id: string;
  name: string;
  company: boolean;
  branches: string[];
  status: string;
  error: string;
  sent_at: string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown): string => (typeof value === "string" ? value : "");
const num = (value: unknown): number => (Number.isFinite(Number(value)) ? Number(value) : 0);

const mapCounts = (raw: unknown): Record<DeliveryStatus, number> => {
  const counts = isRecord(raw) ? raw : {};
  return {
    sent: num(counts.sent),
    queued: num(counts.pending) + num(counts.sending),
    blocked: num(counts.blocked),
    no_recipient: num(counts.no_recipient),
    failed: num(counts.failed),
    recalled: num(counts.recalled) + num(counts.cancelled),
  };
};

const mapBroadcast = (raw: Record<string, unknown>): Broadcast => {
  const kind = str(raw.attachment_kind);
  const ids = Array.isArray(raw.locations_ids) ? raw.locations_ids.map(str) : [];
  // Названия филиалов отдаёт только broadcast_get; в списке они не нужны.
  const titles = new Map(
    (Array.isArray(raw.locations) ? raw.locations : [])
      .filter(isRecord)
      .map((item) => [str(item.value), str(item.label)] as const)
  );

  return {
    guid: str(raw.guid),
    status: (str(raw.status) || "draft") as BroadcastStatus,
    body: str(raw.body),
    editor_body: str(raw.editor_body),
    form: {
      audience: raw.audience === "branches" ? "branches" : "company",
      locations: ids.map((id) => ({ value: id, label: titles.get(id) || id })),
      include_no_branch: raw.include_no_branch === true,
      to_employees: raw.to_employees !== false,
      to_groups: raw.to_groups === true,
      group_chat_ids: Array.isArray(raw.group_chat_ids) ? raw.group_chat_ids.map(str).filter(Boolean) : [],
      body: str(raw.editor_body),
      attachment:
        str(raw.attachment_url) && (kind === "photo" || kind === "document")
          ? { url: str(raw.attachment_url), name: str(raw.attachment_name), kind }
          : null,
      with_app_button: raw.with_app_button === true,
    },
    sent_at: str(raw.sent_at) || null,
    created_at: str(raw.created_at),
    author_name: str(raw.author_name),
    revision: str(raw.revision),
    can_recall: raw.can_recall === true,
    in_progress: raw.in_progress === true,
    counts: mapCounts(raw.counts),
  };
};

const mapPreviewText = (raw: unknown): PreviewText => {
  const value = isRecord(raw) ? raw : {};
  return { text: str(value.text), length: num(value.length), limit: num(value.limit) };
};

const toPayload = (form: BroadcastForm) => ({
  audience: form.audience,
  locations_ids: form.locations.map((item) => item.value),
  include_no_branch: form.include_no_branch,
  to_employees: form.to_employees,
  to_groups: form.to_groups,
  group_chat_ids: form.group_chat_ids,
  body: form.body,
  attachment_url: form.attachment?.url || null,
  attachment_name: form.attachment?.name || null,
  attachment_kind: form.attachment?.kind || null,
  with_app_button: form.with_app_button,
});

const call = async (method: string, data: Record<string, unknown> = {}) =>
  (await invokeTasksMethod(method, data)) || {};

export const broadcastsService = {
  // ponytail: 200 последних без пагинации — листать, когда рассылок станет больше.
  list: async (): Promise<Broadcast[]> => {
    const result = await call("broadcast_list", { limit: 200 });
    return (Array.isArray(result.items) ? result.items : []).filter(isRecord).map(mapBroadcast);
  },

  get: async (guid: string): Promise<Broadcast> => mapBroadcast(await call("broadcast_get", { guid })),

  /** Без `guid` — новый черновик; правка черновика требует его `revision`. */
  save: async (form: BroadcastForm, guid?: string, revision?: string): Promise<Broadcast> =>
    mapBroadcast(await call("broadcast_save", { ...toPayload(form), guid, revision })),

  remove: async (guid: string): Promise<void> => {
    await call("broadcast_delete", { guid });
  },

  preview: async (form: BroadcastForm): Promise<BroadcastPreview> => {
    const result = await call("broadcast_preview", toPayload(form));
    return {
      personal: mapPreviewText(result.personal),
      group_branch: mapPreviewText(result.group_branch),
      group_company: mapPreviewText(result.group_company),
      branch_example: str(result.branch_example) || null,
      button_text: str(result.button_text),
      self_linked: result.self_linked === true,
    };
  },

  audience: async (guid: string): Promise<BroadcastAudience> => {
    const result = await call("broadcast_audience", { guid });
    if (typeof result.reason === "string") return { ready: false, reason: result.reason };
    const employees = isRecord(result.employees) ? result.employees : {};
    const list = (value: unknown) => (Array.isArray(value) ? value.filter(isRecord) : []);
    return {
      ready: true,
      employees: { total: num(employees.total), linked: num(employees.linked), not_linked: num(employees.not_linked) },
      groups: list(result.groups).map((group) => ({
        chat_id: str(group.chat_id),
        company: group.company === true,
        branches: Array.isArray(group.branches) ? group.branches.map(str) : [],
      })),
      groups_disconnected: num(result.groups_disconnected),
      revision: str(result.revision),
      problems: list(result.problems) as Problem[],
      problems_total: num(result.problems_total),
    };
  },

  sendTest: async (guid: string) =>
    (await call("broadcast_send_test", { guid })) as {
      sent?: boolean;
      reason?: string;
      description?: string;
      length?: number;
      limit?: number;
    },

  send: async (guid: string, revision: string) =>
    (await call("broadcast_send", { guid, revision })) as {
      sent?: boolean;
      reason?: string;
      problems?: Problem[];
      problems_total?: number;
    },

  recall: async (guid: string): Promise<void> => {
    await call("broadcast_recall", { guid });
  },

  recipients: async (guid: string, status: DeliveryStatus): Promise<Recipient[]> => {
    const result = await call("broadcast_recipients", { guid, status: STATUS_QUERY[status] });
    return (Array.isArray(result.items) ? result.items : []).filter(isRecord).map((item) => ({
      kind: item.kind === "group" ? "group" : "employee",
      chat_id: str(item.chat_id),
      name: str(item.name),
      company: item.company === true,
      branches: Array.isArray(item.branches) ? item.branches.map(str) : [],
      status: str(item.status),
      error: str(item.error),
      sent_at: str(item.sent_at) || null,
    }));
  },
};
