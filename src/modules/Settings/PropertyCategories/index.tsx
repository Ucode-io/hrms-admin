import SimpleDirectorySettingsPage from "../components/SimpleDirectorySettingsPage";

export default function PropertyCategoriesSettingsPage() {
  return (
    <SimpleDirectorySettingsPage
      slug="property_categories"
      metaTitle="Категории имущества | Настройки"
      pageTitle="Категории имущества"
      pageDescription="Список категорий имущества"
      emptyText="Категории имущества не найдены"
    />
  );
}
