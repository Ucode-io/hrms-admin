import { type ReactNode, useMemo, useState } from "react";
import ApprovalProcessModal from "../../../components/approvals/ApprovalProcessModal";
import companyStore from "../../../store/company.store";
import { COMPANY_ID, useUpdateSettingsDirectoryItem } from "../../../api/services/settingsDirectory.service";
import {
  attendanceApprovalType,
  findApprovalProcessFor,
  useApprovalProcessesQuery,
  useApproveStage,
  useEntityApprovalsQuery,
} from "../../../api/services/approval.service";
import { isProcessComplete } from "../../Settings/Approvals/approvalRuntime";
import { useTranslation } from "../../../i18n";

// Согласование строки посещаемости (отметка вне радиуса, ручная правка):
// процесс по отделу сотрудника, этапы, подтвердить или отклонить. Общее для
// «Списка» посещаемости и модалки дня в табеле.

const ATTENDANCE_ENTITY_TYPE = "attendance";
const DELAY_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type ReviewRecord = {
  guid: string;
  date: string;
  employeeGuid: string;
  departmentId: string;
  checkInTime: string;
  checkOutTime: string;
  delayTime: string;
  requestStatus: "accepted" | "rejected" | "requested" | "unknown";
  actionStatus: "present" | "late" | "absent" | "unknown";
  sourceType: "manual" | "integration" | "absences" | "off_schedule" | "unknown";
};

const delayOrZero = (value: string): string =>
  DELAY_TIME_PATTERN.test(value.trim()) ? value.trim() : "00:00";

/**
 * Источник строки, который сохраняет правка или согласование. Ручная правка
 * делает строку ручной, но «интеграция» и «вне графика» свой источник
 * сохраняют: иначе согласованная отметка без смены молча стала бы ручной —
 * то есть рабочим днём в обход решения 14.
 */
const keptSourceType = (sourceType: ReviewRecord["sourceType"]): string =>
  sourceType === "integration" || sourceType === "off_schedule" ? sourceType : "manual";

/**
 * Статус уже сохранённой строки, у которой он почему-то пуст.
 *
 * Читается из её же `delay_time` — он посчитан по графику тем, кто строку
 * записал. Спрашивать сервер заново незачем: ответ уже лежит в строке, а
 * согласование отметки не должно падать из-за недоступности расчёта.
 */
const resolveActionStatusFromDelay = (checkInTime: string, delayTime: string) => {
  if (!checkInTime) return "absent";
  return delayOrZero(delayTime) !== "00:00" ? "late" : "present";
};

const buildReviewPayload = (record: ReviewRecord, status: "accepted" | "rejected") => ({
  user_base_id: record.employeeGuid,
  companies_id: companyStore.company?.guid || COMPANY_ID,
  date: record.date,
  ...(record.checkInTime ? { check_in_time: record.checkInTime } : {}),
  ...(record.checkOutTime ? { check_out_time: record.checkOutTime } : {}),
  delay_time: delayOrZero(record.delayTime),
  status: [status],
  action_status: [
    record.actionStatus === "unknown"
      ? resolveActionStatusFromDelay(record.checkInTime, record.delayTime)
      : record.actionStatus,
  ],
  source_type: [keptSourceType(record.sourceType)],
});

