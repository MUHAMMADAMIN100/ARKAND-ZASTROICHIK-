import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { qk } from "@/shared/api/keys";
import type { LocationType } from "@/shared/config/enums";

export interface StockRow {
  material_id: number;
  material_name: string;
  unit: string;
  category: string;
  location_type: LocationType;
  location_id: number;
  location_name: string;
  quantity: number;
  avg_cost: number;
  min_stock: number;
  is_low: boolean;
}

export interface Movement {
  id: number;
  material_id: number;
  material_name: string | null;
  unit: string | null;
  from_type: string | null;
  from_id: number | null;
  from_name: string | null;
  to_type: string | null;
  to_id: number | null;
  to_name: string | null;
  quantity: number;
  unit_price: number;
  reason: string;
  ref_type: string | null;
  ref_id: number | null;
  note: string;
  created_at: string;
}

/** Все остатки (все локации). Фильтрация — на клиенте. */
export function useStock() {
  return useQuery({
    queryKey: qk.stock,
    queryFn: async () => (await api.get<StockRow[]>("/stock")).data,
  });
}

export function useMovements(limit = 200) {
  return useQuery({
    queryKey: qk.movements,
    queryFn: async () => (await api.get<Movement[]>(`/movements?limit=${limit}`)).data,
  });
}
