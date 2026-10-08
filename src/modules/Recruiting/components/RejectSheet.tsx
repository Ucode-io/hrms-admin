import { useEffect, useMemo, useState } from "react";
import Button from "../../../components/ui/button/Button";
import { Modal } from "../../../components/ui/modal";
import FormSelect from "./FormSelect";
import { Link } from "react-router";
import { useSettingsDirectoryQuery } from "../../../api/services/settingsDirectory.service";
import { useTranslation } from "../../../i18n";

export const REJECTION_REASONS_SLUG = "candidate_rejection_reasons";

interface RejectSheetProps {
  isOpen: boolean;
  candidateName: string;
  onClose: () => void;
  onConfirm: (reason: string | null) => void;
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
  const { t } = useTranslation();
  const [reason, setReason] = useState<string | null>(null);

  const { data, isLoading } = useSettingsDirectoryQuery({
    slug: REJECTION_REASONS_SLUG,
    params: { limit: 200 },
  });

  // Reason is a uuid relation to the directory — only directory rows can be stored.
  const options = useMemo(
    () =>
      (data?.response ?? [])
        .map((item) => ({
          value: item.guid,
          label: String(item.title || "").trim() || t("recruiting.common.untitled"),
        }))
        .filter((item) => item.value),
    [data, t]
  );
  const reasonRequired = options.length > 0;

  useEffect(() => {
    if (isOpen) setReason(null);
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} showCloseButton={false} className="m-4 max-w-[440px]">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900">{t("recruiting.reject_sheet.title")}</h3>
        <p className="mt-2 text-sm text-gray-500">
          {t("recruiting.reject_sheet.message", { name: candidateName })}
        </p>
        <div className="mt-4">
          {reasonRequired || isLoading ? (
            <FormSelect
              options={options}
              value={reason}
              onChange={(v) => setReason((v as string) || null)}
              placeholder={t("recruiting.reject_sheet.placeholder")}
              menuPortal
            />
          ) : (
            <p className="text-sm text-gray-500">
              {t("recruiting.reject_sheet.empty_directory")}{" "}
              <Link to="/settings/rejection-reasons" className="text-brand-500 hover:underline">
                {t("recruiting.reject_sheet.add_reasons")}
              </Link>
            </p>
          )}
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onClose} className="px-5">
            {t("recruiting.common.cancel")}
          </Button>
          <button
            type="button"
            disabled={(reasonRequired && !reason) || isLoading || isSubmitting}
            onClick={() => onConfirm(reason)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-600 px-5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            {isSubmitting ? t("recruiting.reject_sheet.saving") : t("recruiting.reject_sheet.reject")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
