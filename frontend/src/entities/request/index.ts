import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { qk } from "@/shared/api/keys";
import { queryClient } from "@/shared/api/queryClient";
import { listOps, patchList, restore, snapshot, tempId } from "@/shared/api/optimistic";
import type { FulfillmentType, RequestStatus } from "@/shared/config/enums";

export interface RequestItem {
  id: number;
  material_id: number;
  material_name: string | null;
  unit: string | null;
  quantity: number;
  note: string;
  warehouse_qty: number;
}

export interface MaterialRequest {
  id: number;
  number: string;
  object_id: number;
  object_name: string | null;
  created_by: number | null;
  created_by_name: string | null;
  status: RequestStatus;
  needed_date: string | null;
  note: string;
  fulfillment_type: FulfillmentType | null;
  confirmed_at: string | null;
  created_at: string;
  items: RequestItem[];
}

export interface RequestInput {
  object_id: number;
  needed_date?: string | null;
  note?: string;
  items: { material_id: number; quantity: number; note?: string }[];
}

export function useRequests() {
  return useQuery({
    queryKey: qk.requests,
    queryFn: async () => (await api.get<MaterialRequest[]>("/requests")).data,
  });
}

export function useCreateRequest() {
  return useMutation({
    mutationFn: async (input: RequestInput) =>
      (await api.post<MaterialRequest>("/requests", input)).data,
    onMutate: async (input) => {
      const snap = await snapshot(queryClient, [qk.requests]);
      const optimistic: MaterialRequest = {
        id: tempId(),
        number: "…",
        object_id: input.object_id,
        object_name: null,
        created_by: null,
        created_by_name: null,
        status: "submitted",
        needed_date: input.needed_date ?? null,
        note: input.note ?? "",
        fulfillment_type: null,
        confirmed_at: null,
        created_at: new Date().toISOString(),
        items: input.items.map((it, i) => ({
          id: -i - 1,
          material_id: it.material_id,
          material_name: null,
          unit: null,
          quantity: it.quantity,
          note: it.note ?? "",
          warehouse_qty: 0,
        })),
      };
      patchList<MaterialRequest>(queryClient, qk.requests, listOps.prepend(optimistic));
      return { snap, tempId: optimistic.id };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSuccess: (real, _v, ctx) => {
      if (ctx?.tempId)
        patchList<MaterialRequest>(queryClient, qk.requests, listOps.replace(ctx.tempId, real));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.requests });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useConfirmRequest() {
  return useMutation({
    mutationFn: async ({ id, fulfillment_type }: { id: number; fulfillment_type: FulfillmentType }) =>
      (await api.post<MaterialRequest>(`/requests/${id}/confirm`, { fulfillment_type })).data,
    onMutate: async ({ id, fulfillment_type }) => {
      const snap = await snapshot(queryClient, [qk.requests]);
      patchList<MaterialRequest>(
        queryClient,
        qk.requests,
        listOps.update<MaterialRequest>(id, { status: "confirmed", fulfillment_type })
      );
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSuccess: (real) =>
      patchList<MaterialRequest>(queryClient, qk.requests, listOps.replace(real.id, real)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.requests }),
  });
}

export function useRejectRequest() {
  return useMutation({
    mutationFn: async (id: number) =>
      (await api.post<MaterialRequest>(`/requests/${id}/reject`)).data,
    onMutate: async (id) => {
      const snap = await snapshot(queryClient, [qk.requests]);
      patchList<MaterialRequest>(queryClient, qk.requests, listOps.update<MaterialRequest>(id, { status: "rejected" }));
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.requests }),
  });
}

export function useDeleteRequest() {
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/requests/${id}`);
      return id;
    },
    onMutate: async (id) => {
      const snap = await snapshot(queryClient, [qk.requests]);
      patchList<MaterialRequest>(queryClient, qk.requests, listOps.remove<MaterialRequest>(id));
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.requests });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}
