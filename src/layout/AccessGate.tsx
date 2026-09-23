import { useEffect } from "react";
import { toast } from "sonner";
import { useCurrentUserAccess } from "../api/services/role.service";
import authStore from "../store/auth.store";
import companyStore from "../store/company.store";
import { useTranslation } from "../i18n";


/**
 * Global access gate. A logged-in user must have a role with at least one
 * enabled module. If the backend confirms they have NO role (or a role with zero
 * modules), we toast "У вас нет доступа" and log them out immediately — the toast
 * lives in the app-root <Toaster> (outside the auth boundary), so it stays
 * visible on the sign-in screen after logout.
 *
 * While the access query is doing its FIRST load we show a full-screen loader,
 * so the sidebar never flashes every module before the role resolves.
 *
 * Fail-open on error: we only block (loader) while actively loading and only
 * deny on a SUCCESSFUL "no access" response — a not-yet-created table / undeployed
 * backend falls through to the app instead of locking everyone out.
 */
export default function AccessGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { data, isSuccess, isLoading } = useCurrentUserAccess();

  const denied =
    isSuccess && !!data && (!data.role || data.modules.length === 0);

  useEffect(() => {
    if (!denied) return;
    toast.error(t("access.no_access"));
    authStore.logout();
  }, [denied, t]);

  // First load of the access check — hold the whole app behind a loader so the
  // sidebar/routes don't render with "full access" before the role arrives.
  if (isLoading) {
    const color = companyStore.mainColor || "#465fff";
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <span
            className="h-10 w-10 animate-spin rounded-full border-[3px] border-gray-200"
            style={{ borderTopColor: color }}
          />
          <span className="text-sm text-gray-400">{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  // While denied, the logout above flips isAuth and the app swaps to the
  // sign-in screen on the next tick — render nothing in the meantime.
  if (denied) return null;

  return <>{children}</>;
}
