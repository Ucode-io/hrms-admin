import { useKATMReportsQuery } from "../../../../api/services/client.service";
import Spinner from "../../../../components/ui/Spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";

interface KATMReportsTabProps {
  clientId: string;
}

export default function KATMReportsTab({ clientId }: KATMReportsTabProps) {
  // Fetch KATM reports
  const { data: reportsData, isLoading } = useKATMReportsQuery({
    data: { limit: 1, clients_id: clientId },
  });

  const reports = reportsData?.response || [];
  const report = reports[0];

  // Parse report data
  const parseReportData = (reportString: string) => {
    try {
      return JSON.parse(reportString);
    } catch {
      return {};
    }
  };

  const reportData = report?.report ? parseReportData(report.report) : {};
  const creditRequests = reportData.credit_requests || [];

  // Format amount
  const formatAmount = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return "-";
    return new Intl.NumberFormat("ru-RU").format(amount);
  };

  // Format date (dd.mm.yyyy)
  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    // If already in dd.mm.yyyy format, return as is
    if (dateString.includes(".")) return dateString;
    // Convert from yyyy-mm-dd
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

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
        <p className="text-gray-500 dark:text-gray-400">Нет отчётов KATM</p>
      </div>
    );
  }

  // Summary stats sections
  const summarySection1 = [
    { label: "Скоринг рейтинг", value: report.scoring_rating },
    { label: "Скоринг версия", value: report.scoring_version },
    { label: "Средний ежемесячный платёж", value: formatAmount(reportData.average_monthly_payment) },
    { label: "Всего задолженность", value: formatAmount(reportData.total_overdue_percent_sum) },
    { label: "Общая сумма просроченной задолженности", value: formatAmount(reportData.max_overdue_principal_sum) },
    { label: "MFI задолженность", value: formatAmount(reportData.overdue_principal_qty) },
  ];

  const summarySection2 = [
    { label: "Условные обязательства (кол-во)", value: reportData.contingent_liabilities_qty },
    { label: "Макс. просрочка основного долга", value: formatAmount(reportData.max_overdue_principal_sum) },
    { label: "Макс. дней просрочки процентов", value: reportData.max_overdue_interest_days },
    { label: "Просрочка по пени (часы)", value: reportData.max_overdue_penalty_hours },
    { label: "Общая сумма просрочки %", value: formatAmount(reportData.total_overdue_percent_sum) },
    { label: "Кол-во кредитных заявок", value: reportData.credit_request_qty },
    { label: "Кол-во претензий", value: reportData.claims_qty },
    { label: "Средний ежемесячный платёж", value: formatAmount(reportData.average_monthly_payment) },
    { label: "Кол-во подписок", value: reportData.subscriptions_qty },
    { label: "Кол-во договоров", value: reportData.contracts_qty },
    { label: "Кол-во просрочек основного долга", value: reportData.overdue_principal_qty },
    { label: "Факт. средний ежемесячный платёж", value: formatAmount(reportData.actual_average_monthly_payment) },
  ];

  const summarySection3 = [
    { label: "Общие расходы", value: formatAmount(reportData.total_expenses) },
    { label: "P2P расходы", value: formatAmount(reportData.total_p2p_expense) },
    { label: "Конверсия расходы", value: formatAmount(reportData.total_conversion_expence) },
    { label: "Депозит доход", value: formatAmount(reportData.total_deposit_income) },
    { label: "Наличные (вход)", value: formatAmount(reportData.total_cash_in) },
    { label: "P2P доход", value: formatAmount(reportData.total_p2p_income) },
    { label: "Наличные", value: formatAmount(reportData.total_cash) },
    { label: "Средний доход", value: formatAmount(reportData.average_income) },
    { label: "Депозит расходы", value: formatAmount(reportData.total_deposit_expence) },
    { label: "Конверсия доход", value: formatAmount(reportData.total_conversion_income) },
  ];

  return (
    <div className="space-y-6">
      {/* Summary sections - 3 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Section 1 */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {summarySection1.map((item, index) => (
              <div key={index} className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-gray-500 dark:text-gray-400">{item.label}</span>
                <span className="text-sm font-medium text-gray-800 dark:text-white/90">{item.value ?? "-"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2 */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {summarySection2.map((item, index) => (
              <div key={index} className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-gray-500 dark:text-gray-400">{item.label}</span>
                <span className="text-sm font-medium text-gray-800 dark:text-white/90">{item.value ?? "-"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3 */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {summarySection3.map((item, index) => (
              <div key={index} className="flex items-center justify-between px-4 py-3">
                <span className="text-xs text-gray-500 dark:text-gray-400">{item.label}</span>
                <span className="text-sm font-medium text-gray-800 dark:text-white/90">{item.value ?? "-"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Credit requests table */}
      {creditRequests.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-base font-semibold text-gray-800 dark:text-white/90">
            Кредитные заявки
          </h4>
          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
            <div className="max-w-full overflow-x-auto">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell isHeader className="px-4 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                      №
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                      Дата отклонения
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 font-medium text-gray-500 text-end text-theme-xs dark:text-gray-400">
                      Сумма
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                      Орг
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                      ID заявки
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                      Срок
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                      Валюта
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                      Название организации
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                      Филиал
                    </TableCell>
                    <TableCell isHeader className="px-4 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">
                      Дата заявки
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {creditRequests.map((request: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell className="px-4 py-3 text-gray-800 text-theme-sm dark:text-white/90">
                        {index + 1}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-gray-800 text-theme-sm dark:text-white/90">
                        {formatDate(request.rejection_date)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-gray-800 text-theme-sm dark:text-white/90 text-end">
                        {formatAmount(request.summa)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-gray-800 text-theme-sm dark:text-white/90">
                        {request.org || "-"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-gray-800 text-theme-sm dark:text-white/90">
                        {request.claim_id || "-"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-gray-800 text-theme-sm dark:text-white/90">
                        {request.credit_duration || "-"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-gray-800 text-theme-sm dark:text-white/90">
                        {request.currency || "-"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-gray-800 text-theme-sm dark:text-white/90 max-w-[200px]">
                        <span className="line-clamp-2">{request.org_name || "-"}</span>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-gray-800 text-theme-sm dark:text-white/90">
                        {request.branch || "-"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-gray-800 text-theme-sm dark:text-white/90">
                        {formatDate(request.claim_date)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
