import SimpleDirectorySettingsPage from "../components/SimpleDirectorySettingsPage";
import { useTranslation } from "../../../i18n";

export default function CandidateSourcesSettingsPage() {
  const { t } = useTranslation();
  return (
    <SimpleDirectorySettingsPage
      slug="candidate_sources"
      metaTitle={t("settings_pages.candidate_sources.meta_title")}
      pageTitle={t("settings_pages.candidate_sources.title")}
      pageDescription={t("settings_pages.candidate_sources.description")}
      emptyText={t("settings_pages.candidate_sources.empty")}
    />
  );
}
