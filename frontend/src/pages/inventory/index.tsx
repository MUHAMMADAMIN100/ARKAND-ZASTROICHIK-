import { useState } from "react";
import { Plus, ClipboardCheck, AlertTriangle } from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  Loader,
  Money,
  PageHeader,
  Panel,
} from "@/shared/ui";
import { fmtDate, fmtQty } from "@/shared/lib/format";
import { INVENTORY_STATUS_LABELS, INVENTORY_STATUS_TONE, INVENTORY_TYPE_LABELS } from "@/shared/config/labels";
import { useInventories, type Inventory } from "@/entities/inventory";
import { InventoryStartModal, InventoryCountModal } from "@/features/inventory-form/InventoryModals";

export function InventoryPage() {
  const { data: inventories = [], isLoading } = useInventories();
  const [startOpen, setStartOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const selected = inventories.find((i) => i.id === selectedId) ?? null;
  const active = inventories.find((i) => i.status === "in_progress");

  if (isLoading) return <Loader label="Загрузка инвентаризаций…" />;

  return (
    <>
      <PageHeader
        title="Инвентаризация склада"
        subtitle="ЗАС-50…52 · пересчёт с блокировкой движений"
        actions={
          <Button icon={<Plus size={18} />} onClick={() => setStartOpen(true)}>
            Запустить
          </Button>
        }
      />

      {active && (
        <Panel className="card" bodyPad>
          <div className="row row--between" style={{ flexWrap: "wrap", gap: 12 }}>
            <div className="row" style={{ gap: 12 }}>
              <span className="stat__icon stat__icon--warning">
                <AlertTriangle size={18} />
              </span>
              <div>
                <div className="strong">Идёт инвентаризация {active.number}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {INVENTORY_TYPE_LABELS[active.type]}
                  {active.category_filter ? ` · ${active.category_filter}` : ""} · движения заблокированы
                </div>
              </div>
            </div>
            <Button onClick={() => setSelectedId(active.id)}>Продолжить пересчёт</Button>
          </div>
        </Panel>
      )}

      <div style={{ marginTop: active ? 16 : 0 }}>
        <Panel bodyPad={false}>
          {inventories.length === 0 ? (
            <div className="panel-body">
              <EmptyState
                icon={<ClipboardCheck size={40} strokeWidth={1.5} />}
                title="Инвентаризаций не было"
                hint="Запустите полную или частичную инвентаризацию склада"
              />
            </div>
          ) : (
            <div className="scroll-x">
              <table className="ark-table">
                <thead>
                  <tr>
                    <th>№</th>
                    <th>Тип</th>
                    <th>Дата</th>
                    <th className="num">Позиций</th>
                    <th className="num">Расхождение</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {inventories.map((inv: Inventory) => (
                    <tr key={inv.id} className="is-clickable" onClick={() => setSelectedId(inv.id)}>
                      <td className="strong nowrap">{inv.number}</td>
                      <td>
                        {INVENTORY_TYPE_LABELS[inv.type]}
                        {inv.category_filter ? ` · ${inv.category_filter}` : ""}
                      </td>
                      <td className="nowrap muted">{fmtDate(inv.created_at)}</td>
                      <td className="num">{inv.items.length}</td>
                      <td className="num">
                        {inv.total_cost_diff === 0 ? (
                          <span className="muted">{fmtQty(inv.total_qty_diff)}</span>
                        ) : (
                          <Money value={inv.total_cost_diff} kind="auto" signed />
                        )}
                      </td>
                      <td>
                        <Badge tone={INVENTORY_STATUS_TONE[inv.status]} dot>
                          {INVENTORY_STATUS_LABELS[inv.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {startOpen && <InventoryStartModal open={startOpen} onClose={() => setStartOpen(false)} />}
      {selected && <InventoryCountModal inv={selected} onClose={() => setSelectedId(null)} />}
    </>
  );
}
