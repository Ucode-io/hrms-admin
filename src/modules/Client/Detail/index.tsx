import { useParams, Link } from "react-router";
import PageMeta from "../../../components/common/PageMeta";
import { useClientQuery, useClientCardsQuery, useClientPhoneNumbersQuery, useClientsQuery, useScoringsQuery } from "../../../api/services/client.service";
import Button from "../../../components/ui/button/Button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/ui/tabs";
import UnderDevelopment from "../../../pages/OtherPage/UnderDevelopment";
import Spinner from "../../../components/ui/Spinner";
import ContractsTab from "../components/ContractsTab";
import CardReportsTab from "../components/CardReportsTab";
import INPSReportsTab from "../components/INPSReportsTab";
import KATMReportsTab from "../components/KATMReportsTab";
import DocumentsTab from "../components/DocumentsTab";
import DebtsTab from "../components/DebtsTab";
import PaymentsTab from "../components/PaymentsTab";

const formatAmount = (amount: number) => {
  if (!amount) return "0";
  return new Intl.NumberFormat("ru-RU").format(amount);
};

export default function ClientDetail() {
  const { id } = useParams();
  const { data, isLoading } = useClientsQuery({
    data: { guid: id || "" },
  });

  const client = data?.response?.[0]

  // Fetch client cards
  const { data: cardsData, isLoading: isLoadingCards } = useClientCardsQuery({ data: { clients_id: id || "" } });

  const cards = cardsData?.response || [];

  // Fetch client phone numbers
  const { data: phoneNumbersData, isLoading: isLoadingPhoneNumbers } = useClientPhoneNumbersQuery({
    data: { clients_id: id || "" },
  });
  const phoneNumbers = phoneNumbersData?.response || [];

  // Fetch scorings
  const { data: scoringsData } = useScoringsQuery({
    data: { limit: 1, clients_id: id || "" },
  });
  const scoring = scoringsData?.response?.[0];

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleString("ru-RU", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <>
        <PageMeta title="Клиент | HRMS" description="Детальная информация о клиенте" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Spinner />
        </div>
      </>
    );
  }

  if (!client) {
    return (
      <>
        <PageMeta title="Клиент | HRMS" description="Детальная информация о клиенте" />
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-gray-500 dark:text-gray-400">Клиент не найден</p>
        </div>
      </>
    );
  }

  const fullName = `${client.second_name || ""} ${client.first_name || ""} ${client.middle_name || ""}`.trim();

  return (
    <>
      <PageMeta
        title={`${fullName || "Клиент"} | HRMS`}
        description="Детальная информация о клиенте"
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
                      stroke=""
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
                  to="/clients"
                >
                  Клиенты
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
                {fullName || "Клиент"}
              </li>
            </ol>
          </nav>
        </div>
      </div>

      <div className="space-y-6">
        {/* Header with client name and info */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-6 lg:p-8 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-50/50 via-transparent to-transparent dark:from-brand-500/5 pointer-events-none"></div>

          <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>

              {/* Name and phone */}
              <div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90 mb-1">
                  {fullName.toUpperCase()}
                </h2>
                <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="font-semibold">{client.phone_number}</span>
                </div>
              </div>
            </div>

            {/* Limit info */}
            <div className="text-right">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Лимит</p>
              <p className="text-2xl font-bold text-success-600 dark:text-success-400">
                {formatAmount(client.scoring_limit)} сум
              </p>
              {/* <p className="text-xs text-gray-500 dark:text-gray-400">Изначальный лимит</p> */}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <button className="px-4 py-2 text-xs font-medium rounded-lg bg-red-500 hover:bg-red-600 text-white border-0 transition-colors">
            Неопознанный
          </button>
          <button className="px-4 py-2 text-xs font-medium rounded-lg bg-success-500 hover:bg-success-600 text-white border-0 transition-colors">
            Разрешить скоринг
          </button>
          <button className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-500 hover:bg-blue-600 text-white border-0 transition-colors">
            Редактировать
          </button>
          <button className="px-4 py-2 text-xs font-medium rounded-lg bg-gray-800 hover:bg-gray-900 text-white border-0 transition-colors">
            Заблокировать
          </button>
          <button className="px-4 py-2 text-xs font-medium rounded-lg bg-orange-500 hover:bg-orange-600 text-white border-0 transition-colors">
            Редактировать номер телефона
          </button>
          <button className="px-4 py-2 text-xs font-medium rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white border-0 transition-colors">
            Отменить преимущество KATM
          </button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="client">
          <TabsList className="mb-6 overflow-x-auto flex-nowrap w-full justify-start">
            <TabsTrigger value="client">Клиент</TabsTrigger>
            <TabsTrigger value="contracts">Договоры</TabsTrigger>
            <TabsTrigger value="debts">Задолженность</TabsTrigger>
            <TabsTrigger value="payments">Оплаты</TabsTrigger>
            <TabsTrigger value="kartalar">Отчёты по картам</TabsTrigger>
            <TabsTrigger value="jips">Отчёты INPS</TabsTrigger>
            <TabsTrigger value="katm">Отчёты КАТМ-Uzcard</TabsTrigger>
            <TabsTrigger value="documents">Прикрепленные документы</TabsTrigger>
          </TabsList>

          {/* Tab Content - Client */}
          <TabsContent value="client">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Left column - Client Information (2/3 width) */}
              <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5 lg:p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <div>
                      <p className="mb-1 text-xs leading-normal text-gray-500 dark:text-gray-400">ID</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{client.id}</p>
                    </div>

                    <div>
                      <p className="mb-1 text-xs leading-normal text-gray-500 dark:text-gray-400">Статус</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">Активный</p>
                    </div>

                    <div>
                      <p className="mb-1 text-xs leading-normal text-gray-500 dark:text-gray-400">Номер телефона</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{client.phone_number}</p>
                    </div>

                    <div>
                      <p className="mb-1 text-xs leading-normal text-gray-500 dark:text-gray-400">Ф.И.О клиента</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{fullName.toUpperCase()}</p>
                    </div>

                    <div>
                      <p className="mb-1 text-xs leading-normal text-gray-500 dark:text-gray-400">Имя</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{client.first_name}</p>
                    </div>

                    <div>
                      <p className="mb-1 text-xs leading-normal text-gray-500 dark:text-gray-400">Фамилия</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{client.second_name}</p>
                    </div>

                    <div>
                      <p className="mb-1 text-xs leading-normal text-gray-500 dark:text-gray-400">Отчество</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{client.middle_name}</p>
                    </div>

                    <div>
                      <p className="mb-1 text-xs leading-normal text-gray-500 dark:text-gray-400">Дата рождения</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{formatDate(client.birthdate)}</p>
                    </div>

                    <div>
                      <p className="mb-1 text-xs leading-normal text-gray-500 dark:text-gray-400">Серия паспорта</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{client.passport_series}</p>
                    </div>

                    <div>
                      <p className="mb-1 text-xs leading-normal text-gray-500 dark:text-gray-400">Номер паспорта</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{client.passport_number}</p>
                    </div>

                    <div>
                      <p className="mb-1 text-xs leading-normal text-gray-500 dark:text-gray-400">ПИНФЛ</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{client.pinfl}</p>
                    </div>

                    <div>
                      <p className="mb-1 text-xs leading-normal text-gray-500 dark:text-gray-400">Дата выдачи паспорта</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{formatDate(client.passport_issue_date)}</p>
                    </div>

                    <div className="col-span-2">
                      <p className="mb-1 text-xs leading-normal text-gray-500 dark:text-gray-400">Паспорт выдан</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{client.passport_issued_by}</p>
                    </div>

                    <div>
                      <p className="mb-1 text-xs leading-normal text-gray-500 dark:text-gray-400">Дата истечения срока действия паспорта</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{formatDate(client.passport_expiration_date)}</p>
                    </div>

                    <div>
                      <p className="mb-1 text-xs leading-normal text-gray-500 dark:text-gray-400">Партнер</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{client.merchants_id_data?.name || "-"}</p>
                    </div>

                    <div>
                      <p className="mb-1 text-xs leading-normal text-gray-500 dark:text-gray-400">Область</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">-</p>
                    </div>

                    <div>
                      <p className="mb-1 text-xs leading-normal text-gray-500 dark:text-gray-400">Район/Город</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">-</p>
                    </div>

                    <div className="col-span-2">
                      <p className="mb-1 text-xs leading-normal text-gray-500 dark:text-gray-400">Адрес</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">-</p>
                    </div>

                    <div>
                      <p className="mb-1 text-xs leading-normal text-gray-500 dark:text-gray-400">Дата создания</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{formatDateTime(client.created_at || "")}</p>
                    </div>

                    <div>
                      <p className="mb-1 text-xs leading-normal text-gray-500 dark:text-gray-400">Время начала скоринга</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                        {scoring?.inps_reports_id_data?.period_from ? formatDate(scoring.inps_reports_id_data.period_from) : "-"}
                      </p>
                    </div>

                    <div>
                      <p className="mb-1 text-xs leading-normal text-gray-500 dark:text-gray-400">Время окончания скоринга</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                        {scoring?.inps_reports_id_data?.period_to ? formatDate(scoring.inps_reports_id_data.period_to) : "-"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right column - Cards and additional phones (1/3 width) */}
              <div className="space-y-6">
                {/* Client Cards */}
                <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-base font-semibold text-gray-800 dark:text-white/90">
                      Карты клиента
                    </h4>
                    <Button variant="primary" className="text-xs px-3 py-1">
                      Баланс
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {isLoadingCards ? (
                      <div className="p-5 rounded-xl bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 aspect-[1.586/1]">
                        <div className="h-4 w-20 bg-white/30 rounded animate-pulse mb-8"></div>
                        <div className="h-5 w-full bg-white/30 rounded animate-pulse mb-4"></div>
                        <div className="h-3 w-16 bg-white/30 rounded animate-pulse"></div>
                      </div>
                    ) : cards.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                        Нет карт
                      </p>
                    ) : (
                      cards.map((card: any, index: number) => {
                        // Format card number with masking: 1234 **** **** 5678
                        const formatCardNumber = (cardNumber: string) => {
                          if (!cardNumber) return "****";
                          const cleaned = cardNumber.replace(/\s/g, "");
                          if (cleaned.length !== 16) return cardNumber;
                          const first4 = cleaned.substring(0, 4);
                          const last4 = cleaned.substring(12, 16);
                          return `${first4} **** **** ${last4}`;
                        };

                        // Determine card type from number
                        const getCardType = (cardNumber: string) => {
                          if (!cardNumber) return null;
                          const firstDigit = cardNumber.charAt(0);
                          if (firstDigit === "8") return "uzcard";
                          if (firstDigit === "9") return "humo";
                          if (cardNumber.startsWith("4")) return "visa";
                          if (cardNumber.startsWith("5")) return "mastercard";
                          return null;
                        };

                        const cardType = getCardType(card.card_number);

                        // Gradient based on card type
                        const gradients = {
                          uzcard: "from-blue-500 to-blue-700",
                          humo: "from-purple-500 to-purple-700",
                          visa: "from-blue-600 to-blue-800",
                          mastercard: "from-red-500 to-orange-600",
                          default: "from-gray-700 to-gray-900",
                        };

                        const gradient = gradients[cardType as keyof typeof gradients] || gradients.default;

                        return (
                          <div
                            key={index}
                            className={`relative p-5 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg aspect-[1.586/1] flex flex-col justify-between overflow-hidden`}
                          >
                            {/* Card pattern/decoration */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12"></div>

                            {/* Card Type Logo */}
                            <div className="relative flex items-center justify-between">
                              <div className="text-xs font-medium opacity-80">
                                {cardType === "uzcard" && "UzCard"}
                                {cardType === "humo" && "Humo"}
                                {cardType === "visa" && "VISA"}
                                {cardType === "mastercard" && "Mastercard"}
                              </div>
                              <svg className="w-8 h-8 opacity-80" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z" />
                              </svg>
                            </div>

                            {/* Card Number */}
                            <div className="relative">
                              <p className="text-lg font-mono font-semibold tracking-wider">
                                {formatCardNumber(card.card_number)}
                              </p>
                            </div>

                            {/* Expiry Date */}
                            <div className="relative flex items-end justify-between">
                              <div>
                                <p className="text-[10px] opacity-70 mb-0.5">VALID THRU</p>
                                <p className="text-sm font-mono font-medium">
                                  {card.expired_month}/{card.expired_year}
                                </p>
                              </div>
                              {/* Chip illustration */}
                              <div className="w-10 h-8 rounded bg-gradient-to-br from-yellow-200 to-yellow-400 opacity-80"></div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Additional Phone Numbers */}
                <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5">
                  <h4 className="text-base font-semibold text-gray-800 dark:text-white/90 mb-4">
                    Дополнительные номер телефоны клиента
                  </h4>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {isLoadingPhoneNumbers ? (
                      <div className="flex items-center gap-2 p-2 rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
                        <div className="flex-1">
                          <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1"></div>
                          <div className="h-3 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        </div>
                      </div>
                    ) : phoneNumbers.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                        Нет дополнительных номеров
                      </p>
                    ) : (
                      phoneNumbers.map((contact: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        >
                          <div className="w-8 h-8 rounded-full bg-success-100 dark:bg-success-900/20 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-success-600 dark:text-success-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 dark:text-white/90 truncate">
                              {contact.name || contact.contact_name || "Контакт"}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{contact.phone_number || contact.phone}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Other tabs - Under Development */}
          <TabsContent value="contracts">
            <ContractsTab clientId={id || ""} />
          </TabsContent>

          <TabsContent value="debts">
            <DebtsTab clientId={id || ""} />
          </TabsContent>

          <TabsContent value="payments">
            <PaymentsTab clientId={id || ""} />
          </TabsContent>

          <TabsContent value="kartalar">
            <CardReportsTab clientId={id || ""} />
          </TabsContent>

          <TabsContent value="jips">
            <INPSReportsTab clientId={id || ""} />
          </TabsContent>

          <TabsContent value="katm">
            <KATMReportsTab clientId={id || ""} />
          </TabsContent>

          <TabsContent value="documents">
            <DocumentsTab clientId={id || ""} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
