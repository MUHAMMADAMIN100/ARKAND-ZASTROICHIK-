import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { qk } from "@/shared/api/keys";
import { queryClient } from "@/shared/api/queryClient";
import { listOps, patchList, restore, snapshot, tempId } from "@/shared/api/optimistic";
import type { InventoryStatus, InventoryType } from "@/shared/config/enums";

export interface InventoryItem {
  id: number;
  material_id: number;
  material_name: string | null;
  unit: string | null;
  category: string | null;
  qty_system: number;
  qty_fact: number | null;
  unit_price: number;
  qty_diff: number;
  cost_diff: number;
}

export interface Inventory {
  id: number;
  number: string;
  type: InventoryType;
  status: InventoryStatus;
  category_filter: string;
  note: string;
  created_at: string;
  completed_at: string | null;
  items: InventoryItem[];
  total_qty_diff: number;
  total_cost_diff: number;
}

export function useInventories() {
  return useQuery({
    queryKey: qk.inventories,
    queryFn: async () => (await api.get<Inventory[]>("/inventories")).data,
  });
}

export function useStartInventory() {
  return useMutation({
    mutationFn: async (input: { type: InventoryType; category_filter?: string; note?: string }) =>
      (await api.post<Inventory>("/inventories/start", input)).data,
    onMutate: async (input) => {
      const snap = await snapshot(queryClient, [qk.inventories]);
      const optimistic: Inventory = {
        id: tempId(),
        number: "…",
        type: input.type,
        status: "in_progress",
        category_filter: input.category_filter ?? "",
        note: input.note ?? "",
        created_at: new Date().toISOString(),
        completed_at: null,
        items: [],
        total_qty_diff: 0,
        total_cost_diff: 0,
      };
      patchList<Inventory>(queryClient, qk.inventories, listOps.prepend(optimistic));
      return { snap, tempId: optimistic.id };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSuccess: (inv, _v, ctx) => {
      if (ctx?.tempId) patchList<Inventory>(queryClient, qk.inventories, listOps.replace(ctx.tempId, inv));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.inventories });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useCountInventory() {
  return useMutation({
    mutationFn: async ({
      id,
      items,
    }: {
      id: number;
      items: { item_id: number; qty_fact: number }[];
    }) => (await api.post<Inventory>(`/inventories/${id}/count`, { items })).data,
    onMutate: async ({ id, items }) => {
      const snap = await snapshot(queryClient, [qk.inventories]);
      const map = new Map(items.map((i) => [i.item_id, i.qty_fact]));
      patchList<Inventory>(queryClient, qk.inventories, (list) =>
        list.map((inv) =>
          inv.id !== id
            ? inv
            : {
                ...inv,
                items: inv.items.map((it) =>
                  map.has(it.id)
                    ? {
                        ...it,
                        qty_fact: map.get(it.id)!,
                        qty_diff: map.get(it.id)! - it.qty_system,
                        cost_diff: (map.get(it.id)! - it.qty_system) * it.unit_price,
                      }
                    : it
                ),
              }
        )
      );
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSuccess: (real) =>
      patchList<Inventory>(queryClient, qk.inventories, listOps.replace(real.id, real)),
  });
}

export function useCompleteInventory() {
  return useMutation({
    mutationFn: async (id: number) =>
      (await api.post<Inventory>(`/inventories/${id}/complete`)).data,
    onMutate: async (id) => {
      const snap = await snapshot(queryClient, [qk.inventories]);
      patchList<Inventory>(
        queryClient,
        qk.inventories,
        listOps.update<Inventory>(id, {
          status: "completed",
          completed_at: new Date().toISOString(),
        })
      );
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSuccess: (real) =>
      patchList<Inventory>(queryClient, qk.inventories, listOps.replace(real.id, real)),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.inventories });
      queryClient.invalidateQueries({ queryKey: qk.stock });
      queryClient.invalidateQueries({ queryKey: qk.movements });
      queryClient.invalidateQueries({ queryKey: qk.materials });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useCancelInventory() {
  return useMutation({
    mutationFn: async (id: number) =>
      (await api.post<Inventory>(`/inventories/${id}/cancel`)).data,
    onMutate: async (id) => {
      const snap = await snapshot(queryClient, [qk.inventories]);
      patchList<Inventory>(queryClient, qk.inventories, listOps.update<Inventory>(id, { status: "cancelled" }));
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.inventories });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}
