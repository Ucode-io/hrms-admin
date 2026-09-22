import { useINPSReportsQuery } from "../../../../api/services/client.service";
import Spinner from "../../../../components/ui/Spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";
import { useTranslation } from "../../../../i18n";

interface INPSReportsTabProps {
  clientId: string;
}

export default function INPSReportsTab({ clientId }: INPSReportsTabProps) {
  const { t } = useTranslation();
  // Fetch INPS reports
  const { data: reportsData, isLoading } = useINPSReportsQuery({
    data: { limit: 1, clients_id: clientId },
  });

  const reports = reportsData?.response || [];
  const report = reports[0]; // Get first report

  // Parse report data
  const parseReportData = (reportString: string) => {
    try {
      const parsed = JSON.parse(reportString);
      return parsed.months || [];
    } catch {
      return [];
    }
  };

  const months = report?.report ? parseReportData(report.report) : [];

  // Format date for display (day.month.year)
  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // Format date for display in table (dd.mm.yyyy -> year-month)
  const formatMonthDate = (dateString: string) => {
    if (!dateString) return "-";
    const parts = dateString.split(".");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}`;
    }
    return dateString;
  };

  // Format amount
  const formatAmount = (amount: number) => {
    if (!amount) return "0";
    return new Intl.NumberFormat("ru-RU").format(amount);
  };

  // Calculate total amount
  const totalAmount = months.reduce(
    (sum: number, month: any) => sum + (month.amount || 0),
    0
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Spinner />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">Нет отчётов INPS</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary info */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">Период с</span>
            <span className="text-sm font-medium text-gray-800 dark:text-white/90">
              {formatDate(report.period_from)}
            </span>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">Период до</span>
            <span className="text-sm font-medium text-gray-800 dark:text-white/90">
              {formatDate(report.period_to)}
            </span>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">Общая сумма</span>
            <span className="text-sm font-medium text-gray-800 dark:text-white/90">
              {formatAmount(totalAmount)}
            </span>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">Скоринг КИАЦ</span>
            <span className="text-sm font-medium text-gray-800 dark:text-white/90">
              {report.kias ? "Да" : "Нет"}
            </span>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">Информация по кредитам</span>
            <span className="text-sm font-medium text-gray-800 dark:text-white/90">
              {report.credit_info ? "Да" : "Нет"}
            </span>
          </div>
        </div>
      </div>

      {/* Report table */}
      {months.length > 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    №
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Название компании
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    ИНН компании
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Период
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-end text-theme-xs dark:text-gray-400"
                  >
                    Сумма
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-end text-theme-xs dark:text-gray-400"
                  >
                    Сумма INPS
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {months.map((month: any, index: number) => (
                  <TableRow key={index}>
                    <TableCell className="px-5 py-3 text-gray-800 text-theme-sm dark:text-white/90">
                      {index + 1}
                    </TableCell>
                    <TableCell className="px-5 py-3 text-gray-800 text-theme-sm dark:text-white/90">
                      {month.company_name || "-"}
                    </TableCell>
                    <TableCell className="px-5 py-3 text-gray-800 text-theme-sm dark:text-white/90">
                      {month.company_tin || "-"}
                    </TableCell>
                    <TableCell className="px-5 py-3 text-gray-800 text-theme-sm dark:text-white/90">
                      {formatMonthDate(month.date)}
                    </TableCell>
                    <TableCell className="px-5 py-3 text-gray-800 text-theme-sm dark:text-white/90 text-end">
                      {formatAmount(month.amount)}
                    </TableCell>
                    <TableCell className="px-5 py-3 text-gray-800 text-theme-sm dark:text-white/90 text-end">
                      {formatAmount(month.inps_amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">Нет данных отчёта</p>
        </div>
      )}
    </div>
  );
}
