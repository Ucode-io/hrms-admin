import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Plus } from "lucide-react";
import PageMeta from "../../../components/common/PageMeta";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../../components/ui/tabs";
import Button from "../../../components/ui/button/Button";
import DocumentCardsTab, { type DocumentsCardItem } from "./components/DocumentCardsTab";

const DOCUMENT_FOLDERS_SLUG = "document_folders";
const DOCUMENT_TEMPLATES_SLUG = "document_templates";

export default function DocumentsSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() =>
    searchParams.get("tab") === "templates" ? "templates" : "folders"
  );
  const [createRequestId, setCreateRequestId] = useState(0);
  const navigate = useNavigate();

  const pageTitle = activeTab === "templates" ? "Шаблоны документов" : "Папки документов";

  const openTemplateDetails = (item: DocumentsCardItem) => {
    navigate(`/settings/documents/templates/${item.guid}`);
  };

  const openTemplateEditPage = (item: DocumentsCardItem) => {
    navigate(`/settings/documents/templates/${item.guid}/edit`);
  };

  const handleAdd = () => {
    if (activeTab === "templates") {
      navigate("/settings/documents/templates/new");
      return;
    }
    setCreateRequestId((prev) => prev + 1);
  };

  const handleTabChange = (nextTab: string) => {
    setActiveTab(nextTab);
    if (nextTab === "templates") {
      setSearchParams({ tab: "templates" });
      return;
    }
    setSearchParams({});
  };

  return (
    <>
      <PageMeta title="Документы | Настройки" description="Управление папками и шаблонами документов" />

      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">{pageTitle}</h1>
            <p className="mt-1 text-base font-medium text-gray-500">
              Управление папками и шаблонами документов
            </p>
          </div>
          <Button
            className="h-11"
            startIcon={<Plus size={16} />}
            onClick={handleAdd}
          >
            Добавить
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} defaultValue="folders">
          <TabsList className="mb-3">
            <TabsTrigger value="folders">Папки</TabsTrigger>
            <TabsTrigger value="templates">Шаблоны</TabsTrigger>
          </TabsList>

          <TabsContent value="folders">
            <DocumentCardsTab
              slug={DOCUMENT_FOLDERS_SLUG}
              createRequestId={createRequestId}
              isActive={activeTab === "folders"}
              emptyText="Папки документов не найдены"
              itemTitle="папку"
              createModalTitle="Новая папка"
              editModalTitle="Изменить папку"
              deleteModalTitle="Удалить папку"
              titleRequiredText="Название папки обязательно."
              descriptionLabel="Описание"
              createSuccessText="Папка документов создана."
              updateSuccessText="Папка документов обновлена."
              deleteSuccessText="Папка документов удалена."
              saveErrorText="Не удалось сохранить папку документов."
              deleteErrorText="Не удалось удалить папку документов."
              showCount
            />
          </TabsContent>

          <TabsContent value="templates">
            <DocumentCardsTab
              slug={DOCUMENT_TEMPLATES_SLUG}
              createRequestId={createRequestId}
              isActive={activeTab === "templates"}
              emptyText="Шаблоны документов не найдены"
              itemTitle="шаблон"
              createModalTitle="Новый шаблон"
              editModalTitle="Изменить шаблон"
              deleteModalTitle="Удалить шаблон"
              titleRequiredText="Название шаблона обязательно."
              descriptionLabel="Описание"
              createSuccessText="Шаблон документа создан."
              updateSuccessText="Шаблон документа обновлен."
              deleteSuccessText="Шаблон документа удален."
              saveErrorText="Не удалось сохранить шаблон документа."
              deleteErrorText="Не удалось удалить шаблон документа."
              includeFileField
              fileRequiredText="DOCX файл обязателен."
              onCardClick={openTemplateDetails}
              onEditItem={openTemplateEditPage}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
