import SimpleDirectorySettingsPage from "../components/SimpleDirectorySettingsPage";
import { useTranslation } from "../../../i18n";

export default function DismissalReasonsSettingsPage() {
  const { t } = useTranslation();
  return (
    <SimpleDirectorySettingsPage
      slug="dismissal_reasons"
      metaTitle={t("settings_pages.dismissal_reasons.meta_title")}
      pageTitle={t("settings_pages.dismissal_reasons.title")}
      pageDescription={t("settings_pages.dismissal_reasons.description")}
      emptyText={t("settings_pages.dismissal_reasons.empty")}
    />
  );
}
