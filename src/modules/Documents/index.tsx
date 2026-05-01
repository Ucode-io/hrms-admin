import PageMeta from "../../components/common/PageMeta";
import companyStore from "../../store/company.store";
import EmployeeDocumentsSection from "../Employees/Detail/components/DocumentsSection";

export default function DocumentsPage() {
  return (
    <>
      <PageMeta title="Документы | HRMS" description="Управление документами сотрудников" />

      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <h1 className="text-2xl font-semibold text-slate-900">Документы</h1>
          <p className="mt-1 text-sm text-slate-500">
            Управляйте файлами и генерируйте документы по шаблонам
          </p>
        </section>

        <EmployeeDocumentsSection brandColor={companyStore.mainColor} />
      </div>
    </>
  );
}

