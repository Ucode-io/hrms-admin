import SimpleDirectorySettingsPage from "../components/SimpleDirectorySettingsPage";
import { useTranslation } from "../../../i18n";

export default function DismissalTypesSettingsPage() {
  const { t } = useTranslation();
  return (
    <SimpleDirectorySettingsPage
      slug="dismissal_types"
      metaTitle={t("settings_pages.dismissal_types.meta_title")}
      pageTitle={t("settings_pages.dismissal_types.title")}
      pageDescription={t("settings_pages.dismissal_types.description")}
      emptyText={t("settings_pages.dismissal_types.empty")}
    />
  );
}
