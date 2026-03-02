import { useMutation } from "react-query";
import axios from "axios";
import authStore from "../../store/auth.store";

const CDN_BASE = "https://cdn.u-code.io";
const UPLOAD_URL = "https://api.admin.u-code.io/v1/files/folder_upload";

const ENVIRONMENT_ID = "75643e1b-4557-4626-a754-ffe7a86f4008";
const RESOURCE_ID = "2176584d-aa13-4c32-8ae7-3f056b71ece6";

/**
 * Upload a file to the CDN.
 * Returns the full public URL: https://cdn.u-code.io/<link>
 */
export function useUploadFile(options: { folder?: string; format?: string } = {}) {
  const { folder = "Media", format = "" } = options;

  return useMutation(async (file: File): Promise<string> => {
    const token = authStore.token;

    const params: Record<string, string> = { folder_name: folder };
    if (format) params["format"] = format;

    const formData = new FormData();
    formData.append("file", file);

    const res = await axios.post(UPLOAD_URL, formData, {
      params,
      headers: {
        Authorization: `Bearer ${token}`,
        "environment-id": ENVIRONMENT_ID,
        "Resource-Id": RESOURCE_ID,
        // Let the browser set Content-Type with boundary automatically
      },
    });

    const link: string = res.data?.data?.link;
    if (!link) throw new Error("Upload failed: no link returned");

    return `${CDN_BASE}/${link}`;
  });
}
