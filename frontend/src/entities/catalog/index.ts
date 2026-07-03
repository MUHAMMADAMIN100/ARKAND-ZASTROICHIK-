import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { qk } from "@/shared/api/keys";
import { queryClient } from "@/shared/api/queryClient";
import { listOps, patchList, restore, snapshot, tempId } from "@/shared/api/optimistic";

// ── Города ──
export interface City {
  id: number;
  name: string;
}

export function useCities() {
  return useQuery({
    queryKey: qk.cities,
    queryFn: async () => (await api.get<City[]>("/cities")).data,
  });
}

export function useCreateCity() {
  return useMutation({
    mutationFn: async (name: string) => (await api.post<City>("/cities", { name })).data,
    onMutate: async (name) => {
      const snap = await snapshot(queryClient, [qk.cities]);
      const optimistic: City = { id: tempId(), name };
      patchList<City>(queryClient, qk.cities, (l) =>
        [...l, optimistic].sort((a, b) => a.name.localeCompare(b.name))
      );
      return { snap, tempId: optimistic.id };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSuccess: (city, _v, ctx) => {
      if (ctx?.tempId) patchList<City>(queryClient, qk.cities, listOps.replace(ctx.tempId, city));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.cities }),
  });
}

// ── Материалы ──
export interface Material {
  id: number;
  name: string;
  unit: string;
  category: string;
  sku: string;
  min_stock: number;
  default_price: number;
  warehouse_qty: number;
  total_qty: number;
}
export type MaterialInput = {
  name: string;
  unit: string;
  category: string;
  sku?: string;
  min_stock: number;
  default_price: number;
};

export function useMaterials() {
  return useQuery({
    queryKey: qk.materials,
    queryFn: async () => (await api.get<Material[]>("/materials")).data,
  });
}

export function useCreateMaterial() {
  return useMutation({
    mutationFn: async (input: MaterialInput) =>
      (await api.post<Material>("/materials", input)).data,
    onMutate: async (input) => {
      const snap = await snapshot(queryClient, [qk.materials]);
      const optimistic: Material = {
        id: tempId(),
        name: input.name,
        unit: input.unit,
        category: input.category,
        sku: input.sku ?? "",
        min_stock: input.min_stock,
        default_price: input.default_price,
        warehouse_qty: 0,
        total_qty: 0,
      };
      patchList<Material>(queryClient, qk.materials, listOps.prepend(optimistic));
      return { snap, tempId: optimistic.id };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSuccess: (real, _v, ctx) => {
      if (ctx?.tempId) patchList<Material>(queryClient, qk.materials, listOps.replace(ctx.tempId, real));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.materials }),
  });
}

export function useUpdateMaterial() {
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: Partial<MaterialInput> }) =>
      (await api.patch<Material>(`/materials/${id}`, input)).data,
    onMutate: async ({ id, input }) => {
      const snap = await snapshot(queryClient, [qk.materials]);
      patchList<Material>(queryClient, qk.materials, listOps.update<Material>(id, input));
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.materials }),
  });
}

// ── Поставщики ──
export interface Supplier {
  id: number;
  name: string;
  phone: string;
  note: string;
  is_internal: boolean;
}

export function useSuppliers() {
  return useQuery({
    queryKey: qk.suppliers,
    queryFn: async () => (await api.get<Supplier[]>("/suppliers")).data,
  });
}

export function useCreateSupplier() {
  return useMutation({
    mutationFn: async (input: { name: string; phone?: string; note?: string; is_internal?: boolean }) =>
      (await api.post<Supplier>("/suppliers", input)).data,
    onMutate: async (input) => {
      const snap = await snapshot(queryClient, [qk.suppliers]);
      const optimistic: Supplier = {
        id: tempId(),
        name: input.name,
        phone: input.phone ?? "",
        note: input.note ?? "",
        is_internal: input.is_internal ?? false,
      };
      patchList<Supplier>(queryClient, qk.suppliers, listOps.prepend(optimistic));
      return { snap, tempId: optimistic.id };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSuccess: (s, _v, ctx) => {
      if (ctx?.tempId) patchList<Supplier>(queryClient, qk.suppliers, listOps.replace(ctx.tempId, s));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.suppliers }),
  });
}
