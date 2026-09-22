import PageMeta from "../../components/common/PageMeta";
import companyStore from "../../store/company.store";
import { useTranslation } from "../../i18n";
import EmployeeDocumentsSection from "../Employees/Detail/components/DocumentsSection";

export default function DocumentsPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageMeta title={t("documents.page_title")} description={t("documents.page_description")} />

      <div>
        <EmployeeDocumentsSection brandColor={companyStore.mainColor} />
      </div>
    </>
  );
}
