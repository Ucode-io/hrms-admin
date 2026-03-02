import axios from "axios";
import { useQuery } from "react-query";

const SALES_BY_PARTNER_URL =
  "https://metabase.u-code.io/api/public/card/33bcef43-4c68-453d-937c-111bc085de57/query/json";
const SALES_BY_CATEGORY_URL =
  "https://metabase.u-code.io/api/public/card/50f962bb-4167-4f44-b5c4-05a1dd0f672b/query/json";
const CONTRACT_STATUS_URL =
  "https://metabase.u-code.io/api/public/card/69bd83c3-c985-48a3-b7e2-96b042a93a91/query/json";

interface PartnerSalesRaw {
  Партнеры: string | null;
  "Общая сумма продаж": number | null;
}

interface CategorySalesRaw {
  Категория: string | null;
  "Общая сумма": number | null;
}

interface ContractStatusRaw {
  "Статус контракта": string | null;
  count: number | null;
}

export interface PartnerSalesItem {
  name: string;
  total: number;
}

export interface CategorySalesItem {
  name: string;
  total: number;
}

export interface ContractStatusItem {
  name: string;
  count: number;
}

export interface DashboardChartsData {
  partnerSales: PartnerSalesItem[];
  categorySales: CategorySalesItem[];
  contractStatuses: ContractStatusItem[];
}

const PARTNER_SALES_MOCK: PartnerSalesRaw[] = [
  { Партнеры: "test2", "Общая сумма продаж": 2.91e8 },
  { Партнеры: "Texnomart", "Общая сумма продаж": 7.6052008e7 },
  { Партнеры: "test 1", "Общая сумма продаж": 3.0e7 },
  { Партнеры: "AYVA", "Общая сумма продаж": 1.0831008e7 },
  { Партнеры: "MCoDevs", "Общая сумма продаж": 2504000.0 },
  { Партнеры: "salom", "Общая сумма продаж": 1000000.0 },
  { Партнеры: "Udevs", "Общая сумма продаж": 2000.0 },
  { Партнеры: "Something", "Общая сумма продаж": null },
  { Партнеры: "test", "Общая сумма продаж": null },
  { Партнеры: "Texnoshopbest", "Общая сумма продаж": null },
  { Партнеры: "dsfsd23434", "Общая сумма продаж": null },
  { Партнеры: "AbrorBank", "Общая сумма продаж": null },
  { Партнеры: "Diyorbek Abdullayev", "Общая сумма продаж": null },
];

const CATEGORY_SALES_MOCK: CategorySalesRaw[] = [
  { Категория: "Телефоны", "Общая сумма": 5.822e8 },
  { Категория: "AirPods", "Общая сумма": null },
  { Категория: "SmartWatch", "Общая сумма": null },
  { Категория: "Миксер", "Общая сумма": null },
  { Категория: "Холодильник", "Общая сумма": null },
  { Категория: "Моюшие средства", "Общая сумма": null },
  { Категория: "Термез", "Общая сумма": null },
  { Категория: "Пылесос", "Общая сумма": null },
  { Категория: "Телевизор", "Общая сумма": null },
  { Категория: "Планшет", "Общая сумма": null },
  { Категория: "Микроволновка", "Общая сумма": null },
  { Категория: "Стиральная машина", "Общая сумма": null },
];

const CONTRACT_STATUS_MOCK: ContractStatusRaw[] = [
  { "Статус контракта": "Новый", count: 70 },
  { "Статус контракта": "Отменён", count: 3 },
  { "Статус контракта": "В ожидании", count: 2 },
  { "Статус контракта": "Принят", count: 4 },
];

const toSafeNumber = (value: number | null | undefined): number => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0;
  }

  return value;
};

const mapPartnerSales = (data: PartnerSalesRaw[]): PartnerSalesItem[] =>
  data.map((item) => ({
    name: item.Партнеры ?? "Без названия",
    total: toSafeNumber(item["Общая сумма продаж"]),
  }));

const mapCategorySales = (data: CategorySalesRaw[]): CategorySalesItem[] =>
  data.map((item) => ({
    name: item.Категория ?? "Без категории",
    total: toSafeNumber(item["Общая сумма"]),
  }));

const mapContractStatuses = (data: ContractStatusRaw[]): ContractStatusItem[] =>
  data.map((item) => ({
    name: item["Статус контракта"] ?? "Без статуса",
    count: toSafeNumber(item.count),
  }));

const dashboardService = {
  getPartnerSales: async (): Promise<PartnerSalesItem[]> => {
    try {
      const { data } = await axios.get<PartnerSalesRaw[]>(SALES_BY_PARTNER_URL);
      if (!Array.isArray(data)) {
        return mapPartnerSales(PARTNER_SALES_MOCK);
      }

      return mapPartnerSales(data);
    } catch {
      return mapPartnerSales(PARTNER_SALES_MOCK);
    }
  },

  getCategorySales: async (): Promise<CategorySalesItem[]> => {
    try {
      const { data } = await axios.get<CategorySalesRaw[]>(SALES_BY_CATEGORY_URL);
      if (!Array.isArray(data)) {
        return mapCategorySales(CATEGORY_SALES_MOCK);
      }

      return mapCategorySales(data);
    } catch {
      return mapCategorySales(CATEGORY_SALES_MOCK);
    }
  },

  getContractStatuses: async (): Promise<ContractStatusItem[]> => {
    try {
      const { data } = await axios.get<ContractStatusRaw[]>(CONTRACT_STATUS_URL);
      if (!Array.isArray(data)) {
        return mapContractStatuses(CONTRACT_STATUS_MOCK);
      }

      return mapContractStatuses(data);
    } catch {
      return mapContractStatuses(CONTRACT_STATUS_MOCK);
    }
  },
};

export const useDashboardChartsQuery = () =>
  useQuery<DashboardChartsData>({
    queryKey: ["DASHBOARD_CHARTS"],
    queryFn: async () => {
      const [partnerSales, categorySales, contractStatuses] = await Promise.all(
        [
          dashboardService.getPartnerSales(),
          dashboardService.getCategorySales(),
          dashboardService.getContractStatuses(),
        ]
      );

      return {
        partnerSales,
        categorySales,
        contractStatuses,
      };
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

export default dashboardService;
