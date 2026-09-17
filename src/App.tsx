import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import SignIn from "./pages/AuthPages/SignIn";
import LandingPage from "./pages/Landing";
import NotFound from "./pages/OtherPage/NotFound";
import UnderDevelopment from "./pages/OtherPage/UnderDevelopment";
import DashboardPage from "./modules/Dashboard";
import ChatsPage from "./modules/Chats";
import NotificationsPage from "./modules/Notifications";
import NewsFormPage from "./modules/Notifications/Form";
import MerchantsList from "./modules/Merchant/List";
import MerchantDetail from "./modules/Merchant/Detail";
import MerchantFormPage from "./modules/Merchant/Form";
import MerchantTransactionsList from "./modules/MerchantTransactions/List";
import MerchantTransactionFormPage from "./modules/MerchantTransactions/Form";
import DebtsList from "./modules/Debts/List";
import PaymentsList from "./modules/Payments/List";
import FinanceSalaryPage from "./modules/Finance/Salary";
import KpiPage from "./modules/KPI";
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
import BotNotificationsSettingsPage from "./modules/Settings/BotNotifications";
import CareerSiteSettingsPage from "./modules/Settings/CareerSite";
import CustomFieldsSettingsPage from "./modules/Settings/CustomFields";
import TaskDirectoriesSettingsPage from "./modules/Settings/TaskDirectories";
import HomeSettingsPage from "./modules/Settings/Home";
import PositionsSettingsPage from "./modules/Settings/Positions";
import ExperienceLevelsSettingsPage from "./modules/Settings/ExperienceLevels";
import GradeMatrixSettingsPage from "./modules/Settings/GradeMatrix";
import TasksPage from "./modules/Tasks";
import BudgetingPage from "./modules/Budgeting";
import SurveysPage from "./modules/Surveys";
import SurveyEditorPage from "./modules/Surveys/Editor";
import SurveyDetailPage from "./modules/Surveys/Detail";
import TrainingsPage from "./modules/Trainings";
import TrainingEditorPage from "./modules/Trainings/Editor";
import TrainingDetailPage from "./modules/Trainings/Detail";
import EmploymentTypesSettingsPage from "./modules/Settings/EmploymentTypes";
import DivisionsSettingsPage from "./modules/Settings/Divisions";
import SkillsSettingsPage from "./modules/Settings/Skills";
import DepartmentsSettingsPage from "./modules/Settings/Departments";
import LocationsSettingsPage from "./modules/Settings/Locations";
import CompensationSettingsPage from "./modules/Settings/Compensation";
import AbsencePoliciesSettingsPage from "./modules/Settings/AbsencePolicies";
import HolidayPoliciesSettingsPage from "./modules/Settings/HolidayPolicies";
import HolidayPolicyDetailPage from "./modules/Settings/HolidayPolicies/Detail";
import ApprovalsSettingsPage from "./modules/Settings/Approvals";
import ApprovalProcessDetailPage from "./modules/Settings/Approvals/Detail";
import DocumentsSettingsPage from "./modules/Settings/Documents";
import CreateDocumentTemplatePage from "./modules/Settings/Documents/TemplateCreate";
import WorkSchedulesSettingsPage from "./modules/Settings/WorkSchedules";
import AttendancePenaltiesSettingsPage from "./modules/Settings/AttendancePenalties";
import ProbationPoliciesSettingsPage from "./modules/Settings/ProbationPolicies";
import DismissalReasonsSettingsPage from "./modules/Settings/DismissalReasons";
import RejectionReasonsSettingsPage from "./modules/Settings/RejectionReasons";
import CandidateSourcesSettingsPage from "./modules/Settings/CandidateSources";
import DismissalTypesSettingsPage from "./modules/Settings/DismissalTypes";
import EmployeeWorkChangeReasonsSettingsPage from "./modules/Settings/EmployeeWorkChangeReasons";
import PropertyCategoriesSettingsPage from "./modules/Settings/PropertyCategories";
import HickvisionIntegrationSettingsPage from "./modules/Settings/Integrations/Hickvision";
import TimeDoctorIntegrationSettingsPage from "./modules/Settings/Integrations/TimeDoctor";
import TariffsList from "./modules/Settings/Tariffs/List";
import TariffForm from "./modules/Settings/Tariffs/Form";
import ProductCategoriesList from "./modules/Settings/ProductCategories/List";
import ProductCategoryForm from "./modules/Settings/ProductCategories/Form";
import SettingsLayout from "./modules/Settings/SettingsLayout";
import RolesSettingsPage from "./modules/Settings/Roles";
import EmployeesList from "./modules/Employees/List";
import EmployeeDetail from "./modules/Employees/Detail";
import EmployeeForm from "./modules/Employees/Form";
import EmployeeGenerateDocumentFromTemplatePage from "./modules/Employees/Detail/components/document-generation/GenerateFromTemplatePage";
import DocumentsPage from "./modules/Documents";
import KnowledgeBaseList from "./modules/KnowledgeBase/List";
import KnowledgeBaseArticle from "./modules/KnowledgeBase/Article";
import PropertyList from "./modules/Property/List";
import PropertyForm from "./modules/Property/Form";
import TimeModule from "./modules/Time";
import TimeTrackingModule from "./modules/TimeTracking";
import TimesheetPage from "./modules/Timesheet";
import ShiftsPage from "./modules/Shifts";
import TimesheetDayPage from "./modules/Timesheet/DayPage";
import ReportsHomePage from "./modules/Reports";
import AgeDistributionPage from "./modules/Reports/AgeDistribution";
import BirthdaysPage from "./modules/Reports/Birthdays";
import GenderDistributionPage from "./modules/Reports/GenderDistribution";
import StaffCountPage from "./modules/Reports/StaffCount";
import StaffTurnoverPage from "./modules/Reports/StaffTurnover";
import TenurePage from "./modules/Reports/Tenure";
import AbsenceBalancePage from "./modules/Reports/AbsenceBalance";
import AttendancePage from "./modules/Reports/Attendance";
import LatenessPage from "./modules/Reports/Lateness";
import TasksReportPage from "./modules/Reports/Tasks";
import TimesheetReportPage from "./modules/Reports/Timesheet";
import SportAttendancePage from "./modules/Reports/SportAttendance";
import BonusDeductionsPage from "./modules/Reports/BonusDeductions";
import RecruitingFunnelPage from "./modules/Reports/RecruitingFunnel";
import RecruitingSourcesPage from "./modules/Reports/RecruitingSources";
import RecruitingClosureTimesPage from "./modules/Reports/RecruitingClosureTimes";
import SuppliersList from "./modules/Suppliers/List";
import SupplierForm from "./modules/Suppliers/Form";
import OrganizationClientsList from "./modules/Clients/List";
import OrganizationClientForm from "./modules/Clients/Form";
import AgreementsList from "./modules/Agreements/List";
import AgreementForm from "./modules/Agreements/Form";
import OrganizationStructureModule from "./modules/Organization/Structure";
import VacanciesList from "./modules/Recruiting/Vacancies/List";
import VacancyForm from "./modules/Recruiting/Vacancies/Form";
import VacancyDetail from "./modules/Recruiting/Vacancies/Detail";
import CandidatesList from "./modules/Recruiting/Candidates/List";
import CandidateForm from "./modules/Recruiting/Candidates/Form";
import CandidateDetail from "./modules/Recruiting/Candidates/Detail";
import StageTemplatesPage from "./modules/Recruiting/StageTemplates";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import AuthTokenSyncWrapper from "./components/common/AuthTokenSyncWrapper";
import { QueryClientProvider } from "react-query";
import queryClient from "./api/queryClient";
import authStore from "./store/auth.store";
import companyStore from "./store/company.store";
import CompanyThemeProvider from "./components/common/CompanyThemeProvider";
import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";
import { Toaster } from "sonner";
import { getUserBaseById } from "./api/services/auth.service";

