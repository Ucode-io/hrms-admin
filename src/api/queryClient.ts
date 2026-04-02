
import { MutationCache, QueryCache, QueryClient } from "react-query";
import { handleUnauthorizedError } from "./unauthorizedHandler";

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      handleUnauthorizedError(error);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      handleUnauthorizedError(error);
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

export default queryClient;
