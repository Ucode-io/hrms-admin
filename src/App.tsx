import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import SignIn from "./pages/AuthPages/SignIn";
import NotFound from "./pages/OtherPage/NotFound";
import UnderDevelopment from "./pages/OtherPage/UnderDevelopment";
import DashboardPage from "./modules/Dashboard";
import MerchantsList from "./modules/Merchant/List";
import MerchantDetail from "./modules/Merchant/Detail";
import MerchantFormPage from "./modules/Merchant/Form";
import MerchantTransactionsList from "./modules/MerchantTransactions/List";
import MerchantTransactionFormPage from "./modules/MerchantTransactions/Form";
import DebtsList from "./modules/Debts/List";
import PaymentsList from "./modules/Payments/List";
import FinanceSalaryPage from "./modules/Finance/Salary";
import ClientsList from "./modules/Client/List";
import ClientDetail from "./modules/Client/Detail";
import ClientFormPage from "./modules/Client/Form";
import ContractsList from "./modules/Contracts/List";
import ContractDetail from "./modules/Contracts/Detail";
import CreateContractClientSearch from "./modules/Contracts/CreateContract/ClientSearch";
import ContractForm from "./modules/Contracts/CreateContract/ContractForm";
import ProductsList from "./modules/Products/List";
import ProductFormPage from "./modules/Products/Form";
import PlatformSettingsPage from "./modules/Settings/PlatformSettings";
import SettingsGeneralPage from "./modules/Settings/General";
import HomeSettingsPage from "./modules/Settings/Home";
import PositionsSettingsPage from "./modules/Settings/Positions";
import ExperienceLevelsSettingsPage from "./modules/Settings/ExperienceLevels";
import EmploymentTypesSettingsPage from "./modules/Settings/EmploymentTypes";
import DivisionsSettingsPage from "./modules/Settings/Divisions";
import SkillsSettingsPage from "./modules/Settings/Skills";
import DepartmentsSettingsPage from "./modules/Settings/Departments";
import LocationsSettingsPage from "./modules/Settings/Locations";
import CompensationSettingsPage from "./modules/Settings/Compensation";
import AbsencePoliciesSettingsPage from "./modules/Settings/AbsencePolicies";
import HolidayPoliciesSettingsPage from "./modules/Settings/HolidayPolicies";
import HolidayPolicyDetailPage from "./modules/Settings/HolidayPolicies/Detail";
import DocumentsSettingsPage from "./modules/Settings/Documents";
import DocumentTemplateDetailPage from "./modules/Settings/Documents/TemplateDetail";
import WorkSchedulesSettingsPage from "./modules/Settings/WorkSchedules";
import ProbationPoliciesSettingsPage from "./modules/Settings/ProbationPolicies";
import DismissalReasonsSettingsPage from "./modules/Settings/DismissalReasons";
import DismissalTypesSettingsPage from "./modules/Settings/DismissalTypes";
import EmployeeWorkChangeReasonsSettingsPage from "./modules/Settings/EmployeeWorkChangeReasons";
import PropertyCategoriesSettingsPage from "./modules/Settings/PropertyCategories";
import TariffsList from "./modules/Settings/Tariffs/List";
import TariffForm from "./modules/Settings/Tariffs/Form";
import ProductCategoriesList from "./modules/Settings/ProductCategories/List";
import ProductCategoryForm from "./modules/Settings/ProductCategories/Form";
import SettingsPage from "./modules/Settings";
import EmployeesList from "./modules/Employees/List";
import EmployeeDetail from "./modules/Employees/Detail";
import EmployeeForm from "./modules/Employees/Form";
import CalendarModule from "./modules/Calendar";
import TimeAttendancePage from "./modules/Time/Attendance";
import ReportsHomePage from "./modules/Reports";
import AgeDistributionPage from "./modules/Reports/AgeDistribution";
import GenderDistributionPage from "./modules/Reports/GenderDistribution";
import StaffCountPage from "./modules/Reports/StaffCount";
import StaffTurnoverPage from "./modules/Reports/StaffTurnover";
import TenurePage from "./modules/Reports/Tenure";
import AbsenceBalancePage from "./modules/Reports/AbsenceBalance";
import AttendancePage from "./modules/Reports/Attendance";
import SportAttendancePage from "./modules/Reports/SportAttendance";
import PayrollPage from "./modules/Reports/Payroll";
import BonusDeductionsPage from "./modules/Reports/BonusDeductions";
import SuppliersList from "./modules/Suppliers/List";
import SupplierForm from "./modules/Suppliers/Form";
import OrganizationClientsList from "./modules/Clients/List";
import OrganizationClientForm from "./modules/Clients/Form";
import AgreementsList from "./modules/Agreements/List";
import AgreementForm from "./modules/Agreements/Form";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import { QueryClientProvider } from "react-query";
import queryClient from "./api/queryClient";
import authStore from "./store/auth.store";
import companyStore from "./store/company.store";
import CompanyThemeProvider from "./components/common/CompanyThemeProvider";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import { Toaster } from "sonner";

