// Согласование ручного времени — общее для таблицы табеля и страницы дня.
//
// Логика одна: найти процесс по департаменту сотрудника, показать прогресс
// этапов, не дать подтвердить в обход незакрытых этапов и записать итог. Живёт
// отдельным хуком, чтобы обе страницы вели себя одинаково — разошедшиеся копии
// этого правила означали бы, что где-то время можно подтвердить мимо процесса.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  findApprovalProcessFor,
  useApprovalProcessesQuery,
  useApproveStage,
  useEntityApprovalsQuery,
} from "../../api/services/approval.service";
import { useReviewManualTime } from "../../api/services/manualTime.service";
import {
  countApprovedStages,
  isProcessComplete,
} from "../Settings/Approvals/approvalRuntime";
import type { TimesheetEntry } from "./types";

/** Ручное время согласуется тем же движком, что и правки посещаемости. */
export const MANUAL_TIME_ENTITY_TYPE = "manual_time";
export const MANUAL_TIME_PROCESS_TYPE = "manual_time_approval";

export function useManualTimeApproval(
  entries: TimesheetEntry[],
  /** Департамент сотрудника записи — от него зависит процесс согласования. */
  departmentIdOf: (entry: TimesheetEntry) => string | null | undefined
) {
  const [approvalEntry, setApprovalEntry] = useState<TimesheetEntry | null>(null);

  const { data: approvalProcesses } = useApprovalProcessesQuery();
  const reviewManual = useReviewManualTime();
  const approveStage = useApproveStage();

  const resolveProcess = (entry: TimesheetEntry | null) =>
    entry
      ? findApprovalProcessFor(
          approvalProcesses ?? [],
          MANUAL_TIME_PROCESS_TYPE,
          departmentIdOf(entry)
        )
      : undefined;

  // Прогресс тянем разом по видимым записям: иначе бейдж этапов на строке
  // стоил бы отдельного запроса на каждую.
  const entityIds = useMemo(
    () =>
      entries
        .filter((entry) => entry.isManual)
        .filter((entry) =>
          findApprovalProcessFor(
            approvalProcesses ?? [],
            MANUAL_TIME_PROCESS_TYPE,
            departmentIdOf(entry)
          )
        )
        .map((entry) => entry.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, approvalProcesses]
  );

  const { data: progressMap } = useEntityApprovalsQuery(MANUAL_TIME_ENTITY_TYPE, entityIds);

  const review = async (
    entry: TimesheetEntry,
    status: "approved" | "rejected",
    comment = ""
  ) => {
    try {
      await reviewManual.mutateAsync({ guid: entry.id, status, comment });
      setApprovalEntry(null);
      toast.success(status === "approved" ? "Время подтверждено." : "Запись отклонена.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось изменить статус.");
    }
  };

  /**
   * Клик по «Подтвердить». Если на департамент настроен процесс и не все этапы
   * пройдены — открываем модалку этапов вместо подтверждения: подтверждать в
   * обход согласования нельзя. Ровно то же поведение, что в посещаемости.
   */
  const confirm = async (entry: TimesheetEntry) => {
    const process = resolveProcess(entry);
    if (process && !isProcessComplete(process, progressMap?.[entry.id] ?? null)) {
      setApprovalEntry(entry);
      return;
    }
    await review(entry, "approved");
  };

  /** Сколько этапов пройдено — для кнопки с прогрессом на строке. */
  const stagesOf = (entry: TimesheetEntry) => {
    const process = resolveProcess(entry);
    return {
      process,
      total: process?.stages.length ?? 0,
      approved: process ? countApprovedStages(process, progressMap?.[entry.id] ?? null) : 0,
    };
  };

  const approvalProcess = resolveProcess(approvalEntry);

  const modalProps = {
    isOpen: Boolean(approvalEntry),
    onClose: () => setApprovalEntry(null),
    process: approvalProcess ?? null,
    progress: approvalEntry ? progressMap?.[approvalEntry.id] ?? null : null,
    onApproveStage: (stageId: string, comment: string) => {
      if (!approvalEntry || !approvalProcess) return;
      void approveStage.mutateAsync({
        entityType: MANUAL_TIME_ENTITY_TYPE,
        entityId: approvalEntry.id,
        processId: approvalProcess.id,
        stageId,
        comment,
      });
    },
    isApprovingStage: approveStage.isLoading,
    onConfirm: () => {
      if (approvalEntry) void review(approvalEntry, "approved");
    },
    isConfirming: reviewManual.isLoading,
    onReject: (comment: string) => {
      if (approvalEntry) void review(approvalEntry, "rejected", comment);
    },
    isRejecting: reviewManual.isLoading,
    confirmLabel: "Подтвердить время",
    // Финализированную запись открываем как историю: видно, кто и когда одобрял.
    readOnly: (approvalEntry?.status ?? "pending") !== "pending",
  };

  return {
    confirm,
    review,
    stagesOf,
    openApproval: setApprovalEntry,
    isReviewing: reviewManual.isLoading,
    modalProps,
  };
}
