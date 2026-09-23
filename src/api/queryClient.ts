import { MutationCache, QueryCache, QueryClient } from "react-query";
import { handleUnauthorizedError } from "./unauthorizedHandler";
import {
  BILLING_STATUS_KEY,
  isBillingReadOnlyError,
  notifyBillingReadOnly,
} from "./billingReadOnly";

// Отказ BILLING_READ_ONLY (сервер или гард в httpRequest) — свой тост вместо
// сырой строки и перезапрос статуса: возможно, уже оплатили.
const handleBillingReadOnlyError = (error: unknown) => {
  if (!isBillingReadOnlyError(error)) return;
  notifyBillingReadOnly();
  void queryClient.invalidateQueries(BILLING_STATUS_KEY);
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      handleUnauthorizedError(error);
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      handleUnauthorizedError(error);
      handleBillingReadOnlyError(error);
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
