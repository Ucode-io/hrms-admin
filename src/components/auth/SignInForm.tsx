import { useState } from "react";
import { useNavigate } from "react-router";
import { EyeCloseIcon, EyeIcon } from "../../icons";
import authStore from "../../store/auth.store";
import companyStore from "../../store/company.store";
import { useLogin } from "../../api/services/auth.service";
import { observer } from "mobx-react-lite";
import { useTranslation } from "../../i18n";

const SignInForm = observer(function SignInForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const loginMutation = useLogin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();
    setUsername(trimmedUsername);
    setPassword(trimmedPassword);

    try {
      const response = await loginMutation.mutateAsync({
        username: trimmedUsername,
        password: trimmedPassword,
      });

      const accessToken = response?.token?.access_token;
      const refreshToken = response?.token?.refresh_token;
      const userData = response?.user_data || {};
      const loginCompanyId =
        typeof response?.companies_id === "string" && response.companies_id.trim().length > 0
          ? response.companies_id.trim()
          : null;

      if (loginCompanyId && (typeof userData.companies_id !== "string" || !userData.companies_id.trim())) {
        userData.companies_id = loginCompanyId;
      }

      if (accessToken) {
        authStore.login(accessToken, userData, refreshToken || null, loginCompanyId);
        void companyStore.fetchCompany(loginCompanyId);
        navigate("/");
      } else {
        setError(t("auth.token_error"));
      }
    } catch (err: unknown) {
      console.error("Login error:", err);
      // Человеческий текст ucode кладёт в `data`, а в `description` — константу
      // под код ответа: на неверный пароль там «Invalid argument value passed»,
      // и именно это показывалось вместо «неверный пароль».
      const message = (err as { response?: { data?: { data?: unknown } } })?.response?.data?.data;
      setError(typeof message === "string" && message.trim() ? message : t("auth.invalid_credentials"));
    }
  };

  return (
    <div className="w-full max-w-[480px]">
      <div className="rounded-2xl bg-white px-8 py-10 shadow-theme-sm sm:px-10 sm:py-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-10">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
            <img
              src={companyStore.logo}
              alt={companyStore.companyName}
              className="h-6 w-6 object-contain"
            />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">
            {t("auth.welcome", { company: companyStore.companyName })}
          </h1>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="space-y-5">
            {error && (
              <div className="rounded-xl bg-error-50 border border-error-100 px-4 py-3 text-sm text-error-600">
                {error}
              </div>
            )}

            {/* Login Field */}
            <div>
              <label className="mb-2 block text-sm text-gray-500">
                {t("auth.login_label")}
              </label>
              <input
                type="text"
                placeholder="name@domain.com"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
                disabled={loginMutation.isLoading}
                className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 focus:outline-none disabled:opacity-50 transition-all"
              />
            </div>

            {/* Password Field */}
            <div>
              <label className="mb-2 block text-sm text-gray-500">
                {t("auth.password")}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loginMutation.isLoading}
                  className="h-12 w-full rounded-xl border border-gray-200 bg-white px-4 pr-12 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 focus:outline-none disabled:opacity-50 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
                >
                  {showPassword ? (
                    <EyeIcon className="fill-gray-400 size-5" />
                  ) : (
                    <EyeCloseIcon className="fill-gray-400 size-5" />
                  )}
                </button>
              </div>

              {/* Forgot Password */}
              <div className="mt-2 text-right">
                <button
                  type="button"
                  className="text-sm text-brand-500 hover:text-brand-600 transition-colors"
                >
                  {t("auth.forgot_password")}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-1">
              <button
                type="submit"
                disabled={loginMutation.isLoading}
                className="h-12 w-full rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                style={{ backgroundColor: companyStore.mainColor }}
              >
                {loginMutation.isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {t("auth.signing_in")}
                  </span>
                ) : (
                  t("auth.sign_in")
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
});

export default SignInForm;
