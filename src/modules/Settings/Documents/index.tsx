import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ChevronLeft, Plus } from "lucide-react";
import PageMeta from "../../../components/common/PageMeta";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import Button from "../../../components/ui/button/Button";
import DocumentCardsTab, { type DocumentsCardItem } from "./components/DocumentCardsTab";

const DOCUMENT_FOLDERS_SLUG = "document_folders";
const DOCUMENT_TEMPLATES_SLUG = "document_templates";

export default function DocumentsSettingsPage() {
  const [activeTab, setActiveTab] = useState("folders");
  const [createRequestId, setCreateRequestId] = useState(0);
  const navigate = useNavigate();

  const pageTitle = activeTab === "templates" ? "Шаблоны документов" : "Папки документов";

  const openTemplateDetails = (item: DocumentsCardItem) => {
    navigate(`/settings/documents/templates/${item.guid}`);
  };

  return (
    <>
      <PageMeta title="Документы | Настройки" description="Управление папками и шаблонами документов" />

      <div className="space-y-4">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-gray-700"
        >
          <ChevronLeft size={16} />
          Назад
        </Link>

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
            onClick={() => setCreateRequestId((prev) => prev + 1)}
          >
            Добавить
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="folders">
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
              fileRequiredText="PDF файл обязателен."
              onCardClick={openTemplateDetails}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
