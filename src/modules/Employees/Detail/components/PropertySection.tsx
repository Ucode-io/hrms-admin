import { useMemo, useState } from "react";
import { Boxes } from "lucide-react";
import { Modal } from "../../../../components/ui/modal";
import { mapPropertyRow, usePropertiesQuery } from "../../../../api/services/property.service";
import StatusBadge from "../../../Property/components/StatusBadge";
import { formatCurrency, formatDate, type PropertyItem } from "../../../Property/types";
import { useTranslation } from "../../../../i18n";

type PropertySectionProps = {
  employeeGuid: string;
  brandColor: string;
};

/** Имущество, которое сейчас числится за сотрудником (`properties.user_base_id`). Только просмотр — выдача и возврат на /property. */
export default function PropertySection({ employeeGuid, brandColor }: PropertySectionProps) {
  const { t } = useTranslation();
  const [photoItem, setPhotoItem] = useState<PropertyItem | null>(null);

  // ponytail: 100 без пагинации — у одного человека столько вещей не бывает; упрётся — добавить пагинацию.
  const { data, isLoading, isError } = usePropertiesQuery({ limit: 100, offset: 0, userBaseId: employeeGuid });
  const items = useMemo(() => (data?.response ?? []).map(mapPropertyRow), [data]);

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4.5">
          <span style={{ color: brandColor }}>
            <Boxes className="h-4 w-4" />
          </span>
          <h3 className="m-0 text-[15px] font-bold text-slate-900">{t("employees.detail.tabs.property")}</h3>
        </div>

        <div className="px-6 py-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200" style={{ borderTopColor: brandColor }} />
            </div>
          ) : isError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-4 text-[13px] text-rose-600">
              {t("employees.property.load_failed")}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
              <p className="m-0 text-[13px] text-slate-500">{t("employees.property.empty")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-2 pr-3 text-[12px] font-semibold text-slate-500">{t("property.table.name")}</th>
                    <th className="py-2 pr-3 text-[12px] font-semibold text-slate-500">{t("property.table.category")}</th>
                    <th className="py-2 pr-3 text-[12px] font-semibold text-slate-500">{t("property.table.serial")}</th>
                    <th className="py-2 pr-3 text-[12px] font-semibold text-slate-500">{t("property.table.cost")}</th>
                    <th className="py-2 pr-3 text-[12px] font-semibold text-slate-500">{t("property.movement.issue_date")}</th>
                    <th className="py-2 text-[12px] font-semibold text-slate-500">{t("property.table.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="py-3 pr-3 text-[13px] text-slate-800">
                        <div className="flex items-center gap-3">
                          {item.photo ? (
                            <button
                              type="button"
                              onClick={() => setPhotoItem(item)}
                              className="shrink-0 cursor-zoom-in rounded-lg transition hover:opacity-80"
                            >
                              <img src={item.photo} alt={item.name} className="h-9 w-9 rounded-lg bg-gray-50 object-contain" />
                            </button>
                          ) : null}
                          <span className="font-medium">{item.name}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-[13px] text-slate-700">{item.categoryTitle || "—"}</td>
                      <td className="py-3 pr-3 font-mono text-[12px] text-slate-500">{item.serialNumber || "—"}</td>
                      <td className="py-3 pr-3 text-[13px] font-medium text-slate-700">{formatCurrency(item.cost)}</td>
                      <td className="py-3 pr-3 text-[13px] text-slate-700">{formatDate(item.assignedDate)}</td>
                      <td className="py-3">
                        <StatusBadge status={item.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={Boolean(photoItem)} onClose={() => setPhotoItem(null)} className="m-4 max-w-4xl p-4">
        {photoItem?.photo ? (
          <img src={photoItem.photo} alt={photoItem.name} className="max-h-[80vh] w-full rounded-2xl object-contain" />
        ) : null}
      </Modal>
    </>
  );
}