function App() {
  useEffect(() => {
    companyStore.fetchCompany();
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <CompanyThemeProvider />
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          duration: 3000,
        }}
      />
      <Router>
        <ScrollToTop />
        <Routes>
          {/* Dashboard Layout */}
          {
            authStore.isAuth ? <Route path="/" element={<AppLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />

              <Route path="/dashboard" element={<DashboardPage />} />

              <Route path="/merchants" element={<MerchantsList />} />
              <Route path="/merchants/new" element={<MerchantFormPage />} />
              <Route path="/merchants/:id/edit" element={<MerchantFormPage />} />
              <Route path="/merchants/:id" element={<MerchantDetail />} />
              <Route path="/finance/merchant-reconciliation" element={<MerchantTransactionsList />} />
              <Route path="/finance/merchant-reconciliation/new" element={<MerchantTransactionFormPage />} />
              <Route path="/finance/merchant-reconciliation/:id/edit" element={<MerchantTransactionFormPage />} />
              <Route path="/finance/debts" element={<DebtsList />} />
              <Route path="/finance/payments" element={<PaymentsList />} />
              <Route path="/finance/salary" element={<FinanceSalaryPage />} />
              <Route path="/merchants/partnership-requests" element={<UnderDevelopment />} />

              <Route path="/clients" element={<ClientsList />} />
              <Route path="/clients/new" element={<ClientFormPage />} />
              <Route path="/clients/:id/edit" element={<ClientFormPage />} />
              <Route path="/clients/:id" element={<ClientDetail />} />

              <Route path="/contracts" element={<ContractsList />} />
              <Route path="/contracts/create" element={<CreateContractClientSearch />} />
              <Route path="/contracts/create/form" element={<ContractForm />} />
              <Route path="/contracts/:id" element={<ContractDetail />} />

              <Route path="/products" element={<ProductsList />} />
              <Route path="/products/new" element={<ProductFormPage />} />
              <Route path="/products/:id/edit" element={<ProductFormPage />} />

              <Route path="/settings/platform" element={<PlatformSettingsPage />} />
              <Route path="/settings/home" element={<HomeSettingsPage />} />
              <Route path="/settings/general" element={<SettingsGeneralPage />} />
              <Route path="/settings/positions" element={<PositionsSettingsPage />} />
              <Route path="/settings/experience-levels" element={<ExperienceLevelsSettingsPage />} />
              <Route path="/settings/locations" element={<LocationsSettingsPage />} />
              <Route path="/settings/employment-types" element={<EmploymentTypesSettingsPage />} />
              <Route path="/settings/divisions" element={<DivisionsSettingsPage />} />
              <Route path="/settings/skills" element={<SkillsSettingsPage />} />
              <Route path="/settings/departments" element={<DepartmentsSettingsPage />} />
              <Route path="/settings/compensation" element={<CompensationSettingsPage />} />
              <Route path="/settings/absence-policies" element={<AbsencePoliciesSettingsPage />} />
              <Route path="/settings/holiday-policies" element={<HolidayPoliciesSettingsPage />} />
              <Route path="/settings/holiday-policies/:id" element={<HolidayPolicyDetailPage />} />
              <Route path="/settings/documents" element={<DocumentsSettingsPage />} />
              <Route path="/settings/documents/templates/:id" element={<DocumentTemplateDetailPage />} />
              <Route path="/settings/work-schedules" element={<WorkSchedulesSettingsPage />} />
              <Route path="/settings/probation-policies" element={<ProbationPoliciesSettingsPage />} />
              <Route path="/settings/dismissal-reasons" element={<DismissalReasonsSettingsPage />} />
              <Route path="/settings/dismissal-types" element={<DismissalTypesSettingsPage />} />
              <Route path="/settings/employee-work-reasons" element={<EmployeeWorkChangeReasonsSettingsPage />} />
              <Route path="/settings/property-categories" element={<PropertyCategoriesSettingsPage />} />
              <Route path="/settings/tariffs" element={<TariffsList />} />
              <Route path="/settings/tariffs/new" element={<TariffForm />} />
              <Route path="/settings/tariffs/:id" element={<TariffForm />} />
              <Route path="/settings/product-categories" element={<ProductCategoriesList />} />
              <Route path="/settings/product-categories/new" element={<ProductCategoryForm />} />
              <Route path="/settings/product-categories/:id" element={<ProductCategoryForm />} />
              <Route path="/settings" element={<SettingsPage />} />

              <Route path="/employees" element={<EmployeesList />} />
              <Route path="/employees/new" element={<EmployeeForm />} />
              <Route path="/employees/:id" element={<EmployeeDetail />} />
              <Route path="/employees/:id/edit" element={<EmployeeForm />} />
              <Route path="/calendar" element={<CalendarModule />} />
              <Route path="/time/attendance" element={<TimeAttendancePage />} />
              <Route path="/reports" element={<ReportsHomePage />} />
              <Route path="/reports/age-distribution" element={<AgeDistributionPage />} />
              <Route path="/reports/gender-distribution" element={<GenderDistributionPage />} />
              <Route path="/reports/staff-count" element={<StaffCountPage />} />
              <Route path="/reports/staff-turnover" element={<StaffTurnoverPage />} />
              <Route path="/reports/tenure" element={<TenurePage />} />
              <Route path="/reports/absence-balance" element={<AbsenceBalancePage />} />
              <Route path="/reports/attendance" element={<AttendancePage />} />
              <Route path="/reports/sport-attendance" element={<SportAttendancePage />} />
              <Route path="/reports/payroll" element={<PayrollPage />} />
              <Route path="/reports/bonus-deductions" element={<BonusDeductionsPage />} />

              <Route path="/organization/suppliers" element={<SuppliersList />} />
              <Route path="/organization/suppliers/new" element={<SupplierForm />} />
              <Route path="/organization/suppliers/:id" element={<SupplierForm />} />

              <Route path="/organization/clients" element={<OrganizationClientsList />} />
              <Route path="/organization/clients/new" element={<OrganizationClientForm />} />
              <Route path="/organization/clients/:id" element={<OrganizationClientForm />} />

              <Route path="/organization/agreements" element={<AgreementsList />} />
              <Route path="/organization/agreements/new" element={<AgreementForm />} />
              <Route path="/organization/agreements/:id" element={<AgreementForm />} />

              <Route path="*" element={<Navigate to="/dashboard" replace />} />

            </Route> : <>
              <Route path="/login" element={<SignIn />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </>
          }





          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}


export default observer(App);
