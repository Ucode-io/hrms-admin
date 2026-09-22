import { useClientTransactionsQuery } from "../../../api/services/clientTransaction.service";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { useTranslation } from "../../../i18n";

interface PaymentsTabProps {
  contractId: string;
}

export default function PaymentsTab({ contractId }: PaymentsTabProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useClientTransactionsQuery({
    data: { contracts_id: contractId },
  });

  const payments = data?.response || [];

  const formatAmount = (amount: number) => {
    if (!amount) return "0";
    return new Intl.NumberFormat("ru-RU").format(amount);
  };

  const getStatusColor = (status: string[]) => {
    const statusValue = status?.[0]?.toLowerCase();
    switch (statusValue) {
      case "payed":
        return "bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400";
      case "pending":
        return "bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-400";
      case "failed":
        return "bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-400";
      case "cancelled":
        return "bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400";
    }
  };

  const getStatusLabel = (status: string[]) => {
    const statusValue = status?.[0]?.toLowerCase();
    switch (statusValue) {
      case "payed":
        return t("contracts.payments_tab.status_paid");
      case "pending":
        return t("contracts.payments_tab.status_pending");
      case "failed":
        return t("contracts.payments_tab.status_failed");
      case "cancelled":
        return t("contracts.payments_tab.status_cancelled");
      default:
        return statusValue || "-";
    }
  };

  const getPaymentTypeLabel = (paymentType: string[]) => {
    const typeValue = paymentType?.[0]?.toLowerCase();
    switch (typeValue) {
      case "uzcard":
        return "UzCard";
      case "payme":
        return "Payme";
      case "paynet":
        return "Paynet";
      case "humo":
        return "Humo";
      case "bank":
        return t("contracts.payments_tab.type_bank");
      default:
        return typeValue || "-";
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="max-w-full overflow-x-auto">
        <Table>
          <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
            <TableRow>
              <TableCell
                isHeader
                className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                #
              </TableCell>
              <TableCell
                isHeader
                className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                ID
              </TableCell>
              <TableCell
                isHeader
                className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                {t("contracts.payments_tab.column_client")}
              </TableCell>
              <TableCell
                isHeader
                className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                {t("contracts.payments_tab.column_amount")}
              </TableCell>
              <TableCell
                isHeader
                className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                {t("contracts.payments_tab.column_type")}
              </TableCell>
              <TableCell
                isHeader
                className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                {t("contracts.payments_tab.column_comment")}
              </TableCell>
              <TableCell
                isHeader
                className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                {t("contracts.payments_tab.column_status")}
              </TableCell>
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell className="px-3 py-2.5">
                    <div className="h-4 w-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </TableCell>
                </TableRow>
              ))
            ) : payments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="px-3 py-2.5 text-center text-gray-500 dark:text-gray-400"
                >
                  {t("contracts.payments_tab.empty")}
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment: any, index: number) => (
                <TableRow
                  key={payment.guid}
                  className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                    {index + 1}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                    {payment.id}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                    {payment.clients_id_data
                      ? `${payment.clients_id_data.first_name} ${payment.clients_id_data.second_name}`
                      : "-"}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                    {t("contracts.common.amount_suffix", { amount: formatAmount(payment.amount) })}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                    {getPaymentTypeLabel(payment.payment_type)}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-gray-500 text-theme-sm dark:text-gray-400">
                    {payment.comment || "-"}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}
                    >
                      {getStatusLabel(payment.status)}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
