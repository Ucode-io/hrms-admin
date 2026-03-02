import { useParams, Link } from "react-router";
import PageMeta from "../../../components/common/PageMeta";
import { useContractsQuery } from "../../../api/services/contract.service";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/ui/tabs";
import Spinner from "../../../components/ui/Spinner";
import Badge from "../../../components/ui/badge/Badge";
import PaymentScheduleTab from "../components/PaymentScheduleTab";
import ProductsTab from "../components/ProductsTab";
import DocumentsTab from "../components/DocumentsTab";
import PaymentsTab from "../components/PaymentsTab";
import ContactsTab from "../components/ContactsTab";
import encodeJsonToUrlParam from "../../../utils/encodeJsonToUrlParam";

export default function ContractDetail() {
  const { id } = useParams();

  const { data, isLoading } = useContractsQuery({
    params: {
      data: encodeJsonToUrlParam({ limit: 1, guid: id || "" })
    },
  });

  const contract = data?.response?.[0];

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
      case "new":
        return <Badge color="info">Новый</Badge>;
      case "accepted":
        return <Badge color="success">Подтверждённый</Badge>;
      case "rejected":
        return <Badge color="error">Отмена</Badge>;
      case "refunded":
        return <Badge color="warning">Возврат</Badge>;
      default:
        return <Badge color="light">{statusValue || "-"}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <>
        <PageMeta title="Договор | HRMS" description="Детальная информация о договоре" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Spinner />
        </div>
      </>
    );
  }

  if (!contract) {
    return (
      <>
        <PageMeta title="Договор | HRMS" description="Детальная информация о договоре" />
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-gray-500 dark:text-gray-400">Договор не найден</p>
        </div>
      </>
    );
  }

  const client = contract.clients_id_data;
  const merchant = contract.merchants_id_data;
  const clientFullName = client ? `${client.second_name || ""} ${client.first_name || ""} ${client.middle_name || ""}`.trim() : "-";

  return (
    <>
      <PageMeta
        title={`Договор #${contract.id} | HRMS`}
        description="Детальная информация о договоре"
      />

      {/* Breadcrumb */}
      <div className="flex items-start justify-between mb-6">
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
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              </li>
              <li>
                <Link
                  className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
                  to="/contracts"
                >
                  Договоры
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
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              </li>
              <li className="text-sm text-gray-800 dark:text-white/90">
                Договор #{contract.id}
              </li>
            </ol>
          </nav>
        </div>
      </div>

      <div className="space-y-6">
        {/* Header with contract info */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-6 lg:p-8 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-50/50 via-transparent to-transparent dark:from-brand-500/5 pointer-events-none"></div>

          <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Icon */}
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>

              {/* Contract code and client */}
              <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90 mb-1">
                  ДОГОВОР #{contract.id}
                </h2>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="font-medium">{clientFullName}</span>
                </div>
              </div>
            </div>

            {/* Amount info */}
            <div className="text-right">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Сумма договора</p>
              <p className="text-2xl font-bold text-success-600 dark:text-success-400">
                {formatAmount(contract.installment_amount)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Ежемесячный платёж: {formatAmount(contract.monthly_payment)}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="contract">
          <TabsList className="mb-6 overflow-x-auto flex-nowrap w-full justify-start">
            <TabsTrigger value="contract">Договор</TabsTrigger>
            <TabsTrigger value="products">Продукты</TabsTrigger>
            <TabsTrigger value="payments">График платежей</TabsTrigger>
            <TabsTrigger value="client-payments">Оплаты</TabsTrigger>
            <TabsTrigger value="contacts">Контакты</TabsTrigger>
            <TabsTrigger value="documents">Документы</TabsTrigger>
          </TabsList>

          {/* Contract Tab */}
          <TabsContent value="contract">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column - Contract info (2/3 width) */}
              <div className="lg:col-span-2">
                <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                    <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
                      Информация о договоре
                    </h3>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                      {/* Left side */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Срок договора</span>
                          <span className="text-sm font-medium text-gray-800 dark:text-white/90">{contract.month_count} мес</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Сумма договора</span>
                          <span className="text-sm font-medium text-gray-800 dark:text-white/90">{formatAmount(contract.installment_amount)}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Дата договора</span>
                          <span className="text-sm font-medium text-gray-800 dark:text-white/90">{formatDate(contract.created_at)}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Текущая задолженность</span>
                          <span className="text-sm font-medium text-error-500">0 сум</span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Партнёр</span>
                          <span className="text-sm font-medium text-gray-800 dark:text-white/90">{merchant?.name || "-"}</span>
                        </div>
                      </div>

                      {/* Right side */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Первоначальный взнос</span>
                          <span className="text-sm font-medium text-gray-800 dark:text-white/90">{formatAmount(contract.initial_payment_amount)}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Сумма заявки</span>
                          <span className="text-sm font-medium text-gray-800 dark:text-white/90">{formatAmount(contract.application_amount)}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Всего оплачено</span>
                          <span className="text-sm font-medium text-gray-800 dark:text-white/90">0 сум</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Остаток долга</span>
                          <span className="text-sm font-medium text-gray-800 dark:text-white/90">{formatAmount(contract.installment_amount)}</span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                          <span className="text-sm text-gray-500 dark:text-gray-400">Ежемесячный платёж</span>
                          <span className="text-sm font-medium text-gray-800 dark:text-white/90">{formatAmount(contract.monthly_payment)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right column - Client and Merchant info (1/3 width) */}
              <div className="space-y-6">
                {/* Client info card */}
                <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
                      Клиент
                    </h3>
                    {client && (
                      <Link
                        to={`/clients/${client.guid}`}
                        className="text-xs text-brand-500 hover:text-brand-600"
                      >
                        Подробнее →
                      </Link>
                    )}
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400">ФИО</span>
                      <span className="text-sm font-medium text-gray-800 dark:text-white/90 text-right max-w-[60%]">
                        {clientFullName}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Телефон</span>
                      <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                        {client?.phone_number || "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Паспорт</span>
                      <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                        {client ? `${client.passport_series || ""}${client.passport_number || ""}` : "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Дата рождения</span>
                      <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                        {client?.birthdate ? formatDate(client.birthdate) : "-"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Merchant info card */}
                <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
                      Партнёр
                    </h3>
                    {merchant && (
                      <Link
                        to={`/merchants/${merchant.guid}`}
                        className="text-xs text-brand-500 hover:text-brand-600"
                      >
                        Подробнее →
                      </Link>
                    )}
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Название</span>
                      <span className="text-sm font-medium text-gray-800 dark:text-white/90 text-right max-w-[60%]">
                        {merchant?.name || "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Директор</span>
                      <span className="text-sm font-medium text-gray-800 dark:text-white/90 text-right max-w-[60%]">
                        {merchant?.director_fio || "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Телефон</span>
                      <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                        {merchant?.phone || "-"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400">ИНН</span>
                      <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                        {merchant?.tin || "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products">
            <ProductsTab contractId={id || ""} />
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments">
            <PaymentScheduleTab contractId={id || ""} />
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <DocumentsTab contractId={id || ""} />
          </TabsContent>

          {/* Client Payments Tab */}
          <TabsContent value="client-payments">
            <PaymentsTab contractId={id || ""} />
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts">
            <ContactsTab contractId={id || ""} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
