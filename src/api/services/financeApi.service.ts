import httpRequest from "../httpRequest";
import { useMutation, useQuery } from "react-query";

interface UserSearchResponse {
  data: UserData[];
  success: boolean;
  total: number;
}

interface UserData {
  guid: string;
  first_name: string;
  second_name: string;
  middle_name: string | null;
  phone_number: string;
  status: string;
  available_installment: number;
  limit_amount: number | null;
  total_debt: number;
}

const financeApiService = {
  userSearch: async (phone: string): Promise<UserSearchResponse> => {
    const response = await httpRequest.post(
      "v2/invoke_function/ayva-finance-ayva-finance",
      {
        data: {
          method: "user_search",
          object_data: {
            phone: phone,
          },
        },
      }
    );
    return response as unknown as UserSearchResponse;
  },

  userInvite: async (phone: string): Promise<any> => {
    const response = await httpRequest.post(
      "v2/invoke_function/ayva-finance-ayva-finance",
      {
        data: {
          method: "user_invite",
          object_data: {
            phone: phone,
          },
        },
      }
    );
    return response;
  },
};

export const useUserSearch = () => {
  return useMutation({
    mutationFn: (phone: string) => financeApiService.userSearch(phone),
  });
};

export const useUserInvite = () => {
  return useMutation({
    mutationFn: (phone: string) => financeApiService.userInvite(phone),
  });
};

export const useUserSearchQuery = (phone: string, enabled = false) => {
  return useQuery({
    queryKey: ["userSearch", phone],
    queryFn: () => financeApiService.userSearch(phone),
    enabled,
  });
};

export default financeApiService;

