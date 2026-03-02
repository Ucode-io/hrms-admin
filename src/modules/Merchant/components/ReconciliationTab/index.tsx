import { useState } from "react";
import { useMerchantTransactionsQuery } from "../../../../api/services/merchantTransaction.service";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";
import Pagination from "../../../../components/pagination";
import { Link } from "react-router";

interface ReconciliationTabProps {
  merchantId: string;
}

export default function ReconciliationTab({ merchantId }: ReconciliationTabProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;

  const { data, isLoading } = useMerchantTransactionsQuery({
    params: { merchants_id: merchantId, limit, offset: (currentPage - 1) * limit },
  });

  const transactions = data?.response || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / limit);

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
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const getTypeColor = (type: string[]) => {
    const typeValue = type?.[0]?.toLowerCase();
    switch (typeValue) {
      case "debit":
        return "bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400";
      case "refund":
        return "bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400";
    }
  };

  const getTypeLabel = (type: string[]) => {
    const typeValue = type?.[0]?.toLowerCase();
    switch (typeValue) {
      case "debit":
        return "Дебет";
      case "refund":
        return "Возврат";
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
                Тип
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
                Сумма транзакции
              </TableCell>
              <TableCell
                isHeader
                className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Комментарии
              </TableCell>
              <TableCell
                isHeader
                className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Дата создания
              </TableCell>
              <TableCell
                isHeader
                className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                Дата обновления
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
                    <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </TableCell>
                </TableRow>
              ))
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="px-3 py-2.5 text-center text-gray-500 dark:text-gray-400"
                >
                  Нет данных
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((transaction: any, index: number) => (
                <TableRow
                  key={transaction.guid || transaction.id}
                  className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                    {(currentPage - 1) * limit + index + 1}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                    {transaction.id}
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(transaction.type)}`}
                    >
                      {getTypeLabel(transaction.type)}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                    {transaction.contracts_id_data ? (
                      <Link
                        to={`/contracts/${transaction.contracts_id_data.guid}`}
                        className="text-brand-500 hover:text-brand-600 hover:underline"
                      >
                        {transaction.contracts_id_data.id}
                      </Link>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                    {formatAmount(transaction.amount)}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-gray-500 text-theme-sm dark:text-gray-400">
                    {transaction.comment || "-"}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                    {formatDate(transaction.created_at)}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                    {formatDate(transaction.updated_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        limit={limit}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
