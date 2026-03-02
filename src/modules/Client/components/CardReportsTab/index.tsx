import { useState, useEffect } from "react";
import { useClientCardsQuery, useCardReportsQuery } from "../../../../api/services/client.service";
import Spinner from "../../../../components/ui/Spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";
import { CheckCircleIcon, CloseIcon } from "../../../../icons";

interface CardReportsTabProps {
  clientId: string;
}

interface LegacyMonthItem {
  date: string;
  entrance: boolean;
}

interface ReportTransactionItem {
  udate?: number;
  utime?: number;
  merchantName?: string;
  city?: string;
  actamt?: number;
  credit?: boolean;
  transType?: string;
  terminal?: string;
  utrnno?: number;
}

interface ParsedReport {
  months: LegacyMonthItem[];
  transactions: ReportTransactionItem[];
  processing: string;
}

export default function CardReportsTab({ clientId }: CardReportsTabProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Fetch client cards
  const { data: cardsData, isLoading: isLoadingCards } = useClientCardsQuery({
    data: { clients_id: clientId },
    querySettings: {},
  });

  const cards = cardsData?.response || [];

  // Auto-select first card when cards load
  useEffect(() => {
    if (cards.length > 0 && !selectedCardId) {
      setSelectedCardId(cards[0].guid);
    }
  }, [cards, selectedCardId]);

  // Fetch card reports for selected card
  const { data: reportsData, isLoading: isLoadingReports } = useCardReportsQuery({
    data: { limit: 1, clients_cards_id: selectedCardId },
  });

  const reports = reportsData?.response || [];
  const report = reports[0]; // Get first report

  // Parse report data (supports both old and new formats)
  const parseReportData = (reportValue: unknown): ParsedReport => {
    try {
      const parsed =
        typeof reportValue === "string"
          ? JSON.parse(reportValue)
          : (reportValue ?? {});

      const months = Array.isArray(parsed?.months) ? parsed.months : [];
      const transactions = Array.isArray(parsed?.data) ? parsed.data : [];
      const processing =
        typeof parsed?.processing === "string" ? parsed.processing : "-";

      return { months, transactions, processing };
    } catch {
      return { months: [], transactions: [], processing: "-" };
    }
  };

  const parsedReport = report?.report
    ? parseReportData(report.report)
    : { months: [], transactions: [], processing: "-" };
  const months = parsedReport.months;
  const transactions = parsedReport.transactions;
  const hasTransactions = transactions.length > 0;

  // Format card number for display
  const formatCardNumber = (cardNumber: string) => {
    if (!cardNumber) return "****";
    const cleaned = cardNumber.replace(/\s/g, "");
    if (cleaned.length >= 16) {
      return `${cleaned.substring(0, 4)} ${cleaned.substring(4, 8)} ${cleaned.substring(8, 12)} ${cleaned.substring(12, 16)}`;
    }
    return cardNumber;
  };

  // Format date for display (day.month.year)
  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // Format date for display in table (dd.mm.yyyy -> month.year)
  const formatMonthDate = (dateString: string) => {
    if (!dateString) return "-";
    const parts = dateString.split(".");
    if (parts.length === 3) {
      return `${parts[1]}.${parts[2]}`;
    }
    return dateString;
  };

  const formatAmount = (amount?: number) => {
    if (typeof amount !== "number") return "-";
    return `${new Intl.NumberFormat("ru-RU").format(amount)} сум`;
  };

  const formatTransactionDate = (udate?: number) => {
    if (!udate) return "-";
    const value = String(udate);
    if (value.length !== 8) return value;

    const year = value.slice(0, 4);
    const month = value.slice(4, 6);
    const day = value.slice(6, 8);
    return `${day}.${month}.${year}`;
  };

  const formatTransactionTime = (utime?: number) => {
    if (!utime && utime !== 0) return "-";
    const value = String(utime).padStart(6, "0");
    const hours = value.slice(0, 2);
    const minutes = value.slice(2, 4);
    const seconds = value.slice(4, 6);
    return `${hours}:${minutes}:${seconds}`;
  };

  if (isLoadingCards) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Spinner />
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">У клиента нет карт</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
        Отчёты по картам
      </h3>

      {/* Card selector */}
      <div className="flex flex-wrap gap-3">
        {cards.map((card: any) => (
          <button
            key={card.guid}
            onClick={() => setSelectedCardId(card.guid)}
            className={`px-4 py-3 rounded-xl border transition-all text-left ${selectedCardId === card.guid
              ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
              : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-white/[0.03] dark:hover:border-gray-600"
              }`}
          >
            <p className={`text-sm font-medium ${selectedCardId === card.guid
              ? "text-brand-600 dark:text-brand-400"
              : "text-gray-800 dark:text-white/90"
              }`}>
              {formatCardNumber(card.card_number)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {card.expired_month}/{card.expired_year}
            </p>
          </button>
        ))}
      </div>

      {/* Report content */}
      {isLoadingReports ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Spinner />
        </div>
      ) : report ? (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
          {/* Report header info */}
          <div className="p-5 border-b border-gray-100 dark:border-gray-800 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Номер карты:</span>
              <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                {report.clients_cards_id_data?.card_number || "-"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Период с:</span>
              <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                {formatDate(report.period_from)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Период до:</span>
              <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                {formatDate(report.period_to)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Процессинг:</span>
              <span className="text-sm font-medium uppercase text-gray-800 dark:text-white/90">
                {parsedReport.processing}
              </span>
            </div>
          </div>

          {/* Report table */}
          {hasTransactions ? (
            <div className="max-w-full overflow-x-auto">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell
                      isHeader
                      className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                    >
                      Дата
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                    >
                      Время
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                    >
                      Мерчант
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                    >
                      Город
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-5 py-3 font-medium text-gray-500 text-end text-theme-xs dark:text-gray-400"
                    >
                      Сумма
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                    >
                      Тип
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {transactions.map((transaction, index) => (
                    <TableRow key={`${transaction.utrnno || index}-${transaction.udate || ""}`}>
                      <TableCell className="px-5 py-3 text-gray-800 text-theme-sm dark:text-white/90 whitespace-nowrap">
                        {formatTransactionDate(transaction.udate)}
                      </TableCell>
                      <TableCell className="px-5 py-3 text-gray-800 text-theme-sm dark:text-white/90 whitespace-nowrap">
                        {formatTransactionTime(transaction.utime)}
                      </TableCell>
                      <TableCell className="px-5 py-3 text-gray-800 text-theme-sm dark:text-white/90 min-w-[220px]">
                        {transaction.merchantName || "-"}
                      </TableCell>
                      <TableCell className="px-5 py-3 text-gray-800 text-theme-sm dark:text-white/90">
                        {transaction.city || "-"}
                      </TableCell>
                      <TableCell className="px-5 py-3 text-gray-800 text-theme-sm dark:text-white/90 text-end whitespace-nowrap">
                        {formatAmount(transaction.actamt)}
                      </TableCell>
                      <TableCell className="px-5 py-3 text-center">
                        {transaction.credit ? (
                          <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-400">
                            Поступление
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-400">
                            Списание
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : months.length > 0 ? (
            <div className="max-w-full overflow-x-auto">
              <Table>
                <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                  <TableRow>
                    <TableCell
                      isHeader
                      className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                    >
                      Месяц
                    </TableCell>
                    <TableCell
                      isHeader
                      className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                    >
                      Поступление
                    </TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {months.map((month: { date: string; entrance: boolean }, index: number) => (
                    <TableRow key={index}>
                      <TableCell className="px-5 py-3 text-gray-800 text-theme-sm dark:text-white/90">
                        {formatMonthDate(month.date)}
                      </TableCell>
                      <TableCell className="px-5 py-3 text-center">
                        {month.entrance ? (
                          <CheckCircleIcon className="w-5 h-5 text-success-500 mx-auto" />
                        ) : (
                          <CloseIcon className="w-5 h-5 text-error-500 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">Нет данных отчёта</p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">Нет отчётов для выбранной карты</p>
        </div>
      )}
    </div>
  );
}
