import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { qk } from "@/shared/api/keys";
import { queryClient } from "@/shared/api/queryClient";
import { listOps, patchList, restore, snapshot, tempId } from "@/shared/api/optimistic";
import type { Role } from "@/shared/config/enums";
import type { User } from "@/entities/session";

// ── Настройки лимитов ──
export interface Settings {
  expense_limit: number;
  large_threshold: number;
}

export function useSettings() {
  return useQuery({
    queryKey: qk.settings,
    queryFn: async () => (await api.get<Settings>("/settings")).data,
  });
}

export function useUpdateSettings() {
  return useMutation({
    mutationFn: async (input: Partial<Settings>) =>
      (await api.put<Settings>("/settings", input)).data,
    onMutate: async (input) => {
      const snap = await snapshot(queryClient, [qk.settings]);
      queryClient.setQueryData<Settings>(qk.settings, (s) => (s ? { ...s, ...input } : s));
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSuccess: (real) => queryClient.setQueryData(qk.settings, real),
  });
}

// ── Долги между бизнесами ──
export interface Debt {
  id: number;
  from_business: string;
  to_business: string;
  amount: number;
  status: string;
  ref_type: string | null;
  ref_id: number | null;
  note: string;
  created_at: string;
}

export function useDebts() {
  return useQuery({
    queryKey: qk.debts,
    queryFn: async () => (await api.get<Debt[]>("/debts")).data,
  });
}

export function useSettleDebt() {
  return useMutation({
    mutationFn: async (id: number) => (await api.post<Debt>(`/debts/${id}/settle`)).data,
    onMutate: async (id) => {
      const snap = await snapshot(queryClient, [qk.debts]);
      patchList<Debt>(queryClient, qk.debts, listOps.update<Debt>(id, { status: "settled" }));
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.debts }),
  });
}

// ── Пользователи ──
export function useUsers() {
  return useQuery({
    queryKey: qk.users,
    queryFn: async () => (await api.get<User[]>("/users")).data,
  });
}

export function useCreateUser() {
  return useMutation({
    mutationFn: async (input: { full_name: string; username: string; password: string; role: Role }) =>
      (await api.post<User>("/users", input)).data,
    onMutate: async (input) => {
      const snap = await snapshot(queryClient, [qk.users]);
      const optimistic: User = {
        id: tempId(),
        full_name: input.full_name,
        username: input.username,
        role: input.role,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      patchList<User>(queryClient, qk.users, (l) => [...l, optimistic]);
      return { snap, tempId: optimistic.id };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSuccess: (u, _v, ctx) => {
      if (ctx?.tempId) patchList<User>(queryClient, qk.users, listOps.replace(ctx.tempId, u));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.users }),
  });
}

export function useUpdateUser() {
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: number;
      input: Partial<{ full_name: string; password: string; role: Role; is_active: boolean }>;
    }) => (await api.patch<User>(`/users/${id}`, input)).data,
    onMutate: async ({ id, input }) => {
      const snap = await snapshot(queryClient, [qk.users]);
      patchList<User>(queryClient, qk.users, listOps.update<User>(id, input));
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.users }),
  });
}

// ── KPI (заглушка) ──
export interface KpiData {
  note: string;
  roles: { role: string; label: string; metrics: string[] }[];
}
export function useKpi() {
  return useQuery({
    queryKey: qk.kpi,
    queryFn: async () => (await api.get<KpiData>("/kpi")).data,
  });
}
