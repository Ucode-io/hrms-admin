import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router";
import PageMeta from "../../../components/common/PageMeta";
import { useContractsQuery, useDeleteContract } from "../../../api/services/contract.service";
import { useClientsQuery } from "../../../api/services/client.service";
import { useMerchantsQuery } from "../../../api/services/merchant.service";
import Button from "../../../components/ui/button/Button";
import { TrashBinIcon } from "../../../icons";
import { Modal } from "../../../components/ui/modal";
import DataTable, { Column } from "../../../components/DataTable";
import authStore from "../../../store/auth.store";
import encodeJsonToUrlParam from "../../../utils/encodeJsonToUrlParam";
import { Search, X, ChevronDown } from "lucide-react";

// Status options for filter
const STATUS_OPTIONS = [
  { value: "", label: "Все статусы" },
  { value: "new", label: "Новый" },
  { value: "accepted", label: "Принят" },
  { value: "cancelled", label: "Отклонён" },
  { value: "refunded", label: "Возврат" },
];

export default function ContractsList() {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [merchantFilter, setMerchantFilter] = useState("");
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [isMerchantDropdownOpen, setIsMerchantDropdownOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [merchantSearchQuery, setMerchantSearchQuery] = useState("");

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<string | null>(null);

  const deleteMutation = useDeleteContract();

  // Fetch clients and merchants for filters
  const { data: clientsData } = useClientsQuery({ data: { limit: 100 } });
  const { data: merchantsData } = useMerchantsQuery({ params: { limit: 100 } });

  const clients = clientsData?.response || [];
  const merchants = merchantsData?.response || [];

  // Filter clients and merchants based on search
  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) return clients;
    const query = clientSearchQuery.toLowerCase();
    return clients.filter((c: any) =>
      `${c.first_name} ${c.second_name} ${c.phone_number}`.toLowerCase().includes(query)
    );
  }, [clients, clientSearchQuery]);

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
      merchants_id: merchantFilter || authStore.user?.merchants_id,
    };

    if (statusFilter) {
      params.status = statusFilter;
    }

    if (searchQuery.trim()) {
      params.search = searchQuery.trim();
    }

    if (clientFilter) {
      params.clients_id = clientFilter;
    }

    return params;
  }, [currentPage, statusFilter, searchQuery, clientFilter, merchantFilter]);

  const { data, isLoading } = useContractsQuery({
    params: {
      data: encodeJsonToUrlParam(queryParams)
    }
  });

  const contracts = data?.response || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / limit);

  // Check if any filters are active
  const hasActiveFilters = searchQuery || statusFilter || clientFilter || merchantFilter;

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("");
    setClientFilter("");
    setMerchantFilter("");
    setCurrentPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // Reset to first page on search
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setIsStatusDropdownOpen(false);
    setCurrentPage(1);
  };

  const handleClientChange = (value: string) => {
    setClientFilter(value);
    setIsClientDropdownOpen(false);
    setCurrentPage(1);
  };

  const handleMerchantChange = (value: string) => {
    setMerchantFilter(value);
    setIsMerchantDropdownOpen(false);
    setCurrentPage(1);
  };

  const handleDeleteClick = (guid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setContractToDelete(guid);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (contractToDelete) {
      await deleteMutation.mutateAsync(contractToDelete);
      setDeleteModalOpen(false);
      setContractToDelete(null);
    }
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setContractToDelete(null);
  };

  const formatAmount = (amount: number) => {
    if (!amount) return "0";
    return new Intl.NumberFormat("ru-RU").format(amount);
  };

  const getStatusColor = (status: string[]) => {
    const statusValue = status?.[0]?.toLowerCase();
    switch (statusValue) {
      case "new":
        return "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400";
      case "accepted":
        return "bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400";
      case "cancelled":
        return "bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-400";
      case "refunded":
        return "bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400";
    }
  };

  const getStatusLabel = (status: string[]) => {
    const statusValue = status?.[0]?.toLowerCase();
    switch (statusValue) {
      case "new":
        return "Новый";
      case "accepted":
        return "Принят";
      case "cancelled":
        return "Отклонён";
      case "refunded":
        return "Возврат";
      default:
        return statusValue || "-";
    }
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
    },
    {
      key: "code",
      header: "Код",
      render: (contract) => (
        <span className="text-brand-500">{contract.code}</span>
      ),
    },
    {
      key: "client",
      header: "Клиент",
      render: (contract) =>
        contract.clients_id_data
          ? `${contract.clients_id_data.first_name} ${contract.clients_id_data.second_name}`
          : contract?.client_phone_number,
    },
    {
      key: "application_amount",
      header: "Сумма заявки",
      render: (contract) => `${formatAmount(contract.application_amount)} сум`,
    },
    {
      key: "initial_payment_amount",
      header: "Первоначальный платёж",
      render: (contract) => `${formatAmount(contract.initial_payment_amount)} сум`,
    },
    {
      key: "installment_amount",
      header: "Сумма рассрочки",
      render: (contract) => `${formatAmount(contract.installment_amount)} сум`,
    },
    {
      key: "merchant",
      header: "Партнёр",
      render: (contract) => contract.merchants_id_data?.name || "-",
    },
    {
      key: "month_count",
      header: "Срок (мес)",
      render: (contract) => contract.month_count || "-",
    },
    {
      key: "monthly_payment",
      header: "Ежемесячный платёж",
      render: (contract) => `${formatAmount(contract.monthly_payment)} сум`,
    },
    {
      key: "status",
      header: "Статус",
      render: (contract) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(contract.status)}`}
        >
          {getStatusLabel(contract.status)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Действия",
      headerClassName: "text-end",
      className: "text-end",
      render: (contract) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={(e) => handleDeleteClick(contract.guid || contract.id, e)}
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
        title="Контракты | HRMS"
        description="Список контрактов"
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
                  Контракты
                </li>
              </ol>
            </nav>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90">
              Контракты
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
              placeholder="Поиск по клиенту, коду, телефону..."
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <button
              onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <span>
                {STATUS_OPTIONS.find(opt => opt.value === statusFilter)?.label || "Все статусы"}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isStatusDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsStatusDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20">
                  {STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleStatusChange(option.value)}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg ${statusFilter === option.value
                        ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400'
                        : 'text-gray-700 dark:text-gray-300'
                        }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Client Filter */}
          <div className="relative">
            <button
              onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <span>
                {clientFilter
                  ? clients.find((c: any) => c.guid === clientFilter)
                    ? `${clients.find((c: any) => c.guid === clientFilter)?.first_name} ${clients.find((c: any) => c.guid === clientFilter)?.second_name} ${clients.find((c: any) => c.guid === clientFilter)?.phone_number}`
                    : "Клиент"
                  : "Все клиенты"}
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${isClientDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isClientDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => {
                    setIsClientDropdownOpen(false);
                    setClientSearchQuery("");
                  }}
                />
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20">
                  {/* Search Input */}
                  <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={clientSearchQuery}
                        onChange={(e) => setClientSearchQuery(e.target.value)}
                        placeholder="Поиск клиента..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  {/* Options */}
                  <div className="max-h-48 overflow-y-auto">
                    <button
                      onClick={() => {
                        handleClientChange("");
                        setClientSearchQuery("");
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${!clientFilter
                        ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400'
                        : 'text-gray-700 dark:text-gray-300'
                        }`}
                    >
                      Все клиенты
                    </button>
                    {filteredClients.map((client: any) => (
                      <button
                        key={client.guid}
                        onClick={() => {
                          handleClientChange(client.guid);
                          setClientSearchQuery("");
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${clientFilter === client.guid
                          ? 'bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400'
                          : 'text-gray-700 dark:text-gray-300'
                          }`}
                      >
                        {client.first_name} {client.second_name} <span className="text-gray-400">{client.phone_number}</span>
                      </button>
                    ))}
                    {filteredClients.length === 0 && (
                      <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                        Клиенты не найдены
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
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
          data={contracts}
          isLoading={isLoading}
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          limit={limit}
          onPageChange={setCurrentPage}
          onRowClick={(contract) => navigate(`/contracts/${contract.guid}`)}
          getRowKey={(contract) => contract.guid || contract.id}
        />
      </div>

      <Modal isOpen={deleteModalOpen} onClose={closeDeleteModal} className="max-w-[400px] p-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 text-error-500 bg-error-50 dark:bg-error-500/10 p-4 rounded-full">
            <TrashBinIcon className="w-8 h-8" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-gray-800 dark:text-white">
            Удалить контракт?
          </h3>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Вы уверены, что хотите удалить этот контракт? Это действие нельзя будет отменить.
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

