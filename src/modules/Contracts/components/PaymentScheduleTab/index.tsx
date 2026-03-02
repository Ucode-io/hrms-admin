import { usePaymentScheduleQuery } from "../../../../api/services/contract.service";
import Spinner from "../../../../components/ui/Spinner";
import Badge from "../../../../components/ui/badge/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";

interface PaymentScheduleTabProps {
  contractId: string;
}

export default function PaymentScheduleTab({ contractId }: PaymentScheduleTabProps) {
  const { data: scheduleData, isLoading } = usePaymentScheduleQuery({
    data: { contracts_id: contractId },
  });

  const schedule = scheduleData?.response || [];

  // Sort by month_number ascending
  const sortedSchedule = [...schedule].sort((a: any, b: any) => a.month_number - b.month_number);

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const formatAmount = (amount: number) => {
    if (!amount && amount !== 0) return "-";
    return new Intl.NumberFormat("ru-RU").format(amount) + " сум";
  };

  const getStatusBadge = (status: string[]) => {
    const statusValue = status?.[0]?.toLowerCase();
    switch (statusValue) {
      case "payed":
        return <Badge color="success">Оплачено</Badge>;
      case "scheduled":
        return <Badge color="info">Запланировано</Badge>;
      case "overdue":
        return <Badge color="error">Просрочено</Badge>;
      default:
        return <Badge color="light">{statusValue || "-"}</Badge>;
    }
  };

  // Calculate summary
  const totalAmount = sortedSchedule.reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
  const paidAmount = sortedSchedule
    .filter((item: any) => item.status?.[0] === "payed")
    .reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
  const remainingAmount = totalAmount - paidAmount;
  const paidCount = sortedSchedule.filter((item: any) => item.status?.[0] === "payed").length;
  const overdueCount = sortedSchedule.filter((item: any) => item.status?.[0] === "overdue").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Spinner />
      </div>
    );
  }

  if (sortedSchedule.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">Нет графика платежей</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Общая сумма</p>
          <p className="text-lg font-semibold text-gray-800 dark:text-white/90">{formatAmount(totalAmount)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Оплачено</p>
          <p className="text-lg font-semibold text-success-600 dark:text-success-400">{formatAmount(paidAmount)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Остаток</p>
          <p className="text-lg font-semibold text-gray-800 dark:text-white/90">{formatAmount(remainingAmount)}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Платежи</p>
          <p className="text-lg font-semibold text-gray-800 dark:text-white/90">
            {paidCount}/{sortedSchedule.length}
            {overdueCount > 0 && (
              <span className="text-sm text-error-500 ml-2">({overdueCount} просрочено)</span>
            )}
          </p>
        </div>
      </div>

      {/* Payment schedule table */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  №
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Дата платежа
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-end text-theme-xs dark:text-gray-400"
                >
                  Сумма
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  Дата оплаты
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  Статус
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {sortedSchedule.map((payment: any) => (
                <TableRow key={payment.guid}>
                  <TableCell className="px-5 py-4 text-gray-800 text-theme-sm dark:text-white/90 text-center">
                    {payment.month_number}
                  </TableCell>
                  <TableCell className="px-5 py-4 text-gray-800 text-theme-sm dark:text-white/90">
                    {formatDate(payment.payment_date)}
                  </TableCell>
                  <TableCell className="px-5 py-4 text-gray-800 text-theme-sm dark:text-white/90 text-end font-medium">
                    {formatAmount(payment.amount)}
                  </TableCell>
                  <TableCell className="px-5 py-4 text-gray-800 text-theme-sm dark:text-white/90">
                    {payment.payed_date ? formatDate(payment.payed_date) : "-"}
                  </TableCell>
                  <TableCell className="px-5 py-4 text-center">
                    {getStatusBadge(payment.status)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
