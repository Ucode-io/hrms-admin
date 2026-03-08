import SimpleDirectorySettingsPage from "../components/SimpleDirectorySettingsPage";

export default function DismissalReasonsSettingsPage() {
  return (
    <SimpleDirectorySettingsPage
      slug="dismissal_reasons"
      metaTitle="Причины увольнения | Настройки"
      pageTitle="Причины увольнения"
      pageDescription="Список причин увольнения"
      emptyText="Причины увольнения не найдены"
    />
  );
}
