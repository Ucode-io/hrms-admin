import { useQuery } from "react-query";
import httpRequest from "../httpRequest";
import encodeJsonToUrlParam from "../../utils/encodeJsonToUrlParam";

const contactService = {
  getList: (data: any) => httpRequest.get('/v2/items/contacts', { params: { data: encodeJsonToUrlParam(data) } }),
  getByGuid: (guid: string) => httpRequest.get(`/v2/items/contacts/${guid}`),
}

export const useContactsQuery = ({ data, querySettings = {} }: { data: any; querySettings?: any }) => {
  return useQuery({
    queryKey: ['CONTACTS', data],
    queryFn: () => contactService.getList(data),
    ...querySettings,
  })
}

export const useContactQuery = ({ guid, querySettings = {} }: { guid: string; querySettings?: any }) => {
  return useQuery({
    queryKey: ['CONTACT', guid],
    queryFn: () => contactService.getByGuid(guid),
    enabled: !!guid,
    ...querySettings,
  })
}

export default contactService;
