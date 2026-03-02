import { useQuery } from 'react-query'
import httpRequest from '../httpRequest'
import encodeJsonToUrlParam from '../../utils/encodeJsonToUrlParam'

const documentService = {
  getList: (params: any) => httpRequest.get('/v2/items/documents', { params }),
  getByGuid: (guid: string) => httpRequest.get(`/v2/items/documents/${guid}`),
}

// Get documents list
export const useDocumentsQuery = ({ data, querySettings = {} }: { data: any, querySettings?: any }) => {
  return useQuery({
    queryKey: ["documents", data],
    queryFn: () => httpRequest.get(`/v2/items/documents`, { params: { data: encodeJsonToUrlParam(data) } }),
    enabled: !!data?.clients_id || !!data?.contracts_id,
    ...querySettings,
  });
};

export default documentService;
