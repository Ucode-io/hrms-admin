import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { Plus, Search, Filter } from "lucide-react";
import PageMeta from "../../../components/common/PageMeta";
import { useTranslation } from "../../../i18n";
import DataTable, { Column } from "../../../components/DataTable";
import { useSuppliersQuery, Supplier } from "../../../api/services/supplier.service";

export default function SuppliersList() {
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

  const { data, isLoading } = useSuppliersQuery(queryParams);

  const suppliers: Supplier[] = data?.response || [];
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

  const columns: Column<Supplier>[] = [
    {
      key: "index",
      header: "№",
      className: "w-12 text-gray-500",
      render: (_, index) => (currentPage - 1) * limit + index + 1,
    },
    {
      key: "company_name",
      header: t("suppliers.company_short"),
      render: (sup) => (
        <span className="font-medium text-gray-800">{sup.company_name || "—"}</span>
      ),
    },
    {
      key: "name",
      header: t("suppliers.contact_name"),
      render: (sup) => sup.name || "—",
    },
    {
      key: "phone",
      header: t("suppliers.phone"),
      render: (sup) => sup.phone || "—",
    },
    {
      key: "created_at",
      header: t("suppliers.created_at"),
      render: (sup) => formatDateTime(sup.created_at),
    },
    {
      key: "updated_at",
      header: t("suppliers.updated_at"),
      render: (sup) => formatDateTime(sup.updated_at),
    },
  ];

  return (
    <>
      <PageMeta title={t("suppliers.list_title")} description={t("suppliers.list_description")} />

      {/* Top Bar */}
      <div className="flex items-center gap-4 mb-6">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M10 12L6 8L10 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {t("suppliers.back")}
        </button>

        <div className="flex-1" />

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
            placeholder={t("suppliers.search")}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#B38D80]/30 focus:border-[#B38D80]"
          />
        </div>

        {/* Filter button */}
        <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer">
          <Filter className="w-4 h-4" />
        </button>

        {/* Add supplier */}
        <button
          onClick={() => navigate("/organization/suppliers/new")}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer"
          style={{ backgroundColor: "#1D2939" }}
          onMouseEnter={(e) =>
            ((e.target as HTMLButtonElement).style.backgroundColor = "#101828")
          }
          onMouseLeave={(e) =>
            ((e.target as HTMLButtonElement).style.backgroundColor = "#1D2939")
          }
        >
          <Plus className="w-4 h-4" />
          {t("suppliers.add")}
        </button>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={suppliers}
        isLoading={isLoading}
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        limit={limit}
        onPageChange={setCurrentPage}
        onRowClick={(sup) => navigate(`/organization/suppliers/${sup.guid}`)}
        getRowKey={(sup) => sup.guid}
        emptyMessage={t("suppliers.empty")}
      />
    </>
  );
}
