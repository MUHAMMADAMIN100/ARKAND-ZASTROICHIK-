import type { Invoice } from "@/entities/invoice";
import { INVOICE_TYPE_LABELS } from "@/shared/config/labels";
import { fmtDate, fmtMoney, fmtQty } from "./format";

/** Открывает печатную форму накладной (ЗАС-20 · «электронно и на бумаге»). */
export function printInvoice(inv: Invoice) {
  const rows = inv.items
    .map((it, i) => {
      const q = it.qty_fact ?? it.qty_planned;
      return `<tr>
        <td>${i + 1}</td>
        <td>${it.material_name ?? ""}</td>
        <td style="text-align:right">${fmtQty(q)} ${it.unit ?? ""}</td>
        <td style="text-align:right">${fmtMoney(it.unit_price)}</td>
        <td style="text-align:right">${fmtMoney(q * it.unit_price)}</td>
      </tr>`;
    })
    .join("");

  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
  <title>Накладная ${inv.number}</title>
  <style>
    body{font-family:Arial,sans-serif;color:#1a1416;padding:32px;max-width:800px;margin:0 auto}
    h1{font-size:20px;margin:0 0 4px}
    .sub{color:#655d58;font-size:13px;margin-bottom:20px}
    .meta{display:flex;gap:40px;margin-bottom:16px;font-size:14px}
    .meta div b{display:block;color:#8b827c;font-weight:600;font-size:12px}
    table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
    th,td{border:1px solid #d8d2ce;padding:8px 10px;text-align:left}
    th{background:#f4f2f0;font-size:12px;text-transform:uppercase}
    tfoot td{font-weight:700}
    .sign{display:flex;justify-content:space-between;margin-top:60px;font-size:13px}
    .sign div{width:45%;border-top:1px solid #1a1416;padding-top:6px;color:#655d58}
    @media print{body{padding:0}}
  </style></head><body>
    <h1>Накладная № ${inv.number}</h1>
    <div class="sub">Arkand · Застройщик — ${INVOICE_TYPE_LABELS[inv.type]}</div>
    <div class="meta">
      <div><b>Дата</b>${fmtDate(inv.created_at)}</div>
      <div><b>Откуда</b>${inv.source_name ?? "—"}</div>
      <div><b>Куда</b>${inv.dest_name ?? "—"}</div>
      ${inv.supplier_name ? `<div><b>Поставщик</b>${inv.supplier_name}</div>` : ""}
    </div>
    <table>
      <thead><tr><th>№</th><th>Материал</th><th style="text-align:right">Кол-во</th><th style="text-align:right">Цена</th><th style="text-align:right">Сумма</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="4" style="text-align:right">Итого:</td><td style="text-align:right">${fmtMoney(inv.total_amount)} сом.</td></tr></tfoot>
    </table>
    <div class="sign"><div>Отпустил</div><div>Принял</div></div>
    <script>window.onload=function(){window.print()}</script>
  </body></html>`;

  const w = window.open("", "_blank", "width=820,height=900");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}
