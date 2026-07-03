import { Plus, Trash2 } from "lucide-react";
import { Button, Input, Select } from "@/shared/ui";
import { fmtQty } from "@/shared/lib/format";
import type { Material } from "@/entities/catalog";

export interface Line {
  material_id: number | "";
  quantity: number | "";
  unit_price?: number | "";
}

interface Props {
  value: Line[];
  onChange: (lines: Line[]) => void;
  materials: Material[];
  withPrice?: boolean;
  showWarehouse?: boolean; // показывать остаток на складе (для развилки)
}

export function ItemsEditor({ value, onChange, materials, withPrice, showWarehouse }: Props) {
  const matById = new Map(materials.map((m) => [m.id, m]));

  const setLine = (i: number, patch: Partial<Line>) =>
    onChange(value.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const addLine = () => onChange([...value, { material_id: "", quantity: "", unit_price: "" }]);
  const removeLine = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const onPickMaterial = (i: number, matId: number) => {
    const m = matById.get(matId);
    setLine(i, {
      material_id: matId,
      unit_price: withPrice ? (m?.default_price ?? 0) : value[i].unit_price,
    });
  };

  return (
    <div className="stack" style={{ gap: 10 }}>
      {value.map((l, i) => {
        const m = typeof l.material_id === "number" ? matById.get(l.material_id) : undefined;
        return (
          <div key={i} className={withPrice ? "items-row with-price" : "items-row"}>
            <Select
              value={l.material_id}
              onChange={(e) => onPickMaterial(i, Number(e.target.value))}
            >
              <option value="">— материал —</option>
              {materials.map((mat) => (
                <option key={mat.id} value={mat.id}>
                  {mat.name} ({mat.unit})
                </option>
              ))}
            </Select>
            <Input
              type="number"
              min={0}
              step="any"
              placeholder="Кол-во"
              value={l.quantity}
              onChange={(e) =>
                setLine(i, { quantity: e.target.value === "" ? "" : Number(e.target.value) })
              }
              suffix={m?.unit}
            />
            {withPrice && (
              <Input
                type="number"
                min={0}
                step="any"
                placeholder="Цена"
                value={l.unit_price ?? ""}
                onChange={(e) =>
                  setLine(i, { unit_price: e.target.value === "" ? "" : Number(e.target.value) })
                }
                suffix="сом."
              />
            )}
            <button
              className="icon-btn icon-btn--danger"
              onClick={() => removeLine(i)}
              title="Убрать"
              type="button"
            >
              <Trash2 size={16} />
            </button>
            {showWarehouse && m && (
              <div className="items-row__hint">
                На складе: <b>{fmtQty(m.warehouse_qty)}</b> {m.unit}
              </div>
            )}
          </div>
        );
      })}
      <Button variant="secondary" size="sm" icon={<Plus size={15} />} onClick={addLine} type="button">
        Добавить позицию
      </Button>
    </div>
  );
}
