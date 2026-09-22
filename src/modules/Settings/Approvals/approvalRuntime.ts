// Pure helpers shared by the approvals UI. Progress now comes from the API
// (api/services/approval.service.ts) — these functions only derive state from a
// process + a progress object, and resolve the acting (current) user.

import authStore from "../../../store/auth.store";
import { translate } from "../../../i18n";
import { type ApprovalProcess } from "./mockData";

export interface StageApproval {
  stageId: string;
  approvedAt: string;
  approverName: string;
  approverAvatar: string;
  comment: string;
}

export interface RequestApprovalProgress {
  processId: string | null;
  /** Stage approvals in the order they were granted. */
  approvals: StageApproval[];
}

/** Display name of the currently logged-in user (the acting approver). */
export const getCurrentUserName = (): string => {
  const user = authStore.user;
  if (!user) return translate("settings_approvals.current_user_fallback");
  const name = [user.second_name, user.first_name].filter(Boolean).join(" ").trim();
  return name || user.login || translate("settings_approvals.current_user_fallback");
};

/** Name + avatar of the currently logged-in user (the acting approver). */
export const getCurrentUser = (): { name: string; avatar: string } => {
  const user = authStore.user;
  const avatar =
    (typeof user?.avatar === "string" && user.avatar) ||
    (typeof user?.photo === "string" && user.photo) ||
    "";
  return { name: getCurrentUserName(), avatar };
};

export const getStageApproval = (
  progress: RequestApprovalProgress | null | undefined,
  stageId: string
): StageApproval | undefined =>
  progress?.approvals.find((approval) => approval.stageId === stageId);

export const isProcessComplete = (
  process: ApprovalProcess,
  progress: RequestApprovalProgress | null | undefined
): boolean => {
  if (!progress) return false;
  return process.stages.every((stage) =>
    progress.approvals.some((approval) => approval.stageId === stage.id)
  );
};

export const countApprovedStages = (
  process: ApprovalProcess,
  progress: RequestApprovalProgress | null | undefined
): number => {
  if (!progress) return 0;
  return process.stages.filter((stage) =>
    progress.approvals.some((approval) => approval.stageId === stage.id)
  ).length;
};

/** Index of the next stage awaiting approval, or -1 when complete. */
export const nextPendingStageIndex = (
  process: ApprovalProcess,
  progress: RequestApprovalProgress | null | undefined
): number =>
  process.stages.findIndex(
    (stage) => !progress?.approvals.some((approval) => approval.stageId === stage.id)
  );
