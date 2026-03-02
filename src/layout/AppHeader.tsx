
import { useSidebar } from "../context/SidebarContext";
import UserDropdown from "../components/header/UserDropdown";
import companyStore from "../store/company.store";
import { observer } from "mobx-react-lite";
import { Plus, Menu, X } from "lucide-react";

const AppHeader: React.FC = () => {
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  return (
    <header className="sticky top-0 flex items-center justify-between w-full h-16 bg-white border-b border-gray-200 px-4 lg:px-6 z-40">
      {/* Left: Mobile hamburger */}
      <div className="flex items-center gap-3">
        <button
          className="flex items-center justify-center w-10 h-10 text-gray-500 rounded-lg hover:bg-gray-100 lg:hidden transition-colors"
          onClick={handleToggle}
          aria-label="Toggle Sidebar"
        >
          {isMobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        {/* Mobile logo */}
        <a href="/dashboard" className="lg:hidden">
          <img
            src={companyStore.logo}
            alt={companyStore.companyName}
            className="h-8 w-8 object-contain"
          />
        </a>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Quick Add Button */}
        <button className="hidden sm:flex items-center gap-2 h-10 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
          <Plus size={18} className="text-gray-500" />
          <span>Быстрое добавление</span>
        </button>

        {/* Mobile Quick Add */}
        <button className="flex sm:hidden items-center justify-center h-10 w-10 rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition-colors shadow-sm">
          <Plus size={18} />
        </button>

        {/* User Dropdown */}
        <UserDropdown />
      </div>
    </header>
  );
};

export default observer(AppHeader);
