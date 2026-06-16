import SimpleDirectorySettingsPage from "../components/SimpleDirectorySettingsPage";

export default function RejectionReasonsSettingsPage() {
  return (
    <SimpleDirectorySettingsPage
      slug="candidate_rejection_reasons"
      metaTitle="Причины отказа кандидату | Настройки"
      pageTitle="Причины отказа кандидату"
      pageDescription="Список причин отказа кандидатам"
      emptyText="Причины отказа не найдены"
    />
  );
}
