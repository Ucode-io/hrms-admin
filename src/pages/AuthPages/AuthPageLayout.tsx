import React from "react";
import { Link } from "react-router";
import companyStore from "../../store/company.store";
import { observer } from "mobx-react-lite";

const AuthLayout = observer(function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm cursor-pointer hover:bg-gray-50">
          <span>Русский</span>
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </header>

      {/* Centered Form */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-8">
        {children}
      </div>

      {/* Footer */}
      <footer className="relative z-10 pb-8 text-center">
        <p className="text-xs text-gray-400 mb-4">
          Продолжая, вы подтверждаете, что прочитали наши{" "}
          <a href="#" className="text-brand-500 hover:text-brand-600 transition-colors">
            Условия использования
          </a>{" "}
          и{" "}
          <a href="#" className="text-brand-500 hover:text-brand-600 transition-colors">
            Политика конфиденциальности
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
