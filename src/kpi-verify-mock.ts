// ВРЕМЕННЫЙ файл для локальной визуальной проверки KPI-модуля без авторизации.
// Подменяет axios-адаптер моками. Удалить вместе с kpi-verify.html / kpi-verify.tsx.
import axios, { type AxiosRequestConfig, type AxiosResponse } from "axios";

type Rec = Record<string, any>;

const POSITIONS = [
  { guid: "pos-ceo", title: "CEO" },
  { guid: "pos-sales", title: "Менеджер по продажам" },
  { guid: "pos-dev", title: "Разработчик" },
];

const EMPLOYEES = [
  { guid: "emp-1", first_name: "Алишер", second_name: "Хамидуллаев", middle_name: "", positions_id: "pos-ceo" },
  { guid: "emp-2", first_name: "Мария", second_name: "Иванова", middle_name: "Сергеевна", positions_id: "pos-sales" },
  { guid: "emp-3", first_name: "Тимур", second_name: "Каримов", middle_name: "", positions_id: "pos-sales" },
  { guid: "emp-4", first_name: "Олег", second_name: "Петров", middle_name: "Викторович", positions_id: "pos-dev" },
  { guid: "emp-5", first_name: "Дилором", second_name: "Юсупова", middle_name: "", positions_id: "pos-sales" },
];

const employeeFull = (emp: Rec) => ({
  ...emp,
  birth_date: null,
  date_hire: null,
  phone: "",
  gender: [],
  email: null,
  personal_email: null,
  photo: null,
  login: null,
  status: ["active"],
  language: [],
  departments_id: null,
  departments_id_data: null,
  positions_id_data: POSITIONS.find((p) => p.guid === emp.positions_id) || null,
  employment_types_id: null,
  employment_types_id_data: null,
  experience_levels_id: null,
  experience_levels_id_data: null,
  divisions_id: null,
  divisions_id_data: null,
  locations_id: null,
  locations_id_data: null,
  role_id: null,
  role_id_data: null,
  created_at: "",
  updated_at: "",
  deleted_at: null,
});

const year = new Date().getFullYear();

const kpi = (
  guid: string,
  positionsId: string,
  position: string,
  title: string,
  plan: number,
  actual: number,
  description = ""
): Rec => ({
  guid,
  parent_id: null,
  positions_id: positionsId,
  position,
  title,
  description,
  source: "Вручную",
  value_symbol: "$",
  value_symbol_position: "suffix",
  period_type: "yearly",
  aggregation_type: "sum",
  start_date: `${year}-01-01`,
  end_date: `${year}-12-31`,
  own_plan_total: plan,
  own_actual_total: actual,
  plan_total: plan,
  actual_total: actual,
  percent_total: plan > 0 ? Math.round((actual / plan) * 100) : 0,
  has_children: false,
  is_auto: false,
  metric: null,
  children: [],
});

const KPI_ITEMS = [
  kpi("kpi-1", "pos-ceo", "CEO", "Доход", 1_000_000, 620_000, "Доход компании в год"),
  kpi("kpi-2", "pos-ceo", "CEO", "EBITDA", 300_000, 210_000),
  kpi("kpi-3", "pos-sales", "Менеджер по продажам", "Новые клиенты", 120, 84),
  kpi("kpi-4", "pos-sales", "Менеджер по продажам", "Выручка отдела", 500_000, 350_000),
];

let savedCounter = 0;

const parseBody = (config: AxiosRequestConfig): Rec => {
  const raw = config.data;
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw as Rec;
};

const parseDataParam = (config: AxiosRequestConfig): Rec => {
  const raw = (config.params as Rec | undefined)?.data;
  if (typeof raw !== "string") return {};
  for (const candidate of [raw, decodeURIComponent(raw)]) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // try next
    }
  }
  return {};
};

const ok = (config: AxiosRequestConfig, data: unknown): AxiosResponse => ({
  data,
  status: 200,
  statusText: "OK",
  headers: {},
  config: config as any,
});

axios.defaults.adapter = async (config) => {
  const url = `${config.baseURL || ""}${config.url || ""}`;

  // ── Шлюз отчётов (KPI) ──
  if (url.includes("/v2/invoke_function/udevs-hrms-reports")) {
    const body = parseBody(config);
    const method = body?.data?.method;

    if (method === "get_kpi_table") {
      return ok(config, {
        method,
        result: {
          period_type: "yearly",
          date_from: `${year}-01-01`,
          date_to: `${year}-12-31`,
          groups: [
            { position: "CEO", items: [] },
            { position: "Менеджер по продажам", items: [] },
          ],
          items: KPI_ITEMS,
        },
      });
    }
    if (method === "get_kpi") {
      return ok(config, {
        method,
        result: {
          filters: {
            positions: POSITIONS.map((p) => ({ value: p.guid, label: p.title })),
            sources: [{ value: "Вручную", label: "Вручную" }],
            auto_metrics: [],
            parents: [],
          },
        },
      });
    }
    if (method === "save_kpi") {
      savedCounter += 1;
      return ok(config, {
        method,
        result: {
          guid: `kpi-new-${savedCounter}`,
          parent_id: null,
          period_type: "yearly",
          plan_total: 0,
          actual_total: 0,
          percent_total: 0,
          has_children: false,
          child_ids: [],
        },
      });
    }
    if (method === "delete_kpi" || method === "update_kpi_value" || method === "reorder_kpi") {
      return ok(config, { method, result: { mode: "items", updated_count: 0, guid: "x", deleted_count: 0, deleted_ids: [], parent_id: null, plan_total: 0, actual_total: 0, percent_total: 0 } });
    }
    return ok(config, { method: method || "unknown", result: {} });
  }

  // ── Items API: сотрудники (с фильтром по должности) ──
  if (url.includes("/v2/items/user_base")) {
    const dataParam = parseDataParam(config);
    const positionsFilter: string[] = Array.isArray(dataParam.positions_id)
      ? dataParam.positions_id
      : [];
    const search = typeof dataParam.search === "string" ? dataParam.search.toLowerCase() : "";
    let list = EMPLOYEES;
    if (positionsFilter.length > 0) {
      list = list.filter((emp) => positionsFilter.includes(emp.positions_id));
    }
    if (search) {
      list = list.filter((emp) =>
        `${emp.second_name} ${emp.first_name} ${emp.middle_name}`.toLowerCase().includes(search)
      );
    }
    return ok(config, { data: { data: { count: list.length, response: list.map(employeeFull) } } });
  }

  // ── Items API: должности (для RemoteSingleSelect) ──
  if (url.includes("/v2/items/positions")) {
    const parts = (config.url || "").split("?")[0].split("/").filter(Boolean);
    const maybeGuid = parts[parts.length - 1];
    if (maybeGuid && maybeGuid !== "positions") {
      const found = POSITIONS.find((p) => p.guid === maybeGuid) || null;
      return ok(config, { data: { data: { response: found } } });
    }
    const dataParam = parseDataParam(config);
    const search = typeof dataParam.search === "string" ? dataParam.search.toLowerCase() : "";
    const list = search
      ? POSITIONS.filter((p) => p.title.toLowerCase().includes(search))
      : POSITIONS;
    return ok(config, { data: { data: { count: list.length, response: list } } });
  }

  // Всё прочее — мягкая заглушка.
  return ok(config, { data: { data: { count: 0, response: [] } } });
};
