import SimpleDirectorySettingsPage from "../components/SimpleDirectorySettingsPage";

export default function DismissalTypesSettingsPage() {
  return (
    <SimpleDirectorySettingsPage
      slug="dismissal_types"
      metaTitle="Типы увольнения | Настройки"
      pageTitle="Типы увольнения"
      pageDescription="Список типов увольнения"
      emptyText="Типы увольнения не найдены"
    />
  );
}
