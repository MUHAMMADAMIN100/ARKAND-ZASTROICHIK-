import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { qk } from "@/shared/api/keys";
import { queryClient } from "@/shared/api/queryClient";
import { listOps, patchList, restore, snapshot, tempId } from "@/shared/api/optimistic";
import type { ApprovalStatus, PaymentMethod, TxnCategory, TxnType } from "@/shared/config/enums";

export interface CashRegister {
  id: number;
  name: string;
  object_id: number | null;
  object_name: string | null;
  limit_amount: number;
  is_active: boolean;
  balance: number;
  turnover: number;
  over_limit: boolean;
}

export interface Transaction {
  id: number;
  object_id: number | null;
  object_name: string | null;
  cash_id: number | null;
  cash_name: string | null;
  type: TxnType;
  category: TxnCategory;
  amount: number;
  payment_method: PaymentMethod;
  is_admin: boolean;
  op_date: string | null;
  description: string;
  ref_type: string | null;
  ref_id: number | null;
  approval_status: ApprovalStatus;
  created_at: string;
}

export interface TxnInput {
  object_id?: number | null;
  cash_id?: number | null;
  type: TxnType;
  category: TxnCategory;
  amount: number;
  payment_method?: PaymentMethod;
  is_admin?: boolean;
  op_date?: string | null;
  description?: string;
}

// ── Кассы ──
export function useCashRegisters() {
  return useQuery({
    queryKey: qk.cash,
    queryFn: async () => (await api.get<CashRegister[]>("/cash")).data,
  });
}

export function useCreateCash() {
  return useMutation({
    mutationFn: async (input: { name: string; object_id?: number | null; limit_amount: number }) =>
      (await api.post<CashRegister>("/cash", input)).data,
    onMutate: async (input) => {
      const snap = await snapshot(queryClient, [qk.cash]);
      const optimistic: CashRegister = {
        id: tempId(),
        name: input.name,
        object_id: input.object_id ?? null,
        object_name: null,
        limit_amount: input.limit_amount,
        is_active: true,
        balance: 0,
        turnover: 0,
        over_limit: false,
      };
      patchList<CashRegister>(queryClient, qk.cash, listOps.prepend(optimistic));
      return { snap, tempId: optimistic.id };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSuccess: (c, _v, ctx) => {
      if (ctx?.tempId) patchList<CashRegister>(queryClient, qk.cash, listOps.replace(ctx.tempId, c));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.cash }),
  });
}

export function useUpdateCash() {
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: number;
      input: Partial<{ name: string; object_id: number | null; limit_amount: number; is_active: boolean }>;
    }) => (await api.patch<CashRegister>(`/cash/${id}`, input)).data,
    onMutate: async ({ id, input }) => {
      const snap = await snapshot(queryClient, [qk.cash]);
      patchList<CashRegister>(queryClient, qk.cash, listOps.update<CashRegister>(id, input));
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.cash }),
  });
}

// ── Транзакции ──
export function useTransactions() {
  return useQuery({
    queryKey: qk.txns,
    queryFn: async () => (await api.get<Transaction[]>("/finance/transactions")).data,
  });
}

function invalidateFinance() {
  queryClient.invalidateQueries({ queryKey: qk.txns });
  queryClient.invalidateQueries({ queryKey: qk.cash });
  queryClient.invalidateQueries({ queryKey: qk.dashboard });
  queryClient.invalidateQueries({ queryKey: qk.objectExpenses });
  queryClient.invalidateQueries({ queryKey: qk.cityAnalytics });
  queryClient.invalidateQueries({ queryKey: qk.estimates });
}

export function useCreateTransaction() {
  return useMutation({
    mutationFn: async (input: TxnInput) =>
      (await api.post<Transaction>("/finance/transactions", input)).data,
    onMutate: async (input) => {
      const snap = await snapshot(queryClient, [qk.txns]);
      const optimistic: Transaction = {
        id: tempId(),
        object_id: input.object_id ?? null,
        object_name: null,
        cash_id: input.cash_id ?? null,
        cash_name: null,
        type: input.type,
        category: input.category,
        amount: input.amount,
        payment_method: input.payment_method ?? "cash",
        is_admin: input.is_admin ?? false,
        op_date: input.op_date ?? null,
        description: input.description ?? "",
        ref_type: null,
        ref_id: null,
        approval_status: "not_required",
        created_at: new Date().toISOString(),
      };
      patchList<Transaction>(queryClient, qk.txns, listOps.prepend(optimistic));
      return { snap, tempId: optimistic.id };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSuccess: (real, _v, ctx) => {
      if (ctx?.tempId) patchList<Transaction>(queryClient, qk.txns, listOps.replace(ctx.tempId, real));
    },
    onSettled: invalidateFinance,
  });
}

export function useUpdateTransaction() {
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: Partial<TxnInput> }) =>
      (await api.patch<Transaction>(`/finance/transactions/${id}`, input)).data,
    onMutate: async ({ id, input }) => {
      const snap = await snapshot(queryClient, [qk.txns]);
      patchList<Transaction>(queryClient, qk.txns, listOps.update<Transaction>(id, input));
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSettled: invalidateFinance,
  });
}

export function useDeleteTransaction() {
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/finance/transactions/${id}`);
      return id;
    },
    onMutate: async (id) => {
      const snap = await snapshot(queryClient, [qk.txns]);
      patchList<Transaction>(queryClient, qk.txns, listOps.remove<Transaction>(id));
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSettled: invalidateFinance,
  });
}

export function useApproveTransaction() {
  return useMutation({
    mutationFn: async ({ id, approve }: { id: number; approve: boolean }) =>
      (
        await api.post<Transaction>(
          `/finance/transactions/${id}/${approve ? "approve" : "reject"}`
        )
      ).data,
    onMutate: async ({ id, approve }) => {
      const snap = await snapshot(queryClient, [qk.txns]);
      patchList<Transaction>(
        queryClient,
        qk.txns,
        listOps.update<Transaction>(id, { approval_status: approve ? "approved" : "rejected" })
      );
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.txns }),
  });
}
