import { type PropsWithChildren, useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import authStore from "../../store/auth.store";

function AuthTokenSyncWrapper({ children }: PropsWithChildren) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const authTokenFromUrl = searchParams.get("auth_token");
    const refreshTokenFromUrl = searchParams.get("refresh_token");

    if (!authTokenFromUrl) {
      return;
    }

    authStore.setIsAuth(true);
    authStore.setToken(authTokenFromUrl);
    authStore.setRefreshToken(refreshTokenFromUrl);
    authStore.setUser(null);

    navigate("/", { replace: true });
  }, [location.search, navigate]);

  return <>{children}</>;
}

export default AuthTokenSyncWrapper;
