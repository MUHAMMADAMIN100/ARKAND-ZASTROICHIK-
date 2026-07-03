import { useMemo, useState } from "react";
import { Button, Field, Input, Modal, Segmented, Select, Textarea, useToast, Badge } from "@/shared/ui";
import { apiError } from "@/shared/api/client";
import { fmtMoney, fmtQty } from "@/shared/lib/format";
import { INVENTORY_STATUS_LABELS, INVENTORY_STATUS_TONE } from "@/shared/config/labels";
import type { InventoryType } from "@/shared/config/enums";
import { useMaterials } from "@/entities/catalog";
import {
  useStartInventory,
  useCountInventory,
  useCompleteInventory,
  useCancelInventory,
  type Inventory,
} from "@/entities/inventory";

export function InventoryStartModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { data: materials = [] } = useMaterials();
  const start = useStartInventory();
  const [type, setType] = useState<InventoryType>("full");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");

  const categories = useMemo(
    () => [...new Set(materials.map((m) => m.category))].sort(),
    [materials]
  );

  const submit = () => {
    if (type === "partial" && !category) return toast.error("Выберите группу для частичной инвентаризации");
    start.mutate(
      { type, category_filter: type === "partial" ? category : "", note },
      {
        onSuccess: () => {
          toast.success("Инвентаризация запущена, движения заблокированы");
          onClose();
        },
        onError: (e) => toast.error(apiError(e)),
      }
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Запустить инвентаризацию"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={start.isPending}>
            Отмена
          </Button>
          <Button onClick={submit} loading={start.isPending}>
            Запустить
          </Button>
        </>
      }
    >
      <div className="stack">
        <Field label="Тип" hint="частичная блокирует только выбранную группу (ЗАС-51)">
          <Segmented<InventoryType>
            value={type}
            onChange={setType}
            items={[
              { value: "full", label: "Полная (весь склад)" },
              { value: "partial", label: "Частичная (группа)" },
            ]}
          />
        </Field>
        {type === "partial" && (
          <Field label="Группа материалов" required>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">— выберите группу —</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Примечание">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Комментарий" />
        </Field>
      </div>
    </Modal>
  );
}

export function InventoryCountModal({ inv, onClose }: { inv: Inventory; onClose: () => void }) {
  const toast = useToast();
  const count = useCountInventory();
  const complete = useCompleteInventory();
  const cancel = useCancelInventory();
  const readOnly = inv.status !== "in_progress";

  const [facts, setFacts] = useState<Record<number, string>>(() =>
    Object.fromEntries(inv.items.map((it) => [it.id, it.qty_fact != null ? String(it.qty_fact) : ""]))
  );

  const changedItems = () =>
    inv.items
      .filter((it) => facts[it.id] !== "" && facts[it.id] != null)
      .map((it) => ({ item_id: it.id, qty_fact: Number(facts[it.id]) }));

  const saveCount = (then?: () => void) => {
    const items = changedItems();
    count.mutate(
      { id: inv.id, items },
      { onSuccess: () => then?.(), onError: (e) => toast.error(apiError(e)) }
    );
  };

  const doComplete = () => {
    saveCount(() =>
      complete.mutate(inv.id, {
        onSuccess: () => {
          toast.success("Инвентаризация завершена, остатки скорректированы");
          onClose();
        },
        onError: (e) => toast.error(apiError(e)),
      })
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={
        <span className="row" style={{ gap: 10 }}>
          {inv.number} · {inv.type === "full" ? "Полная" : `Частичная · ${inv.category_filter}`}
          <Badge tone={INVENTORY_STATUS_TONE[inv.status]} dot>
            {INVENTORY_STATUS_LABELS[inv.status]}
          </Badge>
        </span>
      }
      footer={
        readOnly ? (
          <Button onClick={onClose}>Закрыть</Button>
        ) : (
          <>
            <Button variant="danger" onClick={() => cancel.mutate(inv.id, { onSuccess: onClose })}>
              Отменить
            </Button>
            <Button variant="secondary" onClick={() => saveCount(() => toast.success("Пересчёт сохранён"))} loading={count.isPending}>
              Сохранить
            </Button>
            <Button onClick={doComplete} loading={complete.isPending}>
              Завершить
            </Button>
          </>
        )
      }
    >
      <div className="stack">
        {!readOnly && (
          <div className="soft">
            Введите фактическое количество. Непосчитанные позиции остаются без изменений. Расхождения фиксируются
            в количестве и сумме (ЗАС-52).
          </div>
        )}
        <div className="scroll-x">
          <table className="ark-table">
            <thead>
              <tr>
                <th>Материал</th>
                <th className="num">В системе</th>
                <th className="num">Факт</th>
                <th className="num">Расхождение</th>
                <th className="num">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((it) => {
                const raw = facts[it.id];
                const fact = raw === "" || raw == null ? null : Number(raw);
                const diff = fact == null ? null : fact - it.qty_system;
                const cost = diff == null ? null : diff * it.unit_price;
                return (
                  <tr key={it.id}>
                    <td className="strong">{it.material_name}</td>
                    <td className="num">
                      {fmtQty(it.qty_system)} {it.unit}
                    </td>
                    <td className="num" style={{ width: 120 }}>
                      {readOnly ? (
                        it.qty_fact != null ? (
                          `${fmtQty(it.qty_fact)} ${it.unit}`
                        ) : (
                          "—"
                        )
                      ) : (
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={raw ?? ""}
                          onChange={(e) => setFacts((f) => ({ ...f, [it.id]: e.target.value }))}
                          placeholder="—"
                        />
                      )}
                    </td>
                    <td className="num">
                      {diff == null || diff === 0 ? (
                        <span className="muted">{diff === 0 ? "0" : "—"}</span>
                      ) : (
                        <span className={diff < 0 ? "money--expense" : "money--income"}>
                          {diff > 0 ? "+" : "−"}
                          {fmtQty(Math.abs(diff))}
                        </span>
                      )}
                    </td>
                    <td className="num">
                      {cost == null || cost === 0 ? (
                        <span className="muted">—</span>
                      ) : (
                        <span className={cost < 0 ? "money--expense" : "money--income"}>
                          {fmtMoney(Math.abs(cost))}
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
