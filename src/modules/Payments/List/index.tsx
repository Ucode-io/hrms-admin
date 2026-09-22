import { useState } from "react";
import { Link } from "react-router";
import PageMeta from "../../../components/common/PageMeta";
import { useTranslation } from "../../../i18n";
import { useClientTransactionsQuery } from "../../../api/services/clientTransaction.service";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";

export default function PaymentsList() {
  const { t } = useTranslation();
  const [filters] = useState({});

  const { data, isLoading } = useClientTransactionsQuery({
    data: filters,
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
        return t("payments.status_payed");
      case "pending":
        return t("payments.status_pending");
      case "failed":
        return t("payments.status_failed");
      case "cancelled":
        return t("payments.status_cancelled");
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
        return t("payments.type_bank");
      default:
        return typeValue || "-";
    }
  };

  return (
    <>
      <PageMeta
        title={t("payments.list_title")}
        description={t("payments.list_description")}
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
                  {t("payments.title")}
                </li>
              </ol>
            </nav>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90">
              {t("payments.title")}
            </h3>
          </div>
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
                    {t("payments.client")}
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    {t("payments.agreement_id")}
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    {t("payments.amount")}
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    {t("payments.payment_type")}
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    {t("payments.comment")}
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    {t("payments.status")}
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
                        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
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
                      colSpan={8}
                      className="px-3 py-2.5 text-center text-gray-500 dark:text-gray-400"
                    >
                      {t("payments.no_data")}
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
                        {payment.clients_id_data ? (
                          <Link
                            to={`/clients/${payment.clients_id_data.guid}`}
                            className="text-brand-500 hover:text-brand-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {`${payment.clients_id_data.first_name} ${payment.clients_id_data.second_name}`}
                          </Link>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                        {payment.contracts_id_data ? (
                          <Link
                            to={`/contracts/${payment.contracts_id_data.guid}`}
                            className="text-brand-500 hover:text-brand-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {payment.contracts_id_data.id}
                          </Link>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                        {formatAmount(payment.amount)} {t("common.currency_sum")}
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
      </div>
    </>
  );
}
