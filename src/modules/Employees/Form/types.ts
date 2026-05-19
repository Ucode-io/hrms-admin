import type { SelectOption } from "../../../components/ui/searchable-select";

export type { SelectOption };

export interface EmployeeFormValues {
  second_name: string;        // Фамилия
  first_name: string;         // Имя
  middle_name: string;        // Отчество
  birth_date: Date | null;
  phone: string;
  work_phone: string;
  telegram: string;
  gender: string;
  hikvision_id: string;
  departments_id: string;
  positions_id: string;
  date_hire: Date | null;
  photo: string;
  email: string;
  personal_email: string;
  employment_types_id: string;
  experience_levels_id: string;
  divisions_id: string;
  locations_id: string;
  employee_work_reason_id: string;
  salary: string;
}

export const employeeFormDefaults: EmployeeFormValues = {
  second_name: "",
  first_name: "",
  middle_name: "",
  birth_date: null,
  phone: "",
  work_phone: "",
  telegram: "",
  gender: "",
  hikvision_id: "",
  departments_id: "",
  positions_id: "",
  date_hire: null,
  photo: "",
  email: "",
  personal_email: "",
  employment_types_id: "",
  experience_levels_id: "",
  divisions_id: "",
  locations_id: "",
  employee_work_reason_id: "",
  salary: "",
};
