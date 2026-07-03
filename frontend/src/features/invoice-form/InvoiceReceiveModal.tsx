import { useState } from "react";
import { Button, Modal, Input, useToast } from "@/shared/ui";
import { apiError } from "@/shared/api/client";
import { fmtQty } from "@/shared/lib/format";
import { useReceiveInvoice, type Invoice } from "@/entities/invoice";

export function InvoiceReceiveModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const toast = useToast();
  const receive = useReceiveInvoice();
  const isInbound = invoice.type === "inbound";
  const [facts, setFacts] = useState<Record<number, number>>(() =>
    Object.fromEntries(invoice.items.map((it) => [it.id, it.qty_planned]))
  );
  const [prices, setPrices] = useState<Record<number, number>>(() =>
    Object.fromEntries(invoice.items.map((it) => [it.id, it.unit_price]))
  );

  const submit = () => {
    const items = invoice.items.map((it) => ({
      item_id: it.id,
      qty_fact: Number(facts[it.id] ?? 0),
      ...(isInbound ? { unit_price: Number(prices[it.id] ?? 0) } : {}),
    }));
    receive.mutate(
      { id: invoice.id, items },
      {
        onSuccess: () => {
          toast.success("Накладная принята, остатки обновлены");
          onClose();
        },
        onError: (e) => toast.error(apiError(e)),
      }
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Приёмка ${invoice.number}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={receive.isPending}>
            Отмена
          </Button>
          <Button onClick={submit} loading={receive.isPending}>
            Принять и сверить
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="soft">
          Сверьте фактическое количество с накладной (ЗАС-21, ЗАС-22). Недобор остаётся у источника,
          накладная приводится к факту.{isInbound ? " Укажите фактическую цену прихода." : ""}
        </div>
        <div className="scroll-x">
          <table className="ark-table">
            <thead>
              <tr>
                <th>Материал</th>
                <th className="num">По накладной</th>
                <th className="num">Факт</th>
                {isInbound && <th className="num">Цена</th>}
                <th className="num">Расхождение</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((it) => {
                const fact = Number(facts[it.id] ?? 0);
                const diff = fact - it.qty_planned;
                return (
                  <tr key={it.id}>
                    <td className="strong">{it.material_name}</td>
                    <td className="num">
                      {fmtQty(it.qty_planned)} {it.unit}
                    </td>
                    <td className="num" style={{ width: 120 }}>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={facts[it.id] ?? 0}
                        onChange={(e) =>
                          setFacts((f) => ({ ...f, [it.id]: Number(e.target.value) }))
                        }
                        suffix={it.unit ?? undefined}
                      />
                    </td>
                    {isInbound && (
                      <td className="num" style={{ width: 120 }}>
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={prices[it.id] ?? 0}
                          onChange={(e) =>
                            setPrices((p) => ({ ...p, [it.id]: Number(e.target.value) }))
                          }
                          suffix="сом."
                        />
                      </td>
                    )}
                    <td className="num">
                      {diff === 0 ? (
                        <span className="muted">0</span>
                      ) : (
                        <span className={diff < 0 ? "money--expense" : "money--income"}>
                          {diff > 0 ? "+" : "−"}
                          {fmtQty(Math.abs(diff))}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
