// Types + constants for the Approvals module. The actual processes are now
// stored in the `approval_processes` collection (items API) — see
// api/services/approval.service.ts. This file is the shared type source.

import { type MessageKey } from "../../../i18n/messages";

export type ApprovalProcessType =
  | "absence_approval"
  | "attendance_change_approval"
  | "remote_mark_approval"
  | "manual_time_approval"
  | "employee_work_approval";

export interface ApprovalRef {
  id: string;
  title: string;
}

export interface ApprovalStage {
  id: string;
  title: string;
  /** Position whose holder approves this stage. */
  positionId: string;
  positionTitle: string;
}

export interface ApprovalProcess {
  id: string;
  title: string;
  type: ApprovalProcessType;
  departments: ApprovalRef[];
  description: string;
  stages: ApprovalStage[];
}

export const PROCESS_TYPES = [
  { value: "absence_approval", labelKey: "settings_approvals.process_types.absence_approval" },
  { value: "attendance_change_approval", labelKey: "settings_approvals.process_types.attendance_change_approval" },
  { value: "remote_mark_approval", labelKey: "settings_approvals.process_types.remote_mark_approval" },
  { value: "manual_time_approval", labelKey: "settings_approvals.process_types.manual_time_approval" },
  { value: "employee_work_approval", labelKey: "settings_approvals.process_types.employee_work_approval" },
] as const satisfies ReadonlyArray<{ value: ApprovalProcessType; labelKey: MessageKey }>;

export const getProcessTypeLabel = (
  type: ApprovalProcessType,
  t: (key: MessageKey) => string,
): string => {
  const found = PROCESS_TYPES.find((item) => item.value === type);
  return found ? t(found.labelKey) : type;
};

const genId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export const createStageId = () => genId("st");
