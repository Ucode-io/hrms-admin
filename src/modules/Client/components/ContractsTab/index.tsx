import { useNavigate } from "react-router";
import { useContractsQuery } from "../../../../api/services/contract.service";
import Spinner from "../../../../components/ui/Spinner";
import Button from "../../../../components/ui/button/Button";
import Badge from "../../../../components/ui/badge/Badge";
import { useTranslation } from "../../../../i18n";

interface ContractsTabProps {
  clientId: string;
}

export default function ContractsTab({ clientId }: ContractsTabProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data, isLoading } = useContractsQuery({
    data: { clients_id: clientId },
  });

  const contracts = data?.response || [];

  const formatAmount = (amount: number) => {
    if (!amount) return "0";
    return new Intl.NumberFormat("ru-RU").format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (status: string[]) => {
    const statusValue = status?.[0]?.toLowerCase();
    switch (statusValue) {
      case "new":
        return <Badge size="sm" color="info">Новый</Badge>;
      case "accepted":
        return <Badge size="sm" color="success">Подтверждён</Badge>;
      case "rejected":
        return <Badge size="sm" color="error">Отмена</Badge>;
      case "refunded":
        return <Badge size="sm" color="warning">Возврат</Badge>;
      default:
        return <Badge size="sm" color="light">{statusValue || "-"}</Badge>;
    }
  };

  // Calculate total installment amount
  const totalInstallment = contracts.reduce(
    (sum: number, contract: any) => sum + (contract.installment_amount || 0),
    0
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Total sales header */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Сумма продажи</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-white/90">
              {formatAmount(totalInstallment)} <span className="text-base font-medium text-gray-500">сум</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 dark:text-gray-400">Всего договоров</p>
            <p className="text-2xl font-bold text-brand-500">{contracts.length}</p>
          </div>
        </div>
      </div>

      {/* Contracts grid */}
      {contracts.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">Нет договоров</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contracts.map((contract: any) => (
            <div
              key={contract.guid || contract.id}
              className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden hover:border-brand-200 dark:hover:border-brand-800 transition-colors"
            >
              {/* Card Header */}
              <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                  № {contract.id || contract.id}
                </span>
                {getStatusBadge(contract.status)}
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Сумма заявки
                  </span>
                  <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                    {formatAmount(contract.application_amount)} сум
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Сумма рассрочки
                  </span>
                  <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                    {formatAmount(contract.installment_amount)} сум
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Дата договора
                  </span>
                  <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                    {formatDate(contract.created_at)}
                  </span>
                </div>

                <div className="flex justify-between items-start">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Партнёр
                  </span>
                  <span className="text-sm font-medium text-gray-800 dark:text-white/90 text-right max-w-[60%]">
                    {contract.merchants_id_data?.name || "-"}
                  </span>
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-4 pb-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center"
                  onClick={() => navigate(`/contracts/${contract.guid}`)}
                >
                  Посмотреть
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
