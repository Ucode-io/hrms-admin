import { invokeTasksMethod } from "./taskDirectories.service";

export type OnboardingCreateResult = {
  status: "created" | "skipped";
  reason?:
    | "company_not_supported"
    | "employee_not_found"
    | "manager_not_configured";
  createdParents: number;
  createdSubtasks: number;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const onboardingTasksService = {
  createForEmployee: async (
    employeeId: string
  ): Promise<OnboardingCreateResult> => {
    const result = await invokeTasksMethod("onboarding_employee_create", {
      employee_id: employeeId,
    });
    return asRecord(result) as unknown as OnboardingCreateResult;
  },

  createForEmployees: async (
    employeeIds: string[]
  ): Promise<Record<string, unknown>> =>
    (await invokeTasksMethod("onboarding_employees_create", {
      employee_ids: employeeIds,
    })) || {},
};
