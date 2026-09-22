import SimpleDirectorySettingsPage from "../components/SimpleDirectorySettingsPage";
import { useTranslation } from "../../../i18n";

export default function EmployeeWorkChangeReasonsSettingsPage() {
  const { t } = useTranslation();
  return (
    <SimpleDirectorySettingsPage
      slug="employee_work_reason"
      metaTitle={t("settings_pages.employee_work_change_reasons.meta_title")}
      pageTitle={t("settings_pages.employee_work_change_reasons.title")}
      pageDescription={t("settings_pages.employee_work_change_reasons.description")}
      emptyText={t("settings_pages.employee_work_change_reasons.empty")}
    />
  );
}
