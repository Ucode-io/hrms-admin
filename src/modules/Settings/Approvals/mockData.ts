// Types + constants for the Approvals module. The actual processes are now
// stored in the `approval_processes` collection (items API) — see
// api/services/approval.service.ts. This file is the shared type source.

export type ApprovalProcessType =
  | "absence_approval"
  | "attendance_change_approval";

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

export const PROCESS_TYPES: { value: ApprovalProcessType; label: string }[] = [
  { value: "absence_approval", label: "Одобрение отсутствия" },
  { value: "attendance_change_approval", label: "Одобрение изменения по посещаемости" },
];

export const getProcessTypeLabel = (type: ApprovalProcessType): string =>
  PROCESS_TYPES.find((item) => item.value === type)?.label || type;

const genId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export const createStageId = () => genId("st");
