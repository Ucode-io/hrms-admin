import { useState } from "react";
import { CheckCircle2, RefreshCw, XCircle, Link2, Pencil } from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../../components/common/PageMeta";
import Button from "../../../../components/ui/button/Button";
import Spinner from "../../../../components/ui/Spinner";
import {
  useTd2Config,
  useTd2ConfigCreate,
  useTd2ConfigUpdate,
  useTd2ConfigTest,
  useTd2RefreshToken,
  type Td2ConfigTestResult,
} from "../../../../api/services/timedoctor.service";

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
  });
};

const inputClass =
  "h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-brand-400";

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

export default function TimeDoctorIntegrationSettingsPage() {
  const configQuery = useTd2Config();
  const config = configQuery.data ?? null;

  const createMutation = useTd2ConfigCreate();
  const updateMutation = useTd2ConfigUpdate();
  const testMutation = useTd2ConfigTest();
  const refreshMutation = useTd2RefreshToken();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [testResult, setTestResult] = useState<Td2ConfigTestResult | null>(null);

  const handleConnect = async () => {
    if (!email.trim() || !password.trim()) {
      toast.error("Укажите email и пароль Time Doctor.");
      return;
    }
    try {
      await createMutation.mutateAsync({ email: email.trim(), password });
      toast.success("Аккаунт Time Doctor подключён.");
      setEmail("");
      setPassword("");
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось подключить аккаунт."));
    }
  };

  const handleTest = async () => {
    setTestResult(null);
    try {
      const result = await testMutation.mutateAsync();
      setTestResult(result);
      if (result.connected) {
        toast.success("Соединение активно.");
      } else {
        toast.error(result.error || "Токен недействителен.");
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось проверить соединение."));
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

  const handleToggleActive = async () => {
    if (!config) return;
    try {
      await updateMutation.mutateAsync({
        guid: config.guid,
        is_active: !config.is_active,
      });
      toast.success(config.is_active ? "Интеграция отключена." : "Интеграция включена.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось изменить статус."));
    }
  };

  const startEditing = () => {
    setEditEmail(config?.email ?? "");
    setEditPassword("");
    setIsEditing(true);
  };

  const handleSaveCredentials = async () => {
    if (!config) return;
    const payload: { guid: string; email?: string; password?: string } = {
      guid: config.guid,
    };
    if (editEmail.trim() && editEmail.trim() !== config.email) {
      payload.email = editEmail.trim();
    }
    if (editPassword.trim()) {
      payload.password = editPassword;
    }
    if (!payload.email && !payload.password) {
      setIsEditing(false);
      return;
    }
    try {
      await updateMutation.mutateAsync(payload);
      toast.success("Данные обновлены. Обновите токен, чтобы применить их.");
      setIsEditing(false);
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось сохранить данные."));
    }
  };

  const isActive = Boolean(config?.is_active);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageMeta title="Time Doctor — Интеграции" description="Подключение аккаунта Time Doctor" />

      <div className="mb-6 flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
          <Link2 className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Time Doctor</h1>
          <p className="text-sm text-gray-500">
            Подключение компании Time Doctor для учёта рабочего времени.
          </p>
        </div>
      </div>

      {configQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : config ? (
        <div className="space-y-4">
          {/* Connection card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Подключение</h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                  isActive
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-gray-100 text-gray-500"
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

            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className={inputClass}
                    placeholder="owner@company.com"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Новый пароль (оставьте пустым, чтобы не менять)
                  </label>
                  <input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className={inputClass}
                    placeholder="••••••••"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => void handleSaveCredentials()}
                    disabled={updateMutation.isLoading}
                    className="h-10"
                  >
                    {updateMutation.isLoading ? "Сохранение..." : "Сохранить"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                    disabled={updateMutation.isLoading}
                    className="h-10"
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            ) : (
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-gray-500">Компания</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {config.time_doctor_company_name || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Email</dt>
                  <dd className="text-sm font-medium text-gray-900">{config.email || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Токен действует до</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {formatDateTime(config.token_expires_at)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Последняя синхронизация</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {formatDateTime(config.last_sync_at)}
                  </dd>
                </div>
              </dl>
            )}
          </div>

          {/* Test result */}
          {testResult ? (
            <div
              className={`flex items-start gap-3 rounded-xl border p-4 ${
                testResult.connected
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-rose-200 bg-rose-50"
              }`}
            >
              {testResult.connected ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
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

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => void handleTest()}
              disabled={testMutation.isLoading}
              className="h-10"
            >
              {testMutation.isLoading ? "Проверка..." : "Проверить соединение"}
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleRefresh()}
              disabled={refreshMutation.isLoading}
              startIcon={<RefreshCw className="h-4 w-4" />}
              className="h-10"
            >
              {refreshMutation.isLoading ? "Обновление..." : "Обновить токен"}
            </Button>
            <Button
              variant="outline"
              onClick={startEditing}
              disabled={isEditing}
              startIcon={<Pencil className="h-4 w-4" />}
              className="h-10"
            >
              Изменить данные
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
        </div>
      ) : (
        /* Connect form (no config yet) */
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            <Button
              onClick={() => void handleConnect()}
              disabled={createMutation.isLoading || !email.trim() || !password.trim()}
              className="h-11"
            >
              {createMutation.isLoading ? "Подключение..." : "Подключить"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
