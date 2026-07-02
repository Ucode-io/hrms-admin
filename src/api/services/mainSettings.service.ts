import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";

export const COMPANY_ID = "0de6b2b6-0777-4184-a620-aca70c294111";

export interface MainSettings {
  guid: string;
  companies_id: string;
  show_absences_widget: boolean;
  show_anniversaries_widget: boolean;
  show_birthdays_widget: boolean;
  show_business_absences: boolean;
  show_new_hires_widget: boolean;
  lateness_penalty_coefficient?: number;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export type MainSettingsPayload = {
  show_absences_widget: boolean;
  show_anniversaries_widget: boolean;
  show_birthdays_widget: boolean;
  show_business_absences: boolean;
  show_new_hires_widget: boolean;
  lateness_penalty_coefficient: number;
};

export type MainSettingsSaveData = MainSettingsPayload & Partial<MainSettings>;

const mainSettingsService = {
  get: async (): Promise<MainSettings | null> => {
    const res = await httpRequest.get("/v2/items/main_settings", {
      params: { limit: 1, offset: 0 },
    });

    const list = Array.isArray(res?.response)
      ? (res.response as MainSettings[])
      : [];

    return list[0] || null;
  },

  save: async ({
    guid,
    data,
  }: {
    guid?: string | null;
    data: MainSettingsSaveData;
  }) => {
    if (guid) {
      const res = await httpRequest.put(`/v2/items/main_settings/${guid}`, { data });
      return res?.response as MainSettings;
    }

    const res = await httpRequest.post("/v2/items/main_settings", {
      data: {
        ...data,
        companies_id: COMPANY_ID,
      },
    });

    return res?.response as MainSettings;
  },
};

export const useMainSettingsQuery = () => {
  return useQuery({
    queryKey: ["MAIN_SETTINGS"],
    queryFn: mainSettingsService.get,
  });
};

export const useSaveMainSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { guid?: string | null; data: MainSettingsSaveData }) =>
      mainSettingsService.save(payload),
    onSuccess: () => {
      queryClient.invalidateQueries(["MAIN_SETTINGS"]);
    },
  });
};

export default mainSettingsService;
