import React from "react";
import { Link } from "react-router";
import companyStore from "../../store/company.store";
import { observer } from "mobx-react-lite";
import { useTranslation, LOCALES, LOCALE_NAMES } from "../../i18n";
import type { Locale } from "../../i18n/messages";

const AuthLayout = observer(function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t, locale, setLocale } = useTranslation();
  return (
    <div className="relative flex min-h-screen flex-col" style={{ backgroundColor: "#f0f4f8" }}>
      {/* Company Cover Background */}
      {companyStore.company?.company_cover && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-60"
          style={{ backgroundImage: `url('${companyStore.company.company_cover}')` }}
        />
      )}

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-8 py-6 sm:px-12 sm:py-8">
        <Link to="/">
          <img
            src={companyStore.logo}
            alt={companyStore.companyName}
            className="h-8 sm:h-9 max-w-[160px] object-contain"
          />
        </Link>
        <select
          value={locale}
          onChange={(event) => setLocale(event.target.value as Locale)}
          aria-label={t("common.language")}
          className="cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none"
        >
          {LOCALES.map((code) => (
            <option key={code} value={code}>
              {LOCALE_NAMES[code]}
            </option>
          ))}
        </select>
      </header>

      {/* Centered Form */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-8">
        {children}
      </div>

      {/* Footer */}
      <footer className="relative z-10 pb-8 text-center">
        <p className="text-xs text-gray-400 mb-4">
          {t("auth.terms_prefix")}{" "}
          <a href="#" className="text-brand-500 hover:text-brand-600 transition-colors">
            {t("auth.terms_of_use")}
          </a>{" "}
          {t("auth.terms_and")}{" "}
          <a href="#" className="text-brand-500 hover:text-brand-600 transition-colors">
            {t("auth.privacy_policy")}
          </a>
        </p>
        <Link to="/" className="inline-block">
          <img
            src={companyStore.logo}
            alt={companyStore.companyName}
            className="h-6 max-w-[120px] object-contain opacity-40 mx-auto"
          />
        </Link>
      </footer>
    </div>
  );
});

export default AuthLayout;
