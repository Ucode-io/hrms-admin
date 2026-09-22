import SimpleDirectorySettingsPage from "../components/SimpleDirectorySettingsPage";
import { useTranslation } from "../../../i18n";

export default function PropertyCategoriesSettingsPage() {
  const { t } = useTranslation();
  return (
    <SimpleDirectorySettingsPage
      slug="property_categories"
      metaTitle={t("settings_pages.property_categories.meta_title")}
      pageTitle={t("settings_pages.property_categories.title")}
      pageDescription={t("settings_pages.property_categories.description")}
      emptyText={t("settings_pages.property_categories.empty")}
    />
  );
}
