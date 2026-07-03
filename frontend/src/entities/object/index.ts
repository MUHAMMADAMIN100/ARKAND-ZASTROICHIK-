import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { qk } from "@/shared/api/keys";
import { queryClient } from "@/shared/api/queryClient";
import { listOps, patchList, restore, snapshot, tempId } from "@/shared/api/optimistic";
import type { ObjectStatus, StageStatus } from "@/shared/config/enums";

export interface Stage {
  id: number;
  object_id: number;
  name: string;
  planned_start: string | null;
  planned_end: string | null;
  status: StageStatus;
}

export interface ConstructionObject {
  id: number;
  name: string;
  address: string;
  city_id: number | null;
  city_name: string | null;
  responsible_id: number | null;
  responsible_name: string | null;
  status: ObjectStatus;
  start_date: string | null;
  deadline: string | null;
  description: string;
  created_at: string;
  stages: Stage[];
}

export interface ObjectInput {
  name: string;
  address?: string;
  city_id?: number | null;
  responsible_id?: number | null;
  status?: ObjectStatus;
  start_date?: string | null;
  deadline?: string | null;
  description?: string;
}

export function useObjects() {
  return useQuery({
    queryKey: qk.objects,
    queryFn: async () => (await api.get<ConstructionObject[]>("/objects")).data,
  });
}

export function useObject(id: number | undefined) {
  return useQuery({
    queryKey: [...qk.objects, id],
    enabled: !!id,
    queryFn: async () => (await api.get<ConstructionObject>(`/objects/${id}`)).data,
    initialData: () =>
      queryClient.getQueryData<ConstructionObject[]>(qk.objects)?.find((o) => o.id === id),
  });
}

export function useCreateObject() {
  return useMutation({
    mutationFn: async (input: ObjectInput) =>
      (await api.post<ConstructionObject>("/objects", input)).data,
    onMutate: async (input) => {
      const snap = await snapshot(queryClient, [qk.objects]);
      const optimistic: ConstructionObject = {
        id: tempId(),
        name: input.name,
        address: input.address ?? "",
        city_id: input.city_id ?? null,
        city_name: null,
        responsible_id: input.responsible_id ?? null,
        responsible_name: null,
        status: input.status ?? "planning",
        start_date: input.start_date ?? null,
        deadline: input.deadline ?? null,
        description: input.description ?? "",
        created_at: new Date().toISOString(),
        stages: [],
      };
      patchList<ConstructionObject>(queryClient, qk.objects, listOps.prepend(optimistic));
      return { snap, tempId: optimistic.id };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSuccess: (real, _v, ctx) => {
      if (ctx?.tempId)
        patchList<ConstructionObject>(queryClient, qk.objects, listOps.replace(ctx.tempId, real));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.objects });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useUpdateObject() {
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: ObjectInput }) =>
      (await api.patch<ConstructionObject>(`/objects/${id}`, input)).data,
    onMutate: async ({ id, input }) => {
      const snap = await snapshot(queryClient, [qk.objects, [...qk.objects, id]]);
      patchList<ConstructionObject>(queryClient, qk.objects, listOps.update<ConstructionObject>(id, input));
      queryClient.setQueryData<ConstructionObject>([...qk.objects, id], (o) =>
        o ? { ...o, ...input } : o
      );
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSuccess: (real) => {
      patchList<ConstructionObject>(queryClient, qk.objects, listOps.replace(real.id, real));
      queryClient.setQueryData([...qk.objects, real.id], real);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.objects }),
  });
}

export function useDeleteObject() {
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/objects/${id}`);
      return id;
    },
    onMutate: async (id) => {
      const snap = await snapshot(queryClient, [qk.objects]);
      patchList<ConstructionObject>(queryClient, qk.objects, listOps.remove<ConstructionObject>(id));
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.objects });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

// ── Этапы ──
export interface StageInput {
  name: string;
  planned_start?: string | null;
  planned_end?: string | null;
  status?: StageStatus;
}

export function useAddStage() {
  return useMutation({
    mutationFn: async ({ objectId, input }: { objectId: number; input: StageInput }) =>
      (await api.post<Stage>(`/objects/${objectId}/stages`, input)).data,
    onMutate: async ({ objectId, input }) => {
      const snap = await snapshot(queryClient, [qk.objects]);
      const optimistic: Stage = {
        id: tempId(),
        object_id: objectId,
        name: input.name,
        planned_start: input.planned_start ?? null,
        planned_end: input.planned_end ?? null,
        status: input.status ?? "pending",
      };
      patchList<ConstructionObject>(queryClient, qk.objects, (list) =>
        list.map((o) => (o.id === objectId ? { ...o, stages: [...o.stages, optimistic] } : o))
      );
      return { snap, tempId: optimistic.id, objectId };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSuccess: (real, _v, ctx) => {
      if (!ctx?.tempId) return;
      patchList<ConstructionObject>(queryClient, qk.objects, (list) =>
        list.map((o) =>
          o.id === ctx.objectId
            ? { ...o, stages: o.stages.map((s) => (s.id === ctx.tempId ? real : s)) }
            : o
        )
      );
    },
  });
}

export function useUpdateStage() {
  return useMutation({
    mutationFn: async ({ stageId, input }: { stageId: number; input: StageInput }) =>
      (await api.patch<Stage>(`/objects/stages/${stageId}`, input)).data,
    onMutate: async ({ stageId, input }) => {
      const snap = await snapshot(queryClient, [qk.objects]);
      patchList<ConstructionObject>(queryClient, qk.objects, (list) =>
        list.map((o) => ({
          ...o,
          stages: o.stages.map((s) => (s.id === stageId ? { ...s, ...input } : s)),
        }))
      );
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.objects }),
  });
}

export function useDeleteStage() {
  return useMutation({
    mutationFn: async (stageId: number) => {
      await api.delete(`/objects/stages/${stageId}`);
      return stageId;
    },
    onMutate: async (stageId) => {
      const snap = await snapshot(queryClient, [qk.objects]);
      patchList<ConstructionObject>(queryClient, qk.objects, (list) =>
        list.map((o) => ({ ...o, stages: o.stages.filter((s) => s.id !== stageId) }))
      );
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.objects }),
  });
}
