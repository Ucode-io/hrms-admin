import { PROPERTY_STATUS_CONFIG, type PropertyStatus } from "../types";
import { useTranslation } from "../../../i18n";

export default function StatusBadge({ status }: { status: PropertyStatus }) {
  const { t } = useTranslation();
  const config = PROPERTY_STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.badgeClassName}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotClassName}`} />
      {t(config.labelKey)}
    </span>
  );
}
