import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "react-query";
import authStore from "../../store/auth.store";
import { injectCompaniesIdIntoInvokeFunctionRequest } from "../httpRequest";

const PATH = "/v2/invoke_function/udevs-hrms-reports?project-id=9a462573-ce11-4288-928a-a6ba754b6998";
const request = axios.create({ baseURL: "https://api.admin.u-code.io", timeout: 120000 });
request.interceptors.request.use((config) => {
  if (authStore.token) config.headers.Authorization = `Bearer ${authStore.token}`;
  return injectCompaniesIdIntoInvokeFunctionRequest(config);
});

async function invoke<T>(method: string, data: Record<string, unknown> = {}): Promise<T> {
  const response = await request.post(PATH, { data: { method, data } });
  let node: any = response.data;
  for (let i = 0; i < 6 && node && typeof node === "object"; i += 1) {
    if (node.server_error) throw new Error(String(node.server_error));
    if (node.method === method) return node.result as T;
    node = node.data;
  }
  throw new Error("CRM javobi noto‘g‘ri formatda keldi");
}

export type CrmPreviewItem = {
  crm_id: number; full_name: string; email: string | null; phone: string | null;
  department: string | null; position: string | null;
  kind: "linked" | "matched" | "new" | "ambiguous";
  match_reason: string | null; user_base_id: string | null;
};
export type CrmPreview = {
  summary: { total: number; linked: number; matched: number; new: number; ambiguous: number };
  items: CrmPreviewItem[];
};
export type CrmStatus = {
  configured: boolean;
  links: Array<{ user_base_id: string; crm_employee_id: number }>;
  sync: Array<{ sync_type: string; last_success_at: string | null; last_error: string | null; summary: unknown }>;
};

export const useVegapharmCrmStatus = (enabled: boolean) =>
  useQuery(["vegapharm-crm-status"], () => invoke<CrmStatus>("vegapharm_crm_status"), { enabled, staleTime: 30000 });

export const useVegapharmCrmPreview = (enabled: boolean) =>
  useQuery(["vegapharm-crm-preview"], () => invoke<CrmPreview>("vegapharm_crm_preview"), { enabled, retry: false });

export const useVegapharmCrmImport = () => {
  const qc = useQueryClient();
  return useMutation(
    (ids: number[]) => invoke<{ created: number; linked: number; skipped: number }>("vegapharm_crm_import_employees", { crm_employee_ids: ids }),
    { onSuccess: () => { qc.invalidateQueries("employees"); qc.invalidateQueries("vegapharm-crm-status"); qc.invalidateQueries("vegapharm-crm-preview"); } }
  );
};

export const syncVegapharmCrmAttendance = (day?: string) =>
  invoke<{ received: number; updated: number; skipped_unlinked: number }>("vegapharm_crm_sync_attendance", day ? { day } : {});
