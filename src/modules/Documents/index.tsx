import PageMeta from "../../components/common/PageMeta";
import companyStore from "../../store/company.store";
import EmployeeDocumentsSection from "../Employees/Detail/components/DocumentsSection";

export default function DocumentsPage() {
  return (
    <>
      <PageMeta title="Документы | HRMS" description="Управление документами сотрудников" />

      <div>
        <EmployeeDocumentsSection brandColor={companyStore.mainColor} />
      </div>
    </>
  );
}
