import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { qk } from "@/shared/api/keys";

export interface Dashboard {
  objects_total: number;
  objects_active: number;
  requests_open: number;
  invoices_pending: number;
  low_stock_count: number;
  inventory_active: number;
  cash_balance: number;
  expense_month: number;
  income_month: number;
  profit_month: number;
}

export interface ObjectExpenseRow {
  object_id: number;
  object_name: string;
  city_name: string | null;
  materials: number;
  work: number;
  tech: number;
  other: number;
  total_expense: number;
  income: number;
  profit: number;
}

export interface CityAnalyticsRow {
  city_name: string;
  objects_count: number;
  total_expense: number;
  income: number;
  profit: number;
}

export function useDashboard() {
  return useQuery({
    queryKey: qk.dashboard,
    queryFn: async () => (await api.get<Dashboard>("/reports/dashboard")).data,
  });
}

export function useObjectExpenses() {
  return useQuery({
    queryKey: qk.objectExpenses,
    queryFn: async () => (await api.get<ObjectExpenseRow[]>("/reports/object-expenses")).data,
  });
}

export function useCityAnalytics() {
  return useQuery({
    queryKey: qk.cityAnalytics,
    queryFn: async () => (await api.get<CityAnalyticsRow[]>("/reports/city-analytics")).data,
  });
}
