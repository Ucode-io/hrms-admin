import type { Department } from "../../../api/services/department.service";

export type Option = {
  value: string;
  label: string;
};

export type FlattenedTreeRow = {
  department: Department;
  level: number;
  hasChildren: boolean;
};
