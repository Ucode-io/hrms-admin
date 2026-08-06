import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Link2, RefreshCw, Save, XCircle } from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../../components/common/PageMeta";
import Button from "../../../../components/ui/button/Button";
import Spinner from "../../../../components/ui/Spinner";
import {
  useTd2Config,
  useTd2ConfigCreate,
  useTd2ConfigTest,
  useTd2ConfigUpdate,
  useTd2FullSyncAsync,
  useTd2RefreshToken,
  useTd2SyncStatus,
  type Td2ConfigTestResult,
} from "../../../../api/services/timedoctor.service";
import EmployeesScopeTab from "./EmployeesScopeTab";

type SettingsTab = "connection" | "employees";

const TABS: { key: SettingsTab; label: string }[] = [
  { key: "connection", label: "Подключение" },
  { key: "employees", label: "Сотрудники" },
];

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) return "—";
  const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const pad = (value: number) => String(value).padStart(2, "0");
const toIsoDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Период синхронизации по умолчанию — текущий месяц целиком. */
const currentMonthRange = () => {
  const now = new Date();
  return {
    from: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
};

const inputClass =
  "h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-brand-400";

const cardClass = "rounded-2xl border border-gray-200 bg-white p-5";

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

/** Функция отдаёт пустые строки вместо null — приводим к «нет значения». */
const nonEmpty = (value: string | undefined | null): string => value?.trim() ?? "";

export default function TimeDoctorIntegrationSettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("connection");
  const configQuery = useTd2Config();
  const config = configQuery.data ?? null;

  const createMutation = useTd2ConfigCreate();
  const updateMutation = useTd2ConfigUpdate();
  const testMutation = useTd2ConfigTest();
  const refreshMutation = useTd2RefreshToken();
  const syncMutation = useTd2FullSyncAsync();

  // Статус опрашивается только при подключённой интеграции: без конфига метод
  // всё равно вернёт ошибку.
  const syncStatusQuery = useTd2SyncStatus(Boolean(config));
  const syncStatus = syncStatusQuery.data ?? null;
  const isSyncRunning = Boolean(syncStatus?.running);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [connectEmail, setConnectEmail] = useState("");
  const [connectPassword, setConnectPassword] = useState("");
  const [testResult, setTestResult] = useState<Td2ConfigTestResult | null>(null);
  const [range, setRange] = useState(currentMonthRange);

  // Поле email — управляемое, поэтому наполняем его, когда конфиг доехал.
  useEffect(() => {
    setEmail(config?.email ?? "");
  }, [config?.email]);

  const isDirty = useMemo(
    () => email.trim() !== (config?.email ?? "").trim() || password.trim().length > 0,
    [email, password, config?.email]
  );

  const handleSave = async () => {
    if (!config) return;
    const payload: { guid: string; email?: string; password?: string } = {
      guid: config.guid,
    };
    if (email.trim() && email.trim() !== config.email) payload.email = email.trim();
    if (password.trim()) payload.password = password;

    if (!payload.email && !payload.password) {
      toast.info("Менять нечего.");
      return;
    }

    try {
      await updateMutation.mutateAsync(payload);
      setPassword("");
      toast.success("Данные сохранены. Обновите токен, чтобы применить их.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось сохранить данные."));
    }
  };

  const handleRefresh = async () => {
    try {
      const result = await refreshMutation.mutateAsync();
      toast.success(
        `Токен обновлён. Действует до ${formatDateTime(result.token_expires_at)}.`
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось обновить токен."));
    }
  };

  const handleTest = async () => {
    setTestResult(null);
    try {
      const result = await testMutation.mutateAsync();
      setTestResult(result);
      if (result.connected) toast.success("Соединение активно.");
      else toast.error(result.error || "Токен недействителен.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось проверить соединение."));
    }
  };

  const handleSync = async () => {
    if (range.from > range.to) {
      toast.error("Дата начала позже даты окончания.");
      return;
    }
    try {
      await syncMutation.mutateAsync({ from_date: range.from, to_date: range.to });
      toast.success("Синхронизация запущена — прогресс появится ниже.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось запустить синхронизацию."));
    }
  };

  const handleConnect = async () => {
    if (!connectEmail.trim() || !connectPassword.trim()) {
      toast.error("Укажите email и пароль Time Doctor.");
      return;
    }
    try {
      await createMutation.mutateAsync({
        email: connectEmail.trim(),
        password: connectPassword,
      });
      toast.success("Аккаунт Time Doctor подключён.");
      setConnectEmail("");
      setConnectPassword("");
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось подключить аккаунт."));
    }
  };

  const handleToggleActive = async () => {
    if (!config) return;
    try {
      await updateMutation.mutateAsync({ guid: config.guid, is_active: !config.is_active });
      toast.success(config.is_active ? "Интеграция отключена." : "Интеграция включена.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось изменить статус."));
    }
  };

  const isActive = Boolean(config?.is_active);
  const syncError = nonEmpty(syncStatus?.error);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageMeta title="Time Doctor — Интеграции" description="Подключение аккаунта Time Doctor" />

      <div className="mb-6 flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
          <Link2 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Time Doctor</h1>
          <p className="text-sm text-gray-500">
            Подключение компании Time Doctor и синхронизация отработанного времени.
          </p>
        </div>
      </div>

      {/* Охват трекинга — настройка HRMS, а не Time Doctor, поэтому вкладка
          доступна и без подключённой интеграции. */}
      <div className="mb-4 inline-flex rounded-xl border border-gray-200 p-0.5">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium transition"
            style={{
              backgroundColor: tab === item.key ? "var(--company-color)" : "transparent",
              color: tab === item.key ? "#ffffff" : "#475569",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "employees" ? (
        <EmployeesScopeTab />
      ) : configQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : config ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* ── Учётные данные ─────────────────────────────────────────── */}
            <div className={cardClass}>
              <h2 className="text-base font-semibold text-gray-900">Учётные данные</h2>
              <p className="mt-1 text-sm text-gray-500">
                Данные администратора Time Doctor. Пароль хранится на сервере и нужен
                для автоматического обновления токена.
              </p>

              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={inputClass}
                    placeholder="owner@company.com"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Пароль</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={inputClass}
                    placeholder="Оставьте пустым, чтобы не менять"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  onClick={() => void handleSave()}
                  disabled={updateMutation.isLoading || !isDirty}
                  startIcon={<Save className="h-4 w-4" />}
                  className="h-10"
                >
                  {updateMutation.isLoading ? "Сохранение…" : "Сохранить"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void handleRefresh()}
                  disabled={refreshMutation.isLoading}
                  startIcon={<RefreshCw className="h-4 w-4" />}
                  className="h-10"
                >
                  {refreshMutation.isLoading ? "Обновление…" : "Обновить токен"}
                </Button>
              </div>
            </div>

            {/* ── Состояние подключения ──────────────────────────────────── */}
            <div className={cardClass}>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Состояние подключения</h2>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                    isActive ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isActive ? "bg-emerald-500" : "bg-gray-400"
                    }`}
                  />
                  {isActive ? "Активно" : "Отключено"}
                </span>
              </div>

              <dl className="mt-4 space-y-2.5">
                {[
                  ["Компания", config.time_doctor_company_name || "—"],
                  ["Email", config.email || "—"],
                  ["Токен действует до", formatDateTime(config.token_expires_at)],
                  ["Последняя синхронизация", formatDateTime(config.last_sync_at)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-baseline gap-3">
                    <dt className="w-44 shrink-0 text-sm text-gray-500">{label}</dt>
                    <dd className="text-sm font-medium text-gray-900">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => void handleTest()}
                  disabled={testMutation.isLoading}
                  startIcon={<CheckCircle2 className="h-4 w-4" />}
                  className="h-10"
                >
                  {testMutation.isLoading ? "Проверка…" : "Проверить соединение"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void handleToggleActive()}
                  disabled={updateMutation.isLoading}
                  className="h-10"
                >
                  {isActive ? "Отключить" : "Включить"}
                </Button>
              </div>

              {testResult ? (
                <div
                  className={`mt-3 flex items-start gap-2.5 rounded-xl border p-3 ${
                    testResult.connected
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-rose-200 bg-rose-50"
                  }`}
                >
                  {testResult.connected ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                  )}
                  <div className="text-sm">
                    {testResult.connected ? (
                      <>
                        <p className="font-medium text-emerald-700">Соединение активно</p>
                        <p className="text-emerald-600">
                          {testResult.company_name} · {testResult.user_email}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-rose-700">Соединение недоступно</p>
                        <p className="text-rose-600">{testResult.error}</p>
                      </>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* ── Синхронизация ────────────────────────────────────────────── */}
          <div className={cardClass}>
            <h2 className="text-base font-semibold text-gray-900">Синхронизация</h2>
            <p className="mt-1 text-sm text-gray-500">
              Загружает из Time Doctor проекты, задачи и отработанное время за период.
              Запускается в фоне — страницу можно закрыть.
            </p>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">С</label>
                <input
                  type="date"
                  value={range.from}
                  onChange={(event) =>
                    setRange((prev) => ({ ...prev, from: event.target.value }))
                  }
                  className={`${inputClass} w-44`}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">По</label>
                <input
                  type="date"
                  value={range.to}
                  onChange={(event) =>
                    setRange((prev) => ({ ...prev, to: event.target.value }))
                  }
                  className={`${inputClass} w-44`}
                />
              </div>
              <Button
                onClick={() => void handleSync()}
                disabled={syncMutation.isLoading || isSyncRunning || !isActive}
                startIcon={
                  <RefreshCw className={`h-4 w-4 ${isSyncRunning ? "animate-spin" : ""}`} />
                }
                className="h-11"
              >
                {isSyncRunning ? "Синхронизация…" : "Синхронизировать"}
              </Button>
            </div>

            {!isActive && (
              <p className="mt-2 text-xs text-amber-600">
                Интеграция отключена — включите её, чтобы запускать синхронизацию.
              </p>
            )}

            {syncStatus ? (
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  <span className="inline-flex items-center gap-2 font-medium text-gray-900">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isSyncRunning
                          ? "animate-pulse bg-brand-500"
                          : syncError
                            ? "bg-rose-500"
                            : "bg-emerald-500"
                      }`}
                    />
                    {isSyncRunning
                      ? nonEmpty(syncStatus.phase) || "Выполняется"
                      : syncError
                        ? "Завершилась с ошибкой"
                        : "Простаивает"}
                  </span>
                  {nonEmpty(syncStatus.from_date) && (
                    <span className="text-gray-500">
                      Период: {syncStatus.from_date} — {syncStatus.to_date}
                    </span>
                  )}
                  <span className="text-gray-500">
                    Записей загружено: {syncStatus.worklogs_synced ?? 0}
                  </span>
                  {nonEmpty(syncStatus.trigger) && (
                    <span className="text-gray-500">
                      Запуск: {syncStatus.trigger === "manual" ? "вручную" : syncStatus.trigger}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
                  <span>Начало: {formatDateTime(nonEmpty(syncStatus.started_at))}</span>
                  <span>Окончание: {formatDateTime(nonEmpty(syncStatus.finished_at))}</span>
                </div>

                {syncError && (
                  <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
                    {syncError}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        /* ── Первое подключение ───────────────────────────────────────────── */
        <div className={`${cardClass} max-w-xl`}>
          <h2 className="text-base font-semibold text-gray-900">Подключить аккаунт</h2>
          <p className="mt-1 text-sm text-gray-500">
            Войдите с учётными данными владельца аккаунта Time Doctor. Пароль хранится
            для автоматического обновления токена.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Email</label>
              <input
                type="email"
                value={connectEmail}
                onChange={(event) => setConnectEmail(event.target.value)}
                className={inputClass}
                placeholder="owner@company.com"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Пароль</label>
              <input
                type="password"
                value={connectPassword}
                onChange={(event) => setConnectPassword(event.target.value)}
                className={inputClass}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            <Button
              onClick={() => void handleConnect()}
              disabled={
                createMutation.isLoading || !connectEmail.trim() || !connectPassword.trim()
              }
              className="h-11"
            >
              {createMutation.isLoading ? "Подключение…" : "Подключить"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