function App() {
  const lastSyncedUserKeyRef = useRef("");
  const isAuth = authStore.isAuth;
  const token = authStore.token;
  const companyId = authStore.companyId;
  const authUserGuid = authStore.user_data?.guid || authStore.user?.guid;
  const isLocalPenaltyPreview =
    import.meta.env.DEV &&
    window.location.pathname === "/settings/attendance-penalties" &&
    new URLSearchParams(window.location.search).get("preview") === "1";
  const canEnterApp = isAuth || isLocalPenaltyPreview;

  useEffect(() => {
    if (!isAuth) {
      companyStore.setStaticLoginCompanyConfig();
      return;
    }
    void companyStore.fetchCompany(companyId);
  }, [isAuth, companyId]);

  useEffect(() => {
    if (!isAuth || !token || !authUserGuid) {
      lastSyncedUserKeyRef.current = "";
      return;
    }

    const syncKey = `${token}:${authUserGuid}`;
    if (lastSyncedUserKeyRef.current === syncKey) return;
    lastSyncedUserKeyRef.current = syncKey;

    let isCancelled = false;

    void (async () => {
      try {
        const freshUserData = await getUserBaseById(authUserGuid);
        if (isCancelled || !freshUserData) return;
        authStore.setUser(freshUserData);
      } catch (error) {
        console.error("Failed to refresh auth user data:", error);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [isAuth, token, authUserGuid]);

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
        <AuthTokenSyncWrapper>
          <ScrollToTop />
          <Routes>
          {/* Dashboard Layout */}
          {
            canEnterApp ? <Route path="/" element={<AppLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />

              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/news" element={<Navigate to="/settings/news" replace />} />
              <Route path="/news/new" element={<NewsFormPage />} />
              <Route path="/news/:id/edit" element={<NewsFormPage />} />
              <Route path="/notifications" element={<Navigate to="/settings/news" replace />} />

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
              <Route path="/kpi" element={<KpiPage />} />
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

              <Route path="/settings" element={<SettingsLayout />}>
                <Route path="platform" element={<PlatformSettingsPage />} />
                <Route path="home" element={<HomeSettingsPage />} />
                <Route path="general" element={<SettingsGeneralPage />} />
                <Route path="notifications" element={<BotNotificationsSettingsPage />} />
                <Route path="career-site" element={<CareerSiteSettingsPage />} />
                <Route path="custom-fields" element={<CustomFieldsSettingsPage />} />
                <Route path="task-directories" element={<TaskDirectoriesSettingsPage />} />
                <Route path="positions" element={<PositionsSettingsPage />} />
                <Route path="experience-levels" element={<ExperienceLevelsSettingsPage />} />
                <Route path="grade-salaries" element={<GradeMatrixSettingsPage />} />
                <Route path="locations" element={<LocationsSettingsPage />} />
                <Route path="employment-types" element={<EmploymentTypesSettingsPage />} />
                <Route path="divisions" element={<DivisionsSettingsPage />} />
                <Route path="skills" element={<SkillsSettingsPage />} />
                <Route path="roles" element={<RolesSettingsPage />} />
                <Route path="departments" element={<DepartmentsSettingsPage />} />
                <Route path="compensation" element={<CompensationSettingsPage />} />
                <Route path="absence-policies" element={<AbsencePoliciesSettingsPage />} />
                <Route path="holiday-policies" element={<HolidayPoliciesSettingsPage />} />
                <Route path="holiday-policies/:id" element={<HolidayPolicyDetailPage />} />
                <Route path="approvals" element={<ApprovalsSettingsPage />} />
                <Route path="approvals/new" element={<ApprovalProcessDetailPage />} />
                <Route path="approvals/:id" element={<ApprovalProcessDetailPage />} />
                <Route path="documents" element={<DocumentsSettingsPage />} />
                <Route path="documents/templates/new" element={<CreateDocumentTemplatePage />} />
                <Route path="documents/templates/:id/edit" element={<CreateDocumentTemplatePage />} />
                <Route path="documents/templates/:id" element={<CreateDocumentTemplatePage />} />
                <Route path="work-schedules" element={<WorkSchedulesSettingsPage />} />
                <Route path="attendance-penalties" element={<AttendancePenaltiesSettingsPage />} />
                <Route path="probation-policies" element={<ProbationPoliciesSettingsPage />} />
                <Route path="dismissal-reasons" element={<DismissalReasonsSettingsPage />} />
                <Route path="dismissal-types" element={<DismissalTypesSettingsPage />} />
                <Route path="employee-work-reasons" element={<EmployeeWorkChangeReasonsSettingsPage />} />
                <Route path="property-categories" element={<PropertyCategoriesSettingsPage />} />
                <Route path="integrations/hickvision" element={<HickvisionIntegrationSettingsPage />} />
                <Route path="integrations/timedoctor" element={<TimeDoctorIntegrationSettingsPage />} />
                <Route path="tariffs" element={<TariffsList />} />
                <Route path="tariffs/new" element={<TariffForm />} />
                <Route path="tariffs/:id" element={<TariffForm />} />
                <Route path="product-categories" element={<ProductCategoriesList />} />
                <Route path="product-categories/new" element={<ProductCategoryForm />} />
                <Route path="product-categories/:id" element={<ProductCategoryForm />} />
                <Route path="news" element={<NotificationsPage />} />
                <Route path="news/new" element={<NewsFormPage />} />
                <Route path="news/:id/edit" element={<NewsFormPage />} />
                <Route path="stage-templates" element={<StageTemplatesPage />} />
                <Route path="rejection-reasons" element={<RejectionReasonsSettingsPage />} />
                <Route path="candidate-sources" element={<CandidateSourcesSettingsPage />} />
              </Route>

              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/budgeting" element={<BudgetingPage />} />

              <Route path="/surveys" element={<SurveysPage />} />
              <Route path="/surveys/new" element={<SurveyEditorPage />} />
              <Route path="/surveys/:id" element={<SurveyDetailPage />} />
              <Route path="/surveys/:id/edit" element={<SurveyEditorPage />} />

              <Route path="/trainings" element={<TrainingsPage />} />
              <Route path="/trainings/new" element={<TrainingEditorPage />} />
              <Route path="/trainings/:id" element={<TrainingDetailPage />} />
              <Route path="/trainings/:id/edit" element={<TrainingEditorPage />} />

              <Route path="/chats" element={<ChatsPage />} />

              <Route path="/employees" element={<EmployeesList />} />
              <Route path="/employees/new" element={<EmployeeForm />} />
              <Route path="/employees/:id" element={<EmployeeDetail />} />
              <Route path="/employees/:id/edit" element={<EmployeeForm />} />
              <Route path="/employees/:id/documents/generate/:templateId" element={<EmployeeGenerateDocumentFromTemplatePage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/knowledge-base" element={<KnowledgeBaseList />} />
              <Route path="/knowledge-base/articles/:articleId" element={<KnowledgeBaseArticle />} />
              <Route path="/property" element={<PropertyList />} />
              <Route path="/property/new" element={<PropertyForm />} />
              <Route path="/property/:id/edit" element={<PropertyForm />} />
              <Route path="/documents/generate/:templateId" element={<EmployeeGenerateDocumentFromTemplatePage />} />
              <Route path="/time" element={<TimeModule />} />
              <Route path="/time-tracking" element={<TimeTrackingModule />} />
              <Route path="/timesheet" element={<TimesheetPage />} />
              <Route path="/shifts" element={<ShiftsPage />} />
              <Route path="/timesheet/:employeeId/:date" element={<TimesheetDayPage />} />
              <Route path="/calendar" element={<Navigate to="/time?view=calendar" replace />} />
              <Route path="/time/attendance" element={<Navigate to="/time?view=attendance" replace />} />
              <Route path="/reports" element={<ReportsHomePage />} />
              <Route path="/reports/age-distribution" element={<AgeDistributionPage />} />
              <Route path="/reports/birthdays" element={<BirthdaysPage />} />
              <Route path="/reports/gender-distribution" element={<GenderDistributionPage />} />
              <Route path="/reports/staff-count" element={<StaffCountPage />} />
              <Route path="/reports/staff-turnover" element={<StaffTurnoverPage />} />
              <Route path="/reports/tenure" element={<TenurePage />} />
              <Route path="/reports/absence-balance" element={<AbsenceBalancePage />} />
              <Route path="/reports/attendance" element={<AttendancePage />} />
              <Route path="/reports/lateness" element={<LatenessPage />} />
              <Route path="/reports/tasks" element={<TasksReportPage />} />
              <Route path="/reports/timesheet" element={<TimesheetReportPage />} />
              <Route path="/reports/sport-attendance" element={<SportAttendancePage />} />
              <Route path="/reports/bonus-deductions" element={<BonusDeductionsPage />} />
              <Route path="/reports/recruiting-funnel" element={<RecruitingFunnelPage />} />
              <Route path="/reports/recruiting-sources" element={<RecruitingSourcesPage />} />
              <Route path="/reports/recruiting-closure-times" element={<RecruitingClosureTimesPage />} />

              <Route path="/organization/suppliers" element={<SuppliersList />} />
              <Route path="/organization/suppliers/new" element={<SupplierForm />} />
              <Route path="/organization/suppliers/:id" element={<SupplierForm />} />

              <Route path="/organization/clients" element={<OrganizationClientsList />} />
              <Route path="/organization/clients/new" element={<OrganizationClientForm />} />
              <Route path="/organization/clients/:id" element={<OrganizationClientForm />} />

              <Route path="/organization/agreements" element={<AgreementsList />} />
              <Route path="/organization/agreements/new" element={<AgreementForm />} />
              <Route path="/organization/agreements/:id" element={<AgreementForm />} />
              <Route path="/organization/structure" element={<OrganizationStructureModule />} />

              <Route path="/recruiting" element={<Navigate to="/recruiting/vacancies" replace />} />
              <Route path="/recruiting/vacancies" element={<VacanciesList />} />
              <Route path="/recruiting/vacancies/new" element={<VacancyForm />} />
              <Route path="/recruiting/vacancies/:id" element={<VacancyDetail />} />
              <Route path="/recruiting/vacancies/:id/edit" element={<VacancyForm />} />
              <Route path="/recruiting/candidates" element={<CandidatesList />} />
              <Route path="/recruiting/candidates/new" element={<CandidateForm />} />
              <Route path="/recruiting/candidates/:id" element={<CandidateDetail />} />
              <Route path="/recruiting/candidates/:id/edit" element={<CandidateForm />} />
              <Route path="/recruiting/settings/stage-templates" element={<Navigate to="/settings/stage-templates" replace />} />

              <Route path="*" element={<Navigate to="/dashboard" replace />} />

            </Route> : <>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<SignIn />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          }





          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthTokenSyncWrapper>
      </Router>
    </QueryClientProvider>
  );
}


export default observer(App);
