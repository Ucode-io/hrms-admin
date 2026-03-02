import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { Plus, Search, Filter } from "lucide-react";
import PageMeta from "../../../components/common/PageMeta";
import DataTable, { Column } from "../../../components/DataTable";
import { useServerClientsQuery, ServerClient } from "../../../api/services/client.service";

export default function ClientsList() {
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

  const { data, isLoading } = useServerClientsQuery(queryParams);

  const clients: ServerClient[] = data?.response || [];
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

  const columns: Column<ServerClient>[] = [
    {
      key: "index",
      header: "№",
      className: "w-12 text-gray-500",
      render: (_, index) => (currentPage - 1) * limit + index + 1,
    },
    {
      key: "company_name",
      header: "Компания",
      render: (cli) => (
        <span className="font-medium text-gray-800">{cli.company_name || "—"}</span>
      ),
    },
    {
      key: "name",
      header: "Имя (Контактное лицо)",
      render: (cli) => cli.name || "—",
    },
    {
      key: "phone",
      header: "Номер телефона",
      render: (cli) => cli.phone || "—",
    },
    {
      key: "manager",
      header: "Менеджер",
      render: (cli) => cli.manager || "—",
    },
    {
      key: "current_account",
      header: "Текущий счет",
      render: (cli) => cli.current_account != null ? cli.current_account.toLocaleString('ru-RU') : "—",
    },
    {
      key: "created_at",
      header: "Дата создания",
      render: (cli) => formatDateTime(cli.created_at),
    },
  ];

  return (
    <>
      <PageMeta title="Клиенты | NSTEX" description="Список клиентов" />

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
          Назад
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
              placeholder="Поиск"
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#B38D80]/30 focus:border-[#B38D80] transition-colors"
            />
          </div>

          {/* Filter button */}
          <button className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer">
            <Filter className="w-4 h-4" />
          </button>

          {/* Add client */}
          <button
            onClick={() => navigate("/organization/clients/new")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer"
            style={{ backgroundColor: "#1D2939" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#101828")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.backgroundColor = "#1D2939")}
          >
            <Plus className="w-4 h-4" />
            Добавить клиента
          </button>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={clients}
        isLoading={isLoading}
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        limit={limit}
        onPageChange={setCurrentPage}
        onRowClick={(cli) => navigate(`/organization/clients/${cli.guid}`)}
        getRowKey={(cli) => cli.guid}
        emptyMessage="Клиенты не найдены"
      />
    </>
  );
}
