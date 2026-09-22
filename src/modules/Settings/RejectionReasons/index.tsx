import SimpleDirectorySettingsPage from "../components/SimpleDirectorySettingsPage";
import { useTranslation } from "../../../i18n";

export default function RejectionReasonsSettingsPage() {
  const { t } = useTranslation();
  return (
    <SimpleDirectorySettingsPage
      slug="candidate_rejection_reasons"
      metaTitle={t("settings_pages.rejection_reasons.meta_title")}
      pageTitle={t("settings_pages.rejection_reasons.title")}
      pageDescription={t("settings_pages.rejection_reasons.description")}
      emptyText={t("settings_pages.rejection_reasons.empty")}
    />
  );
}
