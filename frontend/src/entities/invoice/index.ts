import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { qk } from "@/shared/api/keys";
import { queryClient } from "@/shared/api/queryClient";
import { listOps, patchList, restore, snapshot, tempId } from "@/shared/api/optimistic";
import type { InvoiceStatus, InvoiceType, LocationType } from "@/shared/config/enums";
import type { MaterialRequest } from "@/entities/request";

export interface InvoiceItem {
  id: number;
  material_id: number;
  material_name: string | null;
  unit: string | null;
  qty_planned: number;
  qty_fact: number | null;
  unit_price: number;
  line_total: number;
}

export interface Invoice {
  id: number;
  number: string;
  type: InvoiceType;
  status: InvoiceStatus;
  request_id: number | null;
  source_type: LocationType | null;
  source_id: number | null;
  source_name: string | null;
  dest_type: LocationType;
  dest_id: number;
  dest_name: string | null;
  supplier_id: number | null;
  supplier_name: string | null;
  is_internal_barter: boolean;
  note: string;
  received_at: string | null;
  created_at: string;
  total_amount: number;
  items: InvoiceItem[];
}

export interface InvoiceInput {
  type: InvoiceType;
  request_id?: number | null;
  source_type?: LocationType | null;
  source_id?: number | null;
  dest_type: LocationType;
  dest_id: number;
  supplier_id?: number | null;
  is_internal_barter?: boolean;
  note?: string;
  items: { material_id: number; qty_planned: number; unit_price?: number }[];
}

function invalidateAfterMovement() {
  queryClient.invalidateQueries({ queryKey: qk.invoices });
  queryClient.invalidateQueries({ queryKey: qk.stock });
  queryClient.invalidateQueries({ queryKey: qk.movements });
  queryClient.invalidateQueries({ queryKey: qk.materials });
  queryClient.invalidateQueries({ queryKey: qk.requests });
  queryClient.invalidateQueries({ queryKey: qk.txns });
  queryClient.invalidateQueries({ queryKey: qk.dashboard });
  queryClient.invalidateQueries({ queryKey: qk.objectExpenses });
  queryClient.invalidateQueries({ queryKey: qk.debts });
  queryClient.invalidateQueries({ queryKey: qk.estimates });
}

export function useInvoices() {
  return useQuery({
    queryKey: qk.invoices,
    queryFn: async () => (await api.get<Invoice[]>("/invoices")).data,
  });
}

