import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import PageMeta from "../../../components/common/PageMeta";
import { useClientsQuery, useDeleteClient } from "../../../api/services/client.service";
import { useMerchantsQuery } from "../../../api/services/merchant.service";
import Button from "../../../components/ui/button/Button";
import { PlusIcon, TrashBinIcon } from "../../../icons";
import { Modal } from "../../../components/ui/modal";
import DataTable, { Column } from "../../../components/DataTable";
import { Search, X, ChevronDown } from "lucide-react";
import { useTranslation } from "../../../i18n";

export default function ClientsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [merchantFilter, setMerchantFilter] = useState("");
  const [isMerchantDropdownOpen, setIsMerchantDropdownOpen] = useState(false);
  const [merchantSearchQuery, setMerchantSearchQuery] = useState("");

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);

  const deleteMutation = useDeleteClient();

  // Fetch merchants for filter
  const { data: merchantsData } = useMerchantsQuery({ params: { limit: 100 } });
  const merchants = merchantsData?.response || [];

  // Filter merchants based on search
  const filteredMerchants = useMemo(() => {
    if (!merchantSearchQuery.trim()) return merchants;
    const query = merchantSearchQuery.toLowerCase();
    return merchants.filter((m: any) =>
      m.name?.toLowerCase().includes(query)
    );
  }, [merchants, merchantSearchQuery]);

  // Build query params with filters
  const queryParams = useMemo(() => {
    const params: Record<string, unknown> = {
      limit,
      offset: (currentPage - 1) * limit,
    };

    if (searchQuery.trim()) {
      params.search = searchQuery.trim();
    }

    if (merchantFilter) {
      params.merchants_id = merchantFilter;
    }

    return params;
  }, [currentPage, searchQuery, merchantFilter]);

  const { data, isLoading } = useClientsQuery({
    data: queryParams,
  });

  const clients = data?.response || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / limit);

  // Check if any filters are active
  const hasActiveFilters = searchQuery || merchantFilter;

  const clearFilters = () => {
    setSearchQuery("");
    setMerchantFilter("");
    setCurrentPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleMerchantChange = (value: string) => {
    setMerchantFilter(value);
    setIsMerchantDropdownOpen(false);
    setCurrentPage(1);
  };

  const handleDeleteClick = (guid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setClientToDelete(guid);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (clientToDelete) {
      await deleteMutation.mutateAsync(clientToDelete);
      setDeleteModalOpen(false);
      setClientToDelete(null);
    }
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setClientToDelete(null);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const columns: Column<any>[] = [
    {
      key: "index",
      header: "#",
      render: (_, index) => index + 1,
    },
    {
      key: "id",
      header: "ID",
      render: (client) => (
        <span className="text-brand-500">{client.id}</span>
      ),
    },
    {
      key: "first_name",
      header: "Имя",
    },
    {
      key: "second_name",
      header: "Фамилия",
    },
    {
      key: "middle_name",
      header: "Отчество",
    },
    {
      key: "pinfl",
      header: "ПИНФЛ",
    },
    {
      key: "phone",
      header: "Номер телефона",
    },
    {
      key: "passport",
      header: "Паспорт",
      render: (client) => `${client.passport_series || ""} ${client.passport_number || ""}`.trim() || "-",
    },
    {
      key: "birthdate",
      header: "Дата рождения",
      render: (client) => formatDate(client.birthdate),
    },
    {
      key: "merchant",
      header: "Партнер",
      render: (client) => client.merchants_id_data?.name || "-",
    },
    {
      key: "actions",
      header: "Действия",
      headerClassName: "text-end",
      className: "text-end",
      render: (client) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={(e) => handleDeleteClick(client.guid || client.id, e)}
            className="text-gray-500 hover:text-error-500 dark:text-gray-400 dark:hover:text-error-500"
          >
            <TrashBinIcon className="w-5 h-5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta
        title="Клиенты | HRMS"
        description="Список клиентов"
      />
      <div className="space-y-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex flex-col gap-2">
            <nav>
              <ol className="flex items-center gap-1.5">
                <li>
                  <Link
                    className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
                    to="/"
                  >
                    Home
                    <svg
                      className="stroke-current"
                      width="17"
                      height="16"
                      viewBox="0 0 17 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M6.0765 12.667L10.2432 8.50033L6.0765 4.33366"
                        stroke=""
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </Link>
                </li>
                <li className="text-sm text-gray-800 dark:text-white/90">
                  Клиенты
                </li>
              </ol>
            </nav>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90">
              Клиенты
            </h3>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Поиск по имени, телефону, ПИНФЛ..."
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          {/* Merchant Filter */}
          <div className="relative">
            <button
              onClick={() => setIsMerchantDropdownOpen(!isMerchantDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <span>
                {merchantFilter
                  ? merchants.find((m: any) => m.guid === merchantFilter)?.name || "Партнёр"
                  : "Все партнёры"}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${isMerchantDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isMerchantDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => {
                    setIsMerchantDropdownOpen(false);
                    setMerchantSearchQuery("");
                  }}
                />
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20">
                  {/* Search Input */}
                  <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={merchantSearchQuery}
                        onChange={(e) => setMerchantSearchQuery(e.target.value)}
                        placeholder="Поиск партнёра..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  {/* Options */}
                  <div className="max-h-48 overflow-y-auto">
                    <button
                      onClick={() => {
                        handleMerchantChange("");
                        setMerchantSearchQuery("");
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${!merchantFilter
                        ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400'
                        : 'text-gray-700 dark:text-gray-300'
                        }`}
                    >
                      Все партнёры
                    </button>
                    {filteredMerchants.map((merchant: any) => (
                      <button
                        key={merchant.guid}
                        onClick={() => {
                          handleMerchantChange(merchant.guid);
                          setMerchantSearchQuery("");
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${merchantFilter === merchant.guid
                          ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400'
                          : 'text-gray-700 dark:text-gray-300'
                          }`}
                      >
                        {merchant.name}
                      </button>
                    ))}
                    {filteredMerchants.length === 0 && (
                      <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                        Партнёры не найдены
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
              <span>Сбросить</span>
            </button>
          )}
        </div>

        <DataTable
          columns={columns}
          data={clients}
          isLoading={isLoading}
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          limit={limit}
          onPageChange={setCurrentPage}
          onRowClick={(client) => navigate(`/clients/${client.guid}`)}
          getRowKey={(client) => client.guid || client.id}
        />
      </div>

      <Modal isOpen={deleteModalOpen} onClose={closeDeleteModal} className="max-w-[400px] p-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 text-error-500 bg-error-50 dark:bg-error-500/10 p-4 rounded-full">
            <TrashBinIcon className="w-8 h-8" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-gray-800 dark:text-white">
            Удалить клиента?
          </h3>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Вы уверены, что хотите удалить этого клиента? Это действие нельзя будет отменить.
          </p>
          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              onClick={closeDeleteModal}
              className="w-full justify-center"
            >
              Отмена
            </Button>
            <Button
              variant="primary"
              className="w-full justify-center bg-error-600 hover:bg-error-700 border-error-600"
              onClick={confirmDelete}
            >
              Удалить
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

