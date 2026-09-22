import SimpleDirectorySettingsPage from "../components/SimpleDirectorySettingsPage";
import { useTranslation } from "../../../i18n";

export default function ProbationPoliciesSettingsPage() {
  const { t } = useTranslation();
  return (
    <SimpleDirectorySettingsPage
      slug="probation_policies"
      metaTitle={t("settings_pages.probation_policies.meta_title")}
      pageTitle={t("settings_pages.probation_policies.title")}
      pageDescription={t("settings_pages.probation_policies.description")}
      emptyText={t("settings_pages.probation_policies.empty")}
      includeDuration
    />
  );
}
