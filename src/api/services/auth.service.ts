import { useMutation } from "react-query";
import authRequest from "../authRequest";

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
  [key: string]: any;
}

interface LoginResponseData {
  user_found: boolean;
  user_id: string;
  token: TokenData;
  user_data: UserData;
  sessions?: any[];
}

interface LoginResponse {
  status: string;
  description: string;
  data: LoginResponseData;
}

const authService = {
  login: async (username: string, password: string): Promise<LoginResponseData> => {
    const response = await authRequest.post<LoginResponse>("/v2/login/with-option", {
      login_strategy: "LOGIN_PWD",
      data: {
        client_type_id: "1c435896-2f12-4b61-a684-62ad1d2307d1",
        role_id: "c2b3ae65-07a4-4ed3-8efa-62224274f841",
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

export default authService;
