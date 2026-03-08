import SimpleDirectorySettingsPage from "../components/SimpleDirectorySettingsPage";

export default function ProbationPoliciesSettingsPage() {
  return (
    <SimpleDirectorySettingsPage
      slug="probation_policies"
      metaTitle="Политики испытательного срока | Настройки"
      pageTitle="Политики испытательного срока"
      pageDescription="Список политик испытательного срока"
      emptyText="Политики испытательного срока не найдены"
      includeDuration
    />
  );
}
