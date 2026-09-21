import { useMutation } from "react-query";
import axios from "axios";
import authStore from "../../store/auth.store";
import { retryWithFreshToken } from "../unauthorizedHandler";

const CDN_BASE = "https://cdn.u-code.io";
const UPLOAD_URL = "https://api.admin.u-code.io/v1/files/folder_upload";

const ENVIRONMENT_ID = "75643e1b-4557-4626-a754-ffe7a86f4008";
const RESOURCE_ID = "2176584d-aa13-4c32-8ae7-3f056b71ece6";

// Свой инстанс, а не голый axios: нужен повтор с обновлённым токеном на 401.
// Интерцепторы с companies_id тут не к месту — тело это FormData, они его
// развернут в обычный объект и файл потеряется.
const uploadRequest = axios.create();

uploadRequest.interceptors.request.use((config) => {
  const token = authStore.token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

uploadRequest.interceptors.response.use(
  (response) => response,
  retryWithFreshToken(uploadRequest)
);

/**
 * Upload a file to the CDN (plain async function, usable outside React).
 * Returns the full public URL: https://cdn.u-code.io/<link>
 */
export async function uploadFileToCdn(
  file: File,
  options: { folder?: string; format?: string } = {}
): Promise<string> {
  const { folder = "Media", format = "" } = options;

  const params: Record<string, string> = { folder_name: folder };
  if (format) params["format"] = format;

  const formData = new FormData();
  formData.append("file", file);

  const res = await uploadRequest.post(UPLOAD_URL, formData, {
    params,
    headers: {
      "environment-id": ENVIRONMENT_ID,
      "Resource-Id": RESOURCE_ID,
      // Let the browser set Content-Type with boundary automatically
    },
  });

  const link: string = res.data?.data?.link;
  if (!link) throw new Error("Upload failed: no link returned");

  return `${CDN_BASE}/${link}`;
}

/**
 * Upload a file to the CDN.
 * Returns the full public URL: https://cdn.u-code.io/<link>
 */
export function useUploadFile(options: { folder?: string; format?: string } = {}) {
  return useMutation((file: File) => uploadFileToCdn(file, options));
}
