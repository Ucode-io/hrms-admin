import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { Plus, Search, Filter } from "lucide-react";
import PageMeta from "../../../components/common/PageMeta";
import { useTranslation } from "../../../i18n";
import DataTable, { Column } from "../../../components/DataTable";
import { useAgreementsQuery, Agreement } from "../../../api/services/agreement.service";

export default function AgreementsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const limit = 20;

  const queryParams = useMemo(
    () => ({
      limit,
      offset: (currentPage - 1) * limit,
      ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
    }),
    [currentPage, searchQuery]
  );

  const { data, isLoading } = useAgreementsQuery(queryParams);

  const agreements: Agreement[] = data?.response || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / limit);

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    } catch {
      return dateStr;
    }
  };

  const columns: Column<Agreement>[] = [
    {
      key: "index",
      header: "№",
      className: "w-12 text-gray-500",
      render: (_, index) => (currentPage - 1) * limit + index + 1,
    },
    {
      key: "company_name",
      header: t("agreements.company"),
      render: (agr) => (
        <span className="font-medium text-gray-800">{agr.company_name || "—"}</span>
      ),
    },
    {
      key: "contract_number",
      header: t("agreements.number"),
      render: (agr) => agr.contract_number || "—",
    },
    {
      key: "contract_amount",
      header: t("agreements.amount"),
      render: (agr) => agr.contract_amount ? Number(agr.contract_amount).toLocaleString('ru-RU') : "—",
    },
    {
      key: "file",
      header: t("agreements.file"),
      render: (agr) => agr.file ? (
        <a
          href={agr.file}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {t("agreements.download")}
        </a>
      ) : "—",
    },
    {
      key: "status",
      header: t("agreements.status"),
      render: (agr) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${agr.status ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {agr.status ? t("agreements.active") : t("agreements.inactive")}
        </span>
      ),
    },
    {
      key: "created_at",
      header: t("agreements.created_at"),
      render: (agr) => formatDateTime(agr.created_at),
    },
  ];

  return (
    <>
      <PageMeta title={t("agreements.list_title")} description={t("agreements.list_description")} />

      {/* Top Bar */}
      <div className="mb-6 flex items-center justify-between gap-4">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t("agreements.back")}
        </button>

        <div className="flex flex-1 items-center justify-end gap-3">
          {/* Search */}
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={t("agreements.search")}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#B38D80]/30 focus:border-[#B38D80] transition-colors"
            />
          </div>

          {/* Filter button */}
          <button className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer">
            <Filter className="w-4 h-4" />
          </button>

          {/* Add Agreement */}
          <button
            onClick={() => navigate("/organization/agreements/new")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer"
            style={{ backgroundColor: "#1D2939" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#101828")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#1D2939")}
          >
            <Plus className="w-4 h-4" />
            {t("agreements.add")}
          </button>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={agreements}
        isLoading={isLoading}
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        limit={limit}
        onPageChange={setCurrentPage}
        onRowClick={(agr) => navigate(`/organization/agreements/${agr.guid}`)}
        getRowKey={(agr) => agr.guid}
        emptyMessage={t("agreements.empty")}
      />
    </>
  );
}