export function useAttendanceReview<R extends ReviewRecord>({
  records,
  onError,
  onDone,
  renderDetails,
}: {
  /** Видимые строки: по ним грузится прогресс согласований. */
  records: R[];
  onError: (message: string) => void;
  /** После подтверждения или отклонения. */
  onDone?: () => void;
  renderDetails?: (record: R) => ReactNode;
}) {
  const { t } = useTranslation();
  const [approvalRecord, setApprovalRecord] = useState<R | null>(null);
  const { data: approvalProcesses } = useApprovalProcessesQuery();
  const approveStageMutation = useApproveStage();
  const updateMutation = useUpdateSettingsDirectoryItem("attendance");

  // Resolve the approval process for a row from that employee's department.
  const resolveProcess = (record: R) =>
    findApprovalProcessFor(
      approvalProcesses ?? [],
      attendanceApprovalType(record.sourceType),
      record.departmentId
    );

  // Bulk approval progress for visible rows so finalized rows can still show
  // the clickable audit badge.
  const approvalEntityIds = useMemo(
    () =>
      records
        .filter((record) =>
          findApprovalProcessFor(
            approvalProcesses ?? [],
            attendanceApprovalType(record.sourceType),
            record.departmentId
          )
        )
        .map((record) => record.guid),
    [records, approvalProcesses]
  );

  const { data: progressMap } = useEntityApprovalsQuery(ATTENDANCE_ENTITY_TYPE, approvalEntityIds);

  const confirmRecord = (record: R) =>
    updateMutation.mutateAsync({ guid: record.guid, data: buildReviewPayload(record, "accepted") });

  // «Подтвердить». With a configured approval process the change must pass
  // every stage first → open the approval modal instead of confirming.
  const confirm = async (record: R) => {
    const process = resolveProcess(record);
    if (process && !isProcessComplete(process, progressMap?.[record.guid] ?? null)) {
      setApprovalRecord(record);
      return;
    }
    try {
      await confirmRecord(record);
      onDone?.();
    } catch (confirmError) {
      console.error("Attendance confirm error:", confirmError);
      onError(t("attendance.confirm_error"));
    }
  };

  const approvalRecordProcess = approvalRecord ? resolveProcess(approvalRecord) : undefined;

  const handleApproveStage = async (stageId: string, comment: string) => {
    if (!approvalRecord || !approvalRecordProcess) return;
    try {
      await approveStageMutation.mutateAsync({
        entityType: ATTENDANCE_ENTITY_TYPE,
        entityId: approvalRecord.guid,
        processId: approvalRecordProcess.id,
        stageId,
        comment,
      });
    } catch (stageError) {
      console.error("Attendance stage approve error:", stageError);
      onError(t("attendance.approve_stage_error"));
    }
  };

  const finalizeApproval = async () => {
    if (!approvalRecord) return;
    try {
      await confirmRecord(approvalRecord);
      setApprovalRecord(null);
      onDone?.();
    } catch (confirmError) {
      console.error("Attendance confirm error:", confirmError);
      onError(t("attendance.confirm_error"));
    }
  };

  const rejectFromApproval = async () => {
    if (!approvalRecord) return;
    try {
      await updateMutation.mutateAsync({
        guid: approvalRecord.guid,
        data: buildReviewPayload(approvalRecord, "rejected"),
      });
      setApprovalRecord(null);
      onDone?.();
    } catch (rejectError) {
      console.error("Attendance reject error:", rejectError);
      onError(t("attendance.reject_error"));
    }
  };

  const modal = (
    <ApprovalProcessModal
      isOpen={Boolean(approvalRecord)}
      onClose={() => setApprovalRecord(null)}
      process={approvalRecordProcess ?? null}
      progress={approvalRecord ? progressMap?.[approvalRecord.guid] ?? null : null}
      onApproveStage={(stageId, comment) => void handleApproveStage(stageId, comment)}
      isApprovingStage={approveStageMutation.isLoading}
      confirmLabel={t("attendance.confirm_record")}
      onConfirm={() => void finalizeApproval()}
      isConfirming={updateMutation.isLoading}
      onReject={() => void rejectFromApproval()}
      isRejecting={updateMutation.isLoading}
      readOnly={approvalRecord?.requestStatus !== "requested"}
      details={approvalRecord && renderDetails ? renderDetails(approvalRecord) : null}
    />
  );

  return {
    resolveProcess,
    progressMap,
    /** Открыть окно согласования: этапы, подтвердить или отклонить. */
    open: setApprovalRecord,
    isOpen: Boolean(approvalRecord),
    confirm,
    isUpdating: updateMutation.isLoading,
    modal,
  };
}
