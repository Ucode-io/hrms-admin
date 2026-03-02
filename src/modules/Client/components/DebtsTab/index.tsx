import { Link } from "react-router";
import { useDebtsQuery } from "../../../../api/services/debt.service";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";

interface DebtsTabProps {
  clientId: string;
}

export default function DebtsTab({ clientId }: DebtsTabProps) {
  const { data, isLoading } = useDebtsQuery({
    params: { clients_id: clientId },
  });

  const debts = data?.response || [];

  const formatAmount = (amount: number) => {
    if (!amount) return "0";
    return new Intl.NumberFormat("ru-RU").format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("ru-RU", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  };

  const getStatusColor = (status: string[]) => {
    const statusValue = status?.[0]?.toLowerCase();
    switch (statusValue) {
      case "new":
        return "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400";
      case "sent_to_court":
        return "bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-400";
      case "paid":
        return "bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400";
    }
  };

  const getStatusLabel = (status: string[]) => {
    const statusValue = status?.[0]?.toLowerCase();
    switch (statusValue) {
      case "new":
        return "Новый";
      case "sent_to_court":
        return "Отправлено в суд";
      case "paid":
        return "Оплачено";
      default:
        return statusValue || "-";
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
                ID договора
              </TableCell>
              <TableCell
                isHeader
                className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Сумма долга
              </TableCell>
              <TableCell
                isHeader
                className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Оплачено
              </TableCell>
              <TableCell
                isHeader
                className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Дата платежа
              </TableCell>
              <TableCell
                isHeader
                className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Статус
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
                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </TableCell>
                </TableRow>
              ))
            ) : debts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="px-3 py-2.5 text-center text-gray-500 dark:text-gray-400"
                >
                  Нет задолженностей
                </TableCell>
              </TableRow>
            ) : (
              debts.map((debt: any, index: number) => (
                <TableRow
                  key={debt.guid}
                  className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                    {index + 1}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                    {debt.contracts_id_data ? (
                      <Link
                        to={`/contracts/${debt.contracts_id_data.guid}`}
                        className="text-brand-500 hover:text-brand-600 hover:underline"
                      >
                        {debt.contracts_id_data.id}
                      </Link>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                    {formatAmount(debt.debt_amount)} сум
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                    {formatAmount(debt.payed_amount)} сум
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                    {formatDate(debt.payment_date)}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(debt.status)}`}
                    >
                      {getStatusLabel(debt.status)}
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
