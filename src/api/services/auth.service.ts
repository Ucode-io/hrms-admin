import { useMutation } from "react-query";
import authRequest from "../authRequest";
import httpRequest from "../httpRequest";

interface LoginCredentials {
  username: string;
  password: string;
}

interface TokenData {
  access_token: string;
  refresh_token: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
  refresh_in_seconds: number;
}

interface UserData {
  guid: string;
  login: string;
  role_id: string;
  client_type_id: string;
  user_id_auth: string;
  [key: string]: unknown;
}

interface LoginResponseData {
  token: TokenData;
  user_data: UserData;
  companies_id?: string | null;
}

interface LoginResponse {
  status: string;
  description: string;
  data: LoginResponseData;
}

const toRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

const normalizeUserBaseData = (raw: unknown): UserData | null => {
  const root = toRecord(raw);
  if (!root) return null;

  const candidates = [
    root,
    toRecord(root.response),
    toRecord(root.data),
    toRecord(toRecord(root.data)?.response),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate.guid === "string" || typeof candidate.login === "string") {
      return candidate as UserData;
    }
  }

  return null;
};

const authService = {
  login: async (username: string, password: string): Promise<LoginResponseData> => {
    // Temporary disabled:
    // const response = await axios.post<DefaultLoginResponse>(
    //   "https://api.auth.u-code.io/v3/multicompany/default-login",
    //   { username, password },
    //   { headers: { "Content-Type": "application/json" } }
    // );
    // const token = response.data?.data?.response?.token;
    // const userData = response.data?.data?.response?.user_data;
    // if (!token || !userData) {
    //   throw new Error(response.data?.description || "Не удалось получить данные авторизации.");
    // }
    // return { token, user_data: userData };

    const response = await authRequest.post<LoginResponse>("/v2/login/with-option", {
      login_strategy: "LOGIN_PWD",
      data: {
        client_type_id: "1c435896-2f12-4b61-a684-62ad1d2307d1",
        role_id: "52e5168d-660b-4339-9ec4-9c02ae226345",
        username,
        password,
      },
    });

    return response.data.data;
  },

  logout: () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("refresh_token");
  },
};

export const useLogin = () => {
  return useMutation({
    mutationFn: ({ username, password }: LoginCredentials) =>
      authService.login(username, password),
  });
};

export const getUserBaseById = async (guid: string): Promise<UserData | null> => {
  if (!guid) return null;
  const response = await httpRequest.get(`/v2/items/user_base/${guid}`, {
    params: { with_relations: true },
  });
  return normalizeUserBaseData(response);
};

export default authService;