export function useCreateInvoice() {
  return useMutation({
    mutationFn: async (input: InvoiceInput) => (await api.post<Invoice>("/invoices", input)).data,
    onMutate: async (input) => {
      const snap = await snapshot(queryClient, [qk.invoices]);
      const id = tempId();
      const items: InvoiceItem[] = input.items.map((it, i) => ({
        id: -(i + 1),
        material_id: it.material_id,
        material_name: null,
        unit: null,
        qty_planned: it.qty_planned,
        qty_fact: null,
        unit_price: it.unit_price ?? 0,
        line_total: it.qty_planned * (it.unit_price ?? 0),
      }));
      const isIssue = input.type === "issue";
      const optimistic: Invoice = {
        id,
        number: "…",
        type: input.type,
        status: "shipped",
        request_id: input.request_id ?? null,
        source_type: isIssue ? "WAREHOUSE" : input.source_type ?? null,
        source_id: isIssue ? 0 : input.source_id ?? null,
        source_name: isIssue ? "Центральный склад" : null,
        dest_type: input.dest_type,
        dest_id: input.dest_id,
        dest_name: null,
        supplier_id: input.supplier_id ?? null,
        supplier_name: null,
        is_internal_barter: input.is_internal_barter ?? false,
        note: input.note ?? "",
        received_at: null,
        created_at: new Date().toISOString(),
        total_amount: items.reduce((s, x) => s + x.line_total, 0),
        items,
      };
      patchList<Invoice>(queryClient, qk.invoices, listOps.prepend(optimistic));
      return { snap, tempId: id };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSuccess: (inv, _v, ctx) => {
      if (ctx?.tempId) patchList<Invoice>(queryClient, qk.invoices, listOps.replace(ctx.tempId, inv));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.invoices });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useCreateInvoiceFromRequest() {
  return useMutation({
    mutationFn: async (requestId: number) =>
      (await api.post<Invoice>(`/invoices/from-request/${requestId}`)).data,
    onMutate: async (requestId) => {
      const snap = await snapshot(queryClient, [qk.invoices]);
      const req = queryClient
        .getQueryData<MaterialRequest[]>(qk.requests)
        ?.find((r) => r.id === requestId);
      if (!req) return { snap };
      const isPurchase = req.fulfillment_type === "purchase";
      const id = tempId();
      const items: InvoiceItem[] = req.items.map((it, i) => ({
        id: -(i + 1),
        material_id: it.material_id,
        material_name: it.material_name,
        unit: it.unit,
        qty_planned: it.quantity,
        qty_fact: null,
        unit_price: 0,
        line_total: 0,
      }));
      const optimistic: Invoice = {
        id,
        number: "…",
        type: isPurchase ? "inbound" : "issue",
        status: "shipped",
        request_id: req.id,
        source_type: isPurchase ? null : "WAREHOUSE",
        source_id: isPurchase ? null : 0,
        source_name: isPurchase ? null : "Центральный склад",
        dest_type: isPurchase ? "WAREHOUSE" : "OBJECT",
        dest_id: isPurchase ? 0 : req.object_id,
        dest_name: isPurchase ? "Центральный склад" : req.object_name,
        supplier_id: null,
        supplier_name: null,
        is_internal_barter: false,
        note: `По заявке ${req.number}`,
        received_at: null,
        created_at: new Date().toISOString(),
        total_amount: 0,
        items,
      };
      patchList<Invoice>(queryClient, qk.invoices, listOps.prepend(optimistic));
      return { snap, tempId: id };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSuccess: (inv, _v, ctx) => {
      if (ctx?.tempId) patchList<Invoice>(queryClient, qk.invoices, listOps.replace(ctx.tempId, inv));
      else patchList<Invoice>(queryClient, qk.invoices, (l) => (l.some((x) => x.id === inv.id) ? l : [inv, ...l]));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.invoices });
      queryClient.invalidateQueries({ queryKey: qk.requests });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useReceiveInvoice() {
  return useMutation({
    mutationFn: async ({
      id,
      items,
    }: {
      id: number;
      items: { item_id: number; qty_fact: number; unit_price?: number }[];
    }) => (await api.post<Invoice>(`/invoices/${id}/receive`, { items })).data,
    onMutate: async ({ id, items }) => {
      const snap = await snapshot(queryClient, [qk.invoices]);
      const factMap = new Map(items.map((i) => [i.item_id, i.qty_fact]));
      patchList<Invoice>(queryClient, qk.invoices, (list) =>
        list.map((inv) =>
          inv.id !== id
            ? inv
            : {
                ...inv,
                status: "received",
                items: inv.items.map((it) =>
                  factMap.has(it.id)
                    ? { ...it, qty_fact: factMap.get(it.id)!, line_total: factMap.get(it.id)! * it.unit_price }
                    : it
                ),
              }
        )
      );
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSuccess: (real) => patchList<Invoice>(queryClient, qk.invoices, listOps.replace(real.id, real)),
    onSettled: invalidateAfterMovement,
  });
}

export function useCancelInvoice() {
  return useMutation({
    mutationFn: async (id: number) => (await api.post<Invoice>(`/invoices/${id}/cancel`)).data,
    onMutate: async (id) => {
      const snap = await snapshot(queryClient, [qk.invoices]);
      patchList<Invoice>(queryClient, qk.invoices, listOps.update<Invoice>(id, { status: "cancelled" }));
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSettled: () => queryClient.invalidateQueries({ queryKey: qk.invoices }),
  });
}

export function useDeleteInvoice() {
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/invoices/${id}`);
      return id;
    },
    onMutate: async (id) => {
      const snap = await snapshot(queryClient, [qk.invoices]);
      patchList<Invoice>(queryClient, qk.invoices, listOps.remove<Invoice>(id));
      return { snap };
    },
    onError: (_e, _v, ctx) => restore(queryClient, ctx?.snap),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.invoices });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}
