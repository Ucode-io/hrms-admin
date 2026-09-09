import { useMutation, useQuery, useQueryClient } from "react-query";
import { invokeTasksMethod } from "./taskDirectories.service";

export type DueUnit = "day" | "week" | "month";
export type OnboardingItem = {
  key: string;
  title: string;
  description: string;
  due_value: number;
  due_unit: DueUnit;
  children: OnboardingItem[];
};
export type ExcelRow = { number: number; values: string[] };
export type ExcelSheet = { name: string; rows: ExcelRow[]; rowCount: number; columnCount: number };
export type ParsedWorkbook = { fileName: string; sheets: ExcelSheet[]; truncated: boolean };
export type OnboardingTemplate = {
  id: string;
  title: string;
  status: "draft" | "active" | "archived";
  isDefault: boolean;
  departmentIds: string[];
  positionIds: string[];
  version: number;
  sourceFileName: string;
  mapping: Record<string, unknown>;
  items: OnboardingItem[];
  updatedAt: string;
};
export type OnboardingCreateResult = {
  status: "created" | "skipped";
  reason?: "employee_not_found" | "manager_not_configured" | "active_template_not_found";
  createdParents: number;
  createdSubtasks: number;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const readFileBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(reader.error || new Error("Could not read Excel file"));
    reader.readAsDataURL(file);
  });

export const onboardingTasksService = {
  list: async (): Promise<OnboardingTemplate[]> => {
    const result = await invokeTasksMethod("onboarding_template_list");
    return (Array.isArray(result?.templates) ? result.templates : []) as OnboardingTemplate[];
  },
  parseExcel: async (file: File): Promise<ParsedWorkbook> => {
    const result = await invokeTasksMethod("onboarding_excel_parse", {
      file_name: file.name,
      content_base64: await readFileBase64(file),
    });
    return asRecord(result) as unknown as ParsedWorkbook;
  },
  save: async (template: {
    guid?: string;
    title: string;
    status: "draft" | "active";
    is_default: boolean;
    department_ids: string[];
    position_ids: string[];
    source_file_name: string;
    mapping: Record<string, unknown>;
    items: OnboardingItem[];
  }): Promise<OnboardingTemplate> => {
    const result = await invokeTasksMethod("onboarding_template_save", template);
    return asRecord(result?.template) as unknown as OnboardingTemplate;
  },
  archive: async (guid: string): Promise<void> => {
    await invokeTasksMethod("onboarding_template_archive", { guid });
  },
  createForEmployee: async (employeeId: string): Promise<OnboardingCreateResult> => {
    const result = await invokeTasksMethod("onboarding_employee_create", { employee_id: employeeId });
    return asRecord(result) as unknown as OnboardingCreateResult;
  },
  createForEmployees: async (employeeIds: string[]): Promise<Record<string, unknown>> =>
    (await invokeTasksMethod("onboarding_employees_create", { employee_ids: employeeIds })) || {},
};

export const ONBOARDING_TEMPLATES_KEY = ["onboarding-templates"];
export const useOnboardingTemplates = () => useQuery(ONBOARDING_TEMPLATES_KEY, onboardingTasksService.list);
export const useParseOnboardingExcel = () => useMutation((file: File) => onboardingTasksService.parseExcel(file));
export const useSaveOnboardingTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation(onboardingTasksService.save, { onSuccess: () => queryClient.invalidateQueries(ONBOARDING_TEMPLATES_KEY) });
};
export const useArchiveOnboardingTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation(onboardingTasksService.archive, { onSuccess: () => queryClient.invalidateQueries(ONBOARDING_TEMPLATES_KEY) });
};
