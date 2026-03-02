import { useQuery } from "react-query";
import httpRequest from "../httpRequest";

const kinshipService = {
  getList: (params?: any) => httpRequest.get('/v2/items/kinship', { params }),
}

export const useKinshipQuery = ({ params, querySettings = {} }: { params?: any; querySettings?: any } = {}) => {
  return useQuery({
    queryKey: ['KINSHIP', params],
    queryFn: () => kinshipService.getList(params),
    ...querySettings,
  })
}

export default kinshipService;
