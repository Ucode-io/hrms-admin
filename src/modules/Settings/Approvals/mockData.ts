// Mock data + in-memory store for the Approvals settings module.
// The processes themselves are mock; departments and positions come from the
// real APIs, so we store the chosen id together with its title for display.

export type ApprovalProcessType =
  | "absence_approval"
  | "attendance_change_approval";

export interface ApprovalRef {
  id: string;
  title: string;
}

export interface ApprovalStage {
  id: string;
  title: string;
  /** Position whose holder approves this stage. */
  positionId: string;
  positionTitle: string;
}

export interface ApprovalProcess {
  id: string;
  title: string;
  type: ApprovalProcessType;
  departments: ApprovalRef[];
  description: string;
  stages: ApprovalStage[];
}

export const PROCESS_TYPES: { value: ApprovalProcessType; label: string }[] = [
  { value: "absence_approval", label: "Одобрение отсутствия" },
  { value: "attendance_change_approval", label: "Одобрение изменения по посещаемости" },
];

export const getProcessTypeLabel = (type: ApprovalProcessType): string =>
  PROCESS_TYPES.find((item) => item.value === type)?.label || type;

// --- In-memory store -------------------------------------------------------

let processes: ApprovalProcess[] = [
  {
    id: "ap-1",
    title: "Одобрение отпусков (Разработка)",
    type: "absence_approval",
    departments: [{ id: "seed-dep-1", title: "Разработка" }],
    description:
      "Заявки на отпуск проходят одобрение тимлида и руководителя отдела.",
    stages: [
      { id: "st-1", title: "Одобрение тимлида", positionId: "seed-pos-1", positionTitle: "Тимлид" },
      { id: "st-2", title: "Одобрение руководителя", positionId: "seed-pos-2", positionTitle: "Руководитель отдела" },
    ],
  },
  {
    id: "ap-2",
    title: "Изменения по посещаемости",
    type: "attendance_change_approval",
    departments: [
      { id: "seed-dep-2", title: "Маркетинг" },
      { id: "seed-dep-3", title: "Продажи" },
    ],
    description:
      "Корректировки рабочего времени утверждаются руководителем отдела и HR.",
    stages: [
      { id: "st-3", title: "Проверка руководителя", positionId: "seed-pos-2", positionTitle: "Руководитель отдела" },
      { id: "st-4", title: "Утверждение HR", positionId: "seed-pos-3", positionTitle: "HR-менеджер" },
    ],
  },
];

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const genId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export const listApprovalProcesses = (): ApprovalProcess[] => clone(processes);

export const getApprovalProcess = (id: string): ApprovalProcess | undefined => {
  const found = processes.find((item) => item.id === id);
  return found ? clone(found) : undefined;
};

export const saveApprovalProcess = (
  process: Omit<ApprovalProcess, "id"> & { id?: string }
): ApprovalProcess => {
  if (process.id) {
    const index = processes.findIndex((item) => item.id === process.id);
    if (index !== -1) {
      const updated = { ...process, id: process.id } as ApprovalProcess;
      processes[index] = clone(updated);
      return clone(updated);
    }
  }

  const created: ApprovalProcess = { ...process, id: genId("ap") };
  processes = [...processes, clone(created)];
  return clone(created);
};

export const deleteApprovalProcess = (id: string): void => {
  processes = processes.filter((item) => item.id !== id);
};

export const createStageId = () => genId("st");
