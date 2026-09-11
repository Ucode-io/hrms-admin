// Mirror of the HRMS Copilot protocol (udevs_hrms_copilot,
// src/copilot/types/copilot.types.ts). Kept as a copy rather than a shared
// package because the two live in separate repositories; when the service adds
// an event type, add it here too.

export type CopilotToolRisk = "read" | "write" | "destructive";

export type CopilotChartKind = "area" | "line" | "bar" | "pie" | "donut";
export type CopilotChartFormat = "number" | "currency" | "percent" | "duration";

export interface CopilotChartSeries {
  key: string;
  label?: string;
  format?: CopilotChartFormat;
}

export interface CopilotChart {
  id: string;
  kind: CopilotChartKind;
  title: string;
  subtitle?: string;
  data: Array<Record<string, string | number>>;
  xKey?: string;
  series?: CopilotChartSeries[];
}

export interface CopilotKpi {
  label: string;
  value: string;
  changePct?: number | null;
  hint?: string;
}

export type CopilotLinkKind =
  | "employee"
  | "employees"
  | "reports"
  | "time"
  | "settings"
  | "knowledge"
  | "external";

export interface CopilotLink {
  id: string;
  label: string;
  href: string;
  external?: boolean;
  kind?: CopilotLinkKind;
  description?: string;
}

export interface CopilotTable {
  id: string;
  title: string;
  subtitle?: string;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, string | number | null>>;
  totalCount?: number;
  link?: CopilotLink;
}

export type CopilotStopReason =
  | "end_turn"
  | "awaiting_confirmation"
  | "max_turns"
  | "max_tokens"
  | "error"
  | "refusal";

export type CopilotErrorCode =
  | "forbidden"
  | "permission_denied"
  | "not_found"
  | "rate_limited"
  | "invalid_action"
  | "action_expired"
  | "timeout"
  /** Misconfigured or unpayable upstream — retrying will not help. */
  | "unavailable"
  | "internal";

export interface CopilotFieldChange {
  field: string;
  label?: string;
  before: string | null;
  after: string | null;
}

export interface CopilotProposedAction {
  actionId: string;
  toolName: string;
  title: string;
  description: string;
  args: Record<string, unknown>;
  risk: CopilotToolRisk;
  changes?: CopilotFieldChange[];
}

export interface CopilotExecutedAction {
  actionId: string;
  toolName: string;
  ok: boolean;
  summary: string;
  error?: string;
}

export type CopilotStreamEvent =
  | { type: "message_start"; messageId: string; conversationId: string }
  | { type: "text_delta"; text: string }
  | { type: "tool_call"; toolName: string; toolUseId: string; risk: CopilotToolRisk }
  | { type: "action_executed"; action: CopilotExecutedAction }
  | { type: "action_proposed"; action: CopilotProposedAction }
  | { type: "chart"; chart: CopilotChart }
  | { type: "kpis"; kpis: CopilotKpi[] }
  | { type: "link"; link: CopilotLink }
  | { type: "table"; table: CopilotTable }
  | { type: "message_complete"; messageId: string; stopReason: CopilotStopReason }
  | { type: "usage"; inputTokens: number; outputTokens: number }
  | { type: "error"; message: string; code?: CopilotErrorCode };

export interface CopilotConversationSummary {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One reopened conversation: the transcript, already projected by the service. */
export interface CopilotConversationDetail extends CopilotConversationSummary {
  messages: CopilotMessage[];
  /**
   * The action the service still holds a card for. Replay renders it as stale
   * rather than live — approving a change proposed in a session that has since
   * ended, against data that has moved, is what the card exists to prevent.
   */
  pendingActionId: string | null;
}

/**
 * A file the person attached to a message. `data` is base64 without the
 * `data:` prefix — the same shape the service's CopilotAttachmentDto takes.
 */
export interface CopilotAttachment {
  name: string;
  mediaType: string;
  data: string;
}

export type CopilotMessageRole = "user" | "assistant";

export type CopilotActionState =
  | "proposed"
  | "approved"
  | "rejected"
  | "executed"
  | "failed";

export interface CopilotMessageAction {
  actionId: string;
  toolName: string;
  title: string;
  description: string;
  risk: CopilotToolRisk;
  state: CopilotActionState;
  changes?: CopilotFieldChange[];
  summary?: string;
  error?: string;
}

export type CopilotMessageStatus = "streaming" | "complete" | "error";

export interface CopilotMessage {
  id: string;
  role: CopilotMessageRole;
  content: string;
  createdAt: string;
  actions?: CopilotMessageAction[];
  charts?: CopilotChart[];
  kpis?: CopilotKpi[];
  tables?: CopilotTable[];
  links?: CopilotLink[];
  status?: CopilotMessageStatus;
  truncated?: boolean;
  /** Name and size of the file sent with this message, for the chip on it. */
  file?: { name: string; size: number };
}
