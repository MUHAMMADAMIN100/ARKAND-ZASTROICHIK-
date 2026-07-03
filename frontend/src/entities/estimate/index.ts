import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { qk } from "@/shared/api/keys";
import { queryClient } from "@/shared/api/queryClient";
import { listOps, patchList, restore, snapshot, tempId } from "@/shared/api/optimistic";
import type { EstimateCategory } from "@/shared/config/enums";

export interface EstimateItem {
  id: number;
  estimate_id: number;
  category: EstimateCategory;
  name: string;
  unit: string;
  qty_plan: number;
  price_plan: number;
  amount_plan: number;
  amount_fact_manual: number | null;
}

export interface Estimate {
  id: number;
  object_id: number;
  object_name: string | null;
  name: string;
  note: string;
  created_at: string;
  items: EstimateItem[];
  total_plan: number;
  total_fact: number;
}

export interface EstimateItemInput {
  category: EstimateCategory;
  name: string;
  unit?: string;
  qty_plan: number;
  price_plan: number;
  amount_fact_manual?: number | null;
}

export interface CompareRow {
  category: EstimateCategory;
  label: string;
  plan: number;
  fact: number;
  diff: number;
  percent: number;
}
export interface EstimateCompare {
  estimate_id: number;
  object_id: number;
  object_name: string | null;
  total_plan: number;
  total_fact: number;
  diff: number;
  percent: number;
  by_category: CompareRow[];
}

export function useEstimates() {
  return useQuery({
    queryKey: qk.estimates,
    queryFn: async () => (await api.get<Estimate[]>("/estimates")).data,
  });
}

export function useEstimateCompare(id: number | undefined) {
  return useQuery({
    queryKey: qk.estimateCompare(id ?? 0),
    enabled: !!id,
    queryFn: async () => (await api.get<EstimateCompare>(`/estimates/${id}/compare`)).data,
  });
}

export function useCreateEstimate() {
  return useMutation({
    mutationFn: async (input: { object_id: number; name?: string; items?: EstimateItemInput[] }) =>
      (await api.post<Estimate>("/estimates", input)).data,
    onMutate: async (input) => {
      const snap = await snapshot(queryClient, [qk.estimates]);
      const id = tempId();
      const items: EstimateItem[] = (input.items ?? []).map((it, i) => ({
        id: -(i + 1),
        estimate_id: id,
        category: it.category,
        name: it.name,
        unit: it.unit ?? "",
        qty_plan: it.qty_plan,
        price_plan: it.price_plan,
        amount_plan: it.qty_plan * it.price_plan,
        amount_fact_manual: it.amount_fact_manual ?? null,
      }));
      const optimistic: Estimate = {
        id,
        object_id: input.object_id,
        object_name: null,
        name: input.name ?? "Смета по объекту",
        note: "",
        created_at: new Date().toISOString(),
        items,
        total_plan: items.reduce((s, x) => s + x.amount_plan, 0),
        total_fact: 0,
      };
      patchList<Estimate>(queryClient, qk.estimates, listOps.prepend(optimistic));
      return { snap, tempId: id };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSuccess: (e, _v, ctx) => {
      if (ctx?.tempId) patchList<Estimate>(queryClient, qk.estimates, listOps.replace(ctx.tempId, e));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.estimates }),
  });
}

export function useAddEstimateItem() {
  return useMutation({
    mutationFn: async ({ estimateId, input }: { estimateId: number; input: EstimateItemInput }) =>
      (await api.post<EstimateItem>(`/estimates/${estimateId}/items`, input)).data,
    onMutate: async ({ estimateId, input }) => {
      const snap = await snapshot(queryClient, [qk.estimates]);
      const optimistic: EstimateItem = {
        id: tempId(),
        estimate_id: estimateId,
        category: input.category,
        name: input.name,
        unit: input.unit ?? "",
        qty_plan: input.qty_plan,
        price_plan: input.price_plan,
        amount_plan: input.qty_plan * input.price_plan,
        amount_fact_manual: input.amount_fact_manual ?? null,
      };
      patchList<Estimate>(queryClient, qk.estimates, (list) =>
        list.map((e) =>
          e.id === estimateId
            ? { ...e, items: [...e.items, optimistic], total_plan: e.total_plan + optimistic.amount_plan }
            : e
        )
      );
      return { snap, tempId: optimistic.id, estimateId };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSuccess: (real, _v, ctx) => {
      if (!ctx?.tempId) return;
      patchList<Estimate>(queryClient, qk.estimates, (list) =>
        list.map((e) =>
          e.id === ctx.estimateId
            ? { ...e, items: e.items.map((it) => (it.id === ctx.tempId ? real : it)) }
            : e
        )
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.estimates }),
  });
}

export function useUpdateEstimateItem() {
  return useMutation({
    mutationFn: async ({ itemId, input }: { itemId: number; input: Partial<EstimateItemInput> }) =>
      (await api.patch<EstimateItem>(`/estimates/items/${itemId}`, input)).data,
    onMutate: async ({ itemId, input }) => {
      const snap = await snapshot(queryClient, [qk.estimates]);
      patchList<Estimate>(queryClient, qk.estimates, (list) =>
        list.map((e) => ({
          ...e,
          items: e.items.map((it) =>
            it.id === itemId
              ? {
                  ...it,
                  ...input,
                  amount_plan:
                    (input.qty_plan ?? it.qty_plan) * (input.price_plan ?? it.price_plan),
                }
              : it
          ),
        }))
      );
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.estimates }),
  });
}

export function useDeleteEstimateItem() {
  return useMutation({
    mutationFn: async (itemId: number) => {
      await api.delete(`/estimates/items/${itemId}`);
      return itemId;
    },
    onMutate: async (itemId) => {
      const snap = await snapshot(queryClient, [qk.estimates]);
      patchList<Estimate>(queryClient, qk.estimates, (list) =>
        list.map((e) => ({ ...e, items: e.items.filter((it) => it.id !== itemId) }))
      );
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.estimates }),
  });
}

export function useDeleteEstimate() {
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/estimates/${id}`);
      return id;
    },
    onMutate: async (id) => {
      const snap = await snapshot(queryClient, [qk.estimates]);
      patchList<Estimate>(queryClient, qk.estimates, (l) => l.filter((e) => e.id !== id));
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.estimates }),
  });
}
