import { useQuery, useMutation, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";

const platformSettingService = {
  getList: (params: any) => httpRequest.get('/v2/items/platform_settings', { params }),
  update: (guid: string, data: any) => httpRequest.put(`/v2/items/platform_settings/${guid}`, { data }),
}

export const usePlatformSettingsQuery = ({ querySettings = {} }: { querySettings?: any } = {}) => {
  return useQuery({
    queryKey: ['PLATFORM_SETTINGS'],
    queryFn: () => platformSettingService.getList({}),
    ...querySettings,
  })
}

export const useUpdatePlatformSetting = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guid, data }: { guid: string; data: any }) => platformSettingService.update(guid, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['PLATFORM_SETTINGS']);
    },
  });
}

export default platformSettingService;
