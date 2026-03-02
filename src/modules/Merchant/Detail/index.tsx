import { useParams, Link } from "react-router";
import PageMeta from "../../../components/common/PageMeta";
import { useMerchantQuery } from "../../../api/services/merchant.service";
import Badge from "../../../components/ui/badge/Badge";
import Button from "../../../components/ui/button/Button";
import { PencilIcon } from "../../../icons";
import Spinner from "../../../components/ui/Spinner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/ui/tabs";
import ReconciliationTab from "../components/ReconciliationTab";

export default function MerchantDetail() {
  const { id } = useParams();
  const { data, isLoading, error } = useMerchantQuery({
    guid: id || "",
  });

  const merchant = data?.response || data;

  const formatDate = (dateString: string) => {
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

  const getStatusBadge = (status: string[]) => {
    if (!status || status.length === 0) return null;
    const statusValue = status[0]?.toLowerCase();
    if (statusValue === "active") {
      return (
        <Badge size="sm" color="success">
          Активный
        </Badge>
      );
    }
    return (
      <Badge size="sm" color="warning">
        Неактивный
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <>
        <PageMeta title="Партнер | HRMS" description="Детальная информация о партнере" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Spinner />
        </div>
      </>
    );
  }

  if (!merchant) {
    return (
      <>
        <PageMeta title="Партнер | HRMS" description="Детальная информация о партнере" />
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-gray-500 dark:text-gray-400">Партнер не найден</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta
        title={`${merchant.name || "Партнер"} | HRMS`}
        description="Детальная информация о партнере"
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
                  to="/merchants"
                >
                  Партнеры
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
                {merchant.name || "Партнер"}
              </li>
            </ol>
          </nav>
        </div>
        <Link to={`/merchants/${id}/edit`}>
          <Button variant="primary" startIcon={<PencilIcon />}>
            Редактировать
          </Button>
        </Link>
      </div>

      <div className="space-y-6">
        {/* Логотип и основная информация - вверху */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3 p-6 lg:p-8 overflow-hidden relative">
          {/* Градиентный фон */}
          <div className="absolute inset-0 bg-gradient-to-br from-brand-50/50 via-transparent to-transparent dark:from-brand-500/5 pointer-events-none"></div>

          <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Логотип */}
            <div className="relative">
              {merchant.logo ? (
                <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border-2 border-gray-200 dark:border-gray-700 shadow-lg bg-white dark:bg-gray-800">
                  <img
                    src={merchant.logo}
                    alt={merchant.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              ) : (
                <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 shadow-lg">
                  <svg
                    className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="absolute bottom-2 right-2 w-5 h-5 bg-red-500 rounded-full border-2 border-white dark:border-gray-800 shadow-sm"></span>
                </div>
              )}
            </div>

            {/* Информация о партнере */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white/90">
                  {merchant.name || "Партнер"}
                </h2>
                {getStatusBadge(merchant.status)}
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>{merchant.director_fio}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>{merchant.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                  <span>ID: {merchant.id}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="info">
          <TabsList className="mb-6">
            <TabsTrigger value="info">Информация</TabsTrigger>
            <TabsTrigger value="reconciliation">Акт сверки</TabsTrigger>
          </TabsList>

          {/* Tab Content - Info */}
          <TabsContent value="info">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Левая колонка - Основная информация */}
              <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5 lg:p-6">
                <h4 className="text-base font-semibold text-gray-800 dark:text-white/90 mb-5">
                  Основная информация
                </h4>
                <div className="space-y-5">
                  <div>
                    <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                      ID
                    </p>
                    <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                      {merchant.id}
                    </p>
                  </div>

                  <div>
                    <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                      Название магазина
                    </p>
                    <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                      {merchant.name}
                    </p>
                  </div>

                  <div>
                    <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                      Ф.И.О партнера
                    </p>
                    <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                      {merchant.director_fio}
                    </p>
                  </div>

                  <div>
                    <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                      Номер телефона
                    </p>
                    <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                      {merchant.phone}
                    </p>
                  </div>

                  <div>
                    <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                      ИНН/ПИНФЛ
                    </p>
                    <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                      {merchant.tin}
                    </p>
                  </div>

                  <div>
                    <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                      Статус
                    </p>
                    <div className="text-sm">
                      {getStatusBadge(merchant.status)}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                      Тип
                    </p>
                    <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                      Из нашего баланса
                    </p>
                  </div>

                  <div>
                    <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                      Дата создания
                    </p>
                    <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                      {formatDate(merchant.created_at || merchant.createdAt || "")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Правая колонка - Банковские реквизиты и Адресная информация */}
              <div className="space-y-6">
                {/* Банковские реквизиты */}
                <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5 lg:p-6">
                  <h4 className="text-base font-semibold text-gray-800 dark:text-white/90 mb-5">
                    Банковские реквизиты
                  </h4>
                  <div className="space-y-5">
                    <div>
                      <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                        Банк
                      </p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                        {merchant.bank || "-"}
                      </p>
                    </div>

                    <div>
                      <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                        МФО
                      </p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                        {merchant.mfo || "-"}
                      </p>
                    </div>

                    <div>
                      <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                        P/C
                      </p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                        {merchant.bank_account || "-"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Адресная информация */}
                <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5 lg:p-6">
                  <h4 className="text-base font-semibold text-gray-800 dark:text-white/90 mb-5">
                    Адресная информация
                  </h4>
                  <div className="space-y-5">
                    <div>
                      <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                        Область
                      </p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                        {merchant.area || "-"}
                      </p>
                    </div>

                    <div>
                      <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                        Регион
                      </p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                        {merchant.region || "-"}
                      </p>
                    </div>

                    <div>
                      <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
                        Адрес
                      </p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                        {merchant.address || "-"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Tab Content - Reconciliation */}
          <TabsContent value="reconciliation">
            <ReconciliationTab merchantId={id || ""} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
