import SimpleDirectorySettingsPage from "../components/SimpleDirectorySettingsPage";

export default function CandidateSourcesSettingsPage() {
  return (
    <SimpleDirectorySettingsPage
      slug="candidate_sources"
      metaTitle="Источники кандидатов | Настройки"
      pageTitle="Источники кандидатов"
      pageDescription="Список источников кандидатов"
      emptyText="Источники не найдены"
    />
  );
}
