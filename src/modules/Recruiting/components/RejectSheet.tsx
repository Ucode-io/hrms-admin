import { useEffect, useMemo, useState } from "react";
import Button from "../../../components/ui/button/Button";
import { Modal } from "../../../components/ui/modal";
import FormSelect from "./FormSelect";
import { useSettingsDirectoryQuery } from "../../../api/services/settingsDirectory.service";
import {
  CANDIDATE_REJECTION_REASON_CONFIG,
  CANDIDATE_REJECTION_REASON_ORDER,
} from "../types";

export const REJECTION_REASONS_SLUG = "candidate_rejection_reasons";

// Fallback list (used until the directory collection is populated).
const FALLBACK_OPTIONS = CANDIDATE_REJECTION_REASON_ORDER.map((r) => ({
  value: CANDIDATE_REJECTION_REASON_CONFIG[r].label,
  label: CANDIDATE_REJECTION_REASON_CONFIG[r].label,
}));

interface RejectSheetProps {
  isOpen: boolean;
  candidateName: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isSubmitting?: boolean;
}

/** Confirmation dialog asking for the rejection reason. */
export default function RejectSheet({
  isOpen,
  candidateName,
  onClose,
  onConfirm,
  isSubmitting = false,
}: RejectSheetProps) {
  const [reason, setReason] = useState<string | null>(null);

  const { data } = useSettingsDirectoryQuery({
    slug: REJECTION_REASONS_SLUG,
    params: { limit: 200 },
  });

  const options = useMemo(() => {
    const items = data?.response ?? [];
    const fromDirectory = items
      .map((item) => ({
        value: item.guid,
        label: String(item.title || "").trim() || "Без названия",
      }))
      .filter((item) => item.value);
    return fromDirectory.length > 0 ? fromDirectory : FALLBACK_OPTIONS;
  }, [data]);

  useEffect(() => {
    if (isOpen) setReason(null);
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} showCloseButton={false} className="m-4 max-w-[440px]">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900">Отказать кандидату?</h3>
        <p className="mt-2 text-sm text-gray-500">
          <span className="font-medium text-gray-700">{candidateName}</span> будет перемещён в «Отказ».
          Укажите причину — она попадёт в отчёты по воронке.
        </p>
        <div className="mt-4">
          <FormSelect
            options={options}
            value={reason}
            onChange={(v) => setReason((v as string) || null)}
            placeholder="Причина отказа"
            menuPortal
          />
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose} className="px-5">
            Отменить
          </Button>
          <button
            type="button"
            disabled={!reason || isSubmitting}
            onClick={() => reason && onConfirm(reason)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-600 px-5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            {isSubmitting ? "Сохранение..." : "Отказать"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
