import { Link, useLocation } from "react-router";
import { Lock } from "lucide-react";
import { useCurrentUserAccess } from "../api/services/role.service";
import {
  firstAllowedPath,
  getModuleLabel,
  getPathModule,
} from "../modules/Settings/Roles/moduleCatalog";

/**
 * Route-level access guard. Same non-breaking policy as the sidebar: a user with
 * NO assigned role (or a global admin) keeps full access; only an explicitly
 * assigned company role restricts. When the current path belongs to a module the
 * role lacks, we show a "no access" panel instead of the page.
 *
 * Frontend-only (advisory) — it hides navigation, it does not secure the API.
 */
export default function AccessGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const location = useLocation();
  const { data: access, isLoading } = useCurrentUserAccess();

  const roleRestricts = Boolean(access?.role) && !access?.role?.isGlobal;

  // Optimistic while the access query is resolving (matches the non-breaking
  // default of "allow"); only a loaded, restrictive role can block.
  if (isLoading || !roleRestricts) {
    return <>{children}</>;
  }

  const allowedModules = access?.modules ?? [];
  const owningModule = getPathModule(location.pathname);

  // Path claimed by a module the role does not include → block.
  if (owningModule && !allowedModules.includes(owningModule)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <Lock size={22} />
          </span>
          <h2 className="text-lg font-semibold text-gray-900">
            Нет доступа к разделу
          </h2>
          <p className="mt-1.5 text-sm text-gray-500">
            У вашей роли нет доступа к модулю «{getModuleLabel(owningModule)}».
            Обратитесь к администратору, если доступ вам необходим.
          </p>
          <Link
            to={firstAllowedPath(allowedModules)}
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
          >
            Перейти в доступный раздел
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
