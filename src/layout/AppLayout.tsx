import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { HeaderBreadcrumbProvider } from "../context/HeaderBreadcrumbContext";
import { Outlet } from "react-router";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";
import AccessGuard from "./AccessGuard";
import AccessGate from "./AccessGate";
import { CopilotDock } from "../features/copilot";
import BillingBanner from "./BillingBanner";

const LayoutContent: React.FC = () => {
  const { isExpanded, isMobileOpen } = useSidebar();

  return (
    <div className="min-h-screen xl:flex">
      <div>
        <AppSidebar />
        <Backdrop />
      </div>
      <div
        className={`flex-1 min-w-0 flex flex-col transition-all duration-300 ease-in-out ${isExpanded ? "lg:ml-[290px]" : "lg:ml-[90px]"
          } ${isMobileOpen ? "ml-0" : ""}`}
      >
        <AppHeader />
        <BillingBanner />
        {/* overflow-x-clip (не hidden): hidden создаёт scroll-контейнер и ломает position: sticky у вложенных тулбаров */}
        <div className="p-3 md:p-4 overflow-x-clip flex-1 w-full">
          <AccessGuard>
            <Outlet />
          </AccessGuard>
        </div>
      </div>
      {/* Third flex child: the dock shrinks the content column instead of
          covering it, so the page being asked about stays readable. */}
      <CopilotDock />
    </div>
  );
};

const AppLayout: React.FC = () => {
  return (
    <SidebarProvider>
      <HeaderBreadcrumbProvider>
        <AccessGate>
          <LayoutContent />
        </AccessGate>
      </HeaderBreadcrumbProvider>
    </SidebarProvider>
  );
};

export default AppLayout;
