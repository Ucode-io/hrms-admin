import authStore from "../store/auth.store";

type MaybeAxiosLikeError = {
  response?: {
    status?: number;
  };
};

export const isUnauthorizedError = (error: unknown): boolean => {
  const status = (error as MaybeAxiosLikeError | undefined)?.response?.status;
  return status === 401;
};

export const handleUnauthorizedError = (error: unknown): void => {
  if (!isUnauthorizedError(error)) {
    return;
  }

  authStore.logout();
};

