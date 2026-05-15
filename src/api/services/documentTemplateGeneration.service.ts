import axios from "axios";
import authStore from "../../store/auth.store";
import { handleUnauthorizedError } from "../unauthorizedHandler";

const REPORTS_BASE_URL = "https://api.admin.u-code.io";
const REPORTS_FUNCTION_PATH =
  "/v2/invoke_function/udevs-hrms-reports?project-id=9a462573-ce11-4288-928a-a6ba754b6998";

const EXTRACT_TEMPLATE_VARIABLES_METHOD = "extract_docx_template_variables";
const GENERATE_DOCX_TEMPLATE_DOCUMENT_METHOD = "generate_docx_template_document";

type JsonRecord = Record<string, unknown>;

export type ExtractDocxTemplateVariablesInvokeResponse = {
  method: typeof EXTRACT_TEMPLATE_VARIABLES_METHOD;
  result: {
    variables: string[];
    count: number;
  };
};

export type GenerateDocxTemplateDocumentInvokeResponse = {
  method: typeof GENERATE_DOCX_TEMPLATE_DOCUMENT_METHOD;
  result: {
    file_name: string;
    mime_type: string;
    file_base64: string;
  };
};

const reportsRequest = axios.create({
  baseURL: REPORTS_BASE_URL,
  timeout: 100_000,
  headers: {
    "Content-Type": "application/json",
  },
});

reportsRequest.interceptors.request.use((config) => {
  const token = authStore.token ?? localStorage.getItem("auth_token");
  const companyId =
    authStore.companyId ??
    (typeof authStore.user_data?.companies_id === "string" ? authStore.user_data.companies_id : null) ??
    (typeof authStore.user?.companies_id === "string" ? authStore.user.companies_id : null);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (
    companyId &&
    typeof config.url === "string" &&
    config.url.includes("/v2/invoke_function/") &&
    config.data &&
    typeof config.data === "object" &&
    !Array.isArray(config.data)
  ) {
    const requestBody = { ...(config.data as Record<string, unknown>) };
    const gatewayPayload =
      requestBody.data && typeof requestBody.data === "object" && !Array.isArray(requestBody.data)
        ? { ...(requestBody.data as Record<string, unknown>) }
        : {};
    const methodData =
      gatewayPayload.data && typeof gatewayPayload.data === "object" && !Array.isArray(gatewayPayload.data)
        ? { ...(gatewayPayload.data as Record<string, unknown>) }
        : {};

    if (typeof gatewayPayload.companies_id !== "string" || !gatewayPayload.companies_id.trim()) {
      gatewayPayload.companies_id = companyId;
    }
    if (typeof methodData.companies_id !== "string" || !methodData.companies_id.trim()) {
      methodData.companies_id = companyId;
    }

    gatewayPayload.data = methodData;
    requestBody.data = gatewayPayload;
    config.data = requestBody;
  }

  return config;
});

reportsRequest.interceptors.response.use(
  (response) => response,
  (error) => {
    handleUnauthorizedError(error);
    return Promise.reject(error);
  }
);

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null;

const extractGatewayPayload = (raw: unknown): unknown => {
  if (!isRecord(raw)) return null;

  if (typeof raw.server_error === "string" && raw.server_error.trim()) {
    throw new Error(raw.server_error);
  }

  if (isRecord(raw.data) && typeof raw.data.server_error === "string" && raw.data.server_error.trim()) {
    throw new Error(raw.data.server_error);
  }

  if (isRecord(raw.data) && isRecord(raw.data.data)) {
    return raw.data.data;
  }

  return raw.data;
};

const assertExtractVariablesResponse = (
  value: unknown
): ExtractDocxTemplateVariablesInvokeResponse => {
  if (
    !isRecord(value) ||
    value.method !== EXTRACT_TEMPLATE_VARIABLES_METHOD ||
    !isRecord(value.result) ||
    !Array.isArray(value.result.variables)
  ) {
    throw new Error("Unexpected response format for extract_docx_template_variables");
  }

  return {
    method: EXTRACT_TEMPLATE_VARIABLES_METHOD,
    result: {
      variables: value.result.variables
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
      count: Number(value.result.count || 0),
    },
  };
};

const assertGenerateResponse = (
  value: unknown
): GenerateDocxTemplateDocumentInvokeResponse => {
  if (
    !isRecord(value) ||
    value.method !== GENERATE_DOCX_TEMPLATE_DOCUMENT_METHOD ||
    !isRecord(value.result)
  ) {
    throw new Error("Unexpected response format for generate_docx_template_document");
  }

  const fileName = typeof value.result.file_name === "string" ? value.result.file_name : "";
  const mimeType = typeof value.result.mime_type === "string" ? value.result.mime_type : "";
  const fileBase64 = typeof value.result.file_base64 === "string" ? value.result.file_base64 : "";

  if (!fileName || !mimeType || !fileBase64) {
    throw new Error("Incomplete response data for generate_docx_template_document");
  }

  return {
    method: GENERATE_DOCX_TEMPLATE_DOCUMENT_METHOD,
    result: {
      file_name: fileName,
      mime_type: mimeType,
      file_base64: fileBase64,
    },
  };
};

const documentTemplateGenerationService = {
  extractTemplateVariables: async (
    requestData: { template_url: string }
  ): Promise<ExtractDocxTemplateVariablesInvokeResponse> => {
    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: EXTRACT_TEMPLATE_VARIABLES_METHOD,
        data: requestData,
      },
    });

    const payload = extractGatewayPayload(response.data);
    return assertExtractVariablesResponse(payload);
  },

  generateDocument: async (requestData: {
    template_url: string;
    variables: Record<string, string>;
    output_file_name?: string;
  }): Promise<GenerateDocxTemplateDocumentInvokeResponse> => {
    const response = await reportsRequest.post(REPORTS_FUNCTION_PATH, {
      data: {
        method: GENERATE_DOCX_TEMPLATE_DOCUMENT_METHOD,
        data: requestData,
      },
    });

    const payload = extractGatewayPayload(response.data);
    return assertGenerateResponse(payload);
  },
};

export default documentTemplateGenerationService;
