import SimpleDirectorySettingsPage from "../components/SimpleDirectorySettingsPage";

export default function EmployeeWorkChangeReasonsSettingsPage() {
  return (
    <SimpleDirectorySettingsPage
      slug="employee_work_reason"
      metaTitle="Причины изменения работы | Настройки"
      pageTitle="Причины изменения работы"
      pageDescription="Список причин для изменений employee works"
      emptyText="Причины изменения работы не найдены"
    />
  );
}
