import { Link, useParams } from "react-router";
import { ArrowLeft, Printer } from "lucide-react";
import PageMeta from "../../../components/common/PageMeta";
import { useBillingInvoice } from "../../../api/services/billing.service";
import { formatDate, formatUsd, formatRate, formatUzs, uzsInWords } from "./format";

// ponytail: печатная форма только на русском — это платёжный документ для банка,
// а не экран интерфейса. Вёрстку оператора (hrms-billing-ops/InvoicePrintPage)
// перенести не из чего: репозитория нет под рукой; сверить при первом доступе.

const REQUISITE_LABELS: Record<string, string> = {
  company_name: "Поставщик",
  address: "Адрес",
  inn: "ИНН",
  oked: "ОКЭД",
  mfo: "МФО",
  bank_name: "Банк",
  account: "Расчётный счёт",
  phone: "Телефон",
  director: "Руководитель",
  accountant: "Главный бухгалтер",
};

/** Отдельный маршрут без AppLayout, открывается в новой вкладке. */
const InvoicePrintPage: React.FC = () => {
  const { invoiceId = "" } = useParams();
  const { data, isLoading, error } = useBillingInvoice(invoiceId);
  const invoice = data?.invoice;

  if (isLoading) {
    return <p className="p-10 text-center text-sm text-gray-500">Загрузка счёта…</p>;
  }

  if (!invoice) {
    // «Счёт не найден» и прочие ошибки сервер присылает готовым текстом.
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <p className="text-base font-medium text-gray-900">
          {error instanceof Error ? error.message : "Счёт не найден"}
        </p>
        <Link
          to="/settings/billing"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:underline"
        >
          <ArrowLeft size={16} aria-hidden /> К биллингу
        </Link>
      </div>
    );
  }

  // Снимок на дату выпуска: печатается он, даже если реквизиты с тех пор поменялись.
  const requisites = Object.entries(invoice.snapshot?.requisites ?? {}).filter(([, value]) => value);
  const tenant = invoice.snapshot?.tenant?.name ?? "";

  return (
    <div className="min-h-screen bg-gray-100 py-8 print:bg-white print:py-0">
      <PageMeta title={`Счёт ${invoice.number}`} description={`Счёт ${invoice.number}`} />

      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end px-4 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white shadow-theme-xs transition-colors hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          <Printer size={16} aria-hidden /> Печать / сохранить PDF
        </button>
      </div>

      <article className="mx-auto max-w-[210mm] bg-white px-[15mm] py-[15mm] text-[13px] leading-relaxed text-gray-900 shadow-sm print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b-2 border-gray-900 pb-4">
          <div>
            <h1 className="text-xl font-bold">
              Счёт на оплату № {invoice.number}
            </h1>
            <p className="mt-1">от {formatDate(invoice.issued_on)}</p>
          </div>
          {invoice.status !== "open" && (
            <span className="rounded border-2 border-gray-900 px-3 py-1 text-sm font-bold uppercase">
              {invoice.status === "paid" ? "Оплачен" : "Аннулирован"}
            </span>
          )}
        </header>

        <section className="mt-5 grid grid-cols-[140px_1fr] gap-x-4 gap-y-1">
          {requisites.map(([key, value]) => (
            <Field key={key} label={REQUISITE_LABELS[key] ?? key} value={value} />
          ))}
          <Field label="Покупатель" value={tenant} strong />
          <Field
            label="Период"
            value={`${formatDate(invoice.period_start)} – ${formatDate(invoice.period_end)} (${invoice.period_days} дн.)`}
          />
          <Field label="Оплатить до" value={formatDate(invoice.due_date)} />
        </section>

        <table className="mt-6 w-full border-collapse">
          <thead>
            <tr className="border-y-2 border-gray-900 text-left">
              <th className="py-2 pr-2 font-semibold">№</th>
              <th className="py-2 pr-2 font-semibold">Наименование</th>
              <th className="py-2 pr-2 text-right font-semibold">Кол-во</th>
              <th className="py-2 pr-2 text-right font-semibold">Цена, $</th>
              <th className="py-2 text-right font-semibold">Сумма, $</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, index) => (
              <tr key={`${line.code}-${index}`} className="border-b border-gray-300">
                <td className="py-2 pr-2 tabular-nums">{index + 1}</td>
                <td className="py-2 pr-2">{line.label}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{line.qty}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{line.unit_usd.toFixed(2)}</td>
                <td className="py-2 text-right tabular-nums">{line.amount_usd.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto mt-4 w-full max-w-[90mm] space-y-1">
          <Total label="Итого" value={formatUsd(invoice.amount_usd)} />
          <Total
            label={`Курс ЦБ на ${formatDate(invoice.fx_date)}`}
            value={`${formatRate(invoice.fx_rate)} сум за $1`}
          />
          <Total label="К оплате" value={formatUzs(invoice.amount_uzs)} strong />
        </dl>

        <p className="mt-6 border-t border-gray-300 pt-3">
          Сумма прописью: <span className="font-semibold">{uzsInWords(invoice.amount_uzs)}</span>
        </p>
        <p className="mt-2 text-xs text-gray-600">
          Оплата в сумах по курсу, зафиксированному на дату выпуска счёта. В назначении платежа укажите
          номер счёта {invoice.number}.
        </p>
      </article>
    </div>
  );
};

const Field: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <>
    <span className="text-gray-600">{label}</span>
    <span className={strong ? "font-semibold" : ""}>{value}</span>
  </>
);

const Total: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <div className={`flex justify-between gap-4 ${strong ? "border-t-2 border-gray-900 pt-1 text-base font-bold" : ""}`}>
    <dt>{label}</dt>
    <dd className="tabular-nums">{value}</dd>
  </div>
);

export default InvoicePrintPage;
