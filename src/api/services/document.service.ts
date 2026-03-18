import { useMutation, useQuery, useQueryClient } from "react-query";
import httpRequest from "../httpRequest";
import encodeJsonToUrlParam from "../../utils/encodeJsonToUrlParam";

const documentService = {
  getList: (params: Record<string, unknown>) => httpRequest.get("/v2/items/documents", { params }),
  getByGuid: (guid: string) => httpRequest.get(`/v2/items/documents/${guid}`),
  create: (data: Record<string, unknown>) => httpRequest.post("/v2/items/documents", { data }),
  delete: async (guid: string) => {
    try {
      return await httpRequest.delete("/v2/items/documents", {
        data: { ids: [guid] },
      });
    } catch {
      return httpRequest.delete(`/v2/items/documents/${guid}`);
    }
  },
};

type DocumentsFilterData = {
  clients_id?: string;
  contracts_id?: string;
  user_base_id?: string;
  document_folders_id?: string;
  [key: string]: unknown;
};

// Get documents list
export const useDocumentsQuery = ({
  data,
  querySettings = {},
}: {
  data: DocumentsFilterData;
  querySettings?: Record<string, unknown>;
}) => {
  return useQuery({
    queryKey: ["documents", data],
    queryFn: () => httpRequest.get(`/v2/items/documents`, { params: { data: encodeJsonToUrlParam(data) } }),
    enabled:
      !!data?.clients_id ||
      !!data?.contracts_id ||
      !!data?.user_base_id ||
      !!data?.document_folders_id,
    ...querySettings,
  });
};

export const useCreateDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) => documentService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["documents"]);
    },
  });
};

export const useDeleteDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (guid: string) => documentService.delete(guid),
    onSuccess: () => {
      queryClient.invalidateQueries(["documents"]);
    },
  });
};

export default documentService;
