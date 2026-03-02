import { useState } from "react";
import { Link, useNavigate } from "react-router";
import PageMeta from "../../../components/common/PageMeta";
import { useMerchantTransactionsQuery } from "../../../api/services/merchantTransaction.service";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import Button from "../../../components/ui/button/Button";
import { Edit2 } from "lucide-react";

export default function MerchantTransactionsList() {
  const navigate = useNavigate();
  const [filters] = useState({});

  const { data, isLoading } = useMerchantTransactionsQuery({
    params: filters,
  });

  const transactions = data?.response || [];

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
    <>
      <PageMeta
        title="Акт сверки | HRMS"
        description="Акт сверки транзакций"
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
                  Акт сверки
                </li>
              </ol>
            </nav>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90">
              Акт сверки
            </h3>
          </div>
          <Button onClick={() => navigate("/finance/merchant-reconciliation/new")}>
            + Добавить платёж
          </Button>
        </div>

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
                    Мерчант
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
                  <TableCell
                    isHeader
                    className="px-3 py-2 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                  >
                    Действия
                  </TableCell>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell className="px-3 py-2.5">
                        <div className="h-4 w-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
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
                      colSpan={10}
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
                        {index + 1}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                        {transaction.id}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                        {transaction.merchants_id_data ? (
                          <Link
                            to={`/merchants/${transaction.merchants_id_data.guid}`}
                            className="text-brand-500 hover:text-brand-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {transaction.merchants_id_data.name}
                          </Link>
                        ) : "-"}
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
                            onClick={(e) => e.stopPropagation()}
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
                      <TableCell className="px-3 py-2.5">
                        {transaction.type?.[0]?.toLowerCase() === "payment" && (
                          <button
                            onClick={() => navigate(`/finance/merchant-reconciliation/${transaction.guid}/edit`)}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            title="Редактировать"
                          >
                            <Edit2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  );
}
