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
import { useTranslation } from "../../../i18n";

const DOCUMENT_FOLDERS_SLUG = "document_folders";
const DOCUMENT_TEMPLATES_SLUG = "document_templates";

export default function DocumentsSettingsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() =>
    searchParams.get("tab") === "templates" ? "templates" : "folders"
  );
  const [createRequestId, setCreateRequestId] = useState(0);
  const navigate = useNavigate();

  const pageTitle =
    activeTab === "templates"
      ? t("settings_documents.index.templates_title")
      : t("settings_documents.index.folders_title");

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
      <PageMeta title={t("settings_documents.index.page_title")} description={t("settings_documents.index.page_description")} />

      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">{pageTitle}</h1>
            <p className="mt-1 text-base font-medium text-gray-500">
              {t("settings_documents.index.subtitle")}
            </p>
          </div>
          <Button
            className="h-11"
            startIcon={<Plus size={16} />}
            onClick={handleAdd}
          >
            {t("settings_documents.index.add_button")}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} defaultValue="folders">
          <TabsList className="mb-3">
            <TabsTrigger value="folders">{t("settings_documents.index.folders_tab")}</TabsTrigger>
            <TabsTrigger value="templates">{t("settings_documents.index.templates_tab")}</TabsTrigger>
          </TabsList>

          <TabsContent value="folders">
            <DocumentCardsTab
              slug={DOCUMENT_FOLDERS_SLUG}
              createRequestId={createRequestId}
              isActive={activeTab === "folders"}
              emptyText={t("settings_documents.index.folders_empty")}
              itemTitle={t("settings_documents.index.folder_item")}
              createModalTitle={t("settings_documents.index.folder_create_title")}
              editModalTitle={t("settings_documents.index.folder_edit_title")}
              deleteModalTitle={t("settings_documents.index.folder_delete_title")}
              titleRequiredText={t("settings_documents.index.folder_title_required")}
              descriptionLabel={t("settings_documents.index.description_label")}
              createSuccessText={t("settings_documents.index.folder_created")}
              updateSuccessText={t("settings_documents.index.folder_updated")}
              deleteSuccessText={t("settings_documents.index.folder_deleted")}
              saveErrorText={t("settings_documents.index.folder_save_error")}
              deleteErrorText={t("settings_documents.index.folder_delete_error")}
              showCount
            />
          </TabsContent>

          <TabsContent value="templates">
            <DocumentCardsTab
              slug={DOCUMENT_TEMPLATES_SLUG}
              createRequestId={createRequestId}
              isActive={activeTab === "templates"}
              emptyText={t("settings_documents.index.templates_empty")}
              itemTitle={t("settings_documents.index.template_item")}
              createModalTitle={t("settings_documents.index.template_create_title")}
              editModalTitle={t("settings_documents.index.template_edit_title")}
              deleteModalTitle={t("settings_documents.index.template_delete_title")}
              titleRequiredText={t("settings_documents.index.template_title_required")}
              descriptionLabel={t("settings_documents.index.description_label")}
              createSuccessText={t("settings_documents.index.template_created")}
              updateSuccessText={t("settings_documents.index.template_updated")}
              deleteSuccessText={t("settings_documents.index.template_deleted")}
              saveErrorText={t("settings_documents.index.template_save_error")}
              deleteErrorText={t("settings_documents.index.template_delete_error")}
              includeFileField
              fileRequiredText={t("settings_documents.index.template_file_required")}
              onCardClick={openTemplateDetails}
              onEditItem={openTemplateEditPage}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
