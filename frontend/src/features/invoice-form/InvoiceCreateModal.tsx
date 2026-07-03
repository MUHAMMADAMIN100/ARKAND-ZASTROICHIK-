import { useState } from "react";
import { Button, Field, Modal, Select, Textarea, useToast } from "@/shared/ui";
import { apiError } from "@/shared/api/client";
import { Segmented } from "@/shared/ui";
import { ItemsEditor, type Line } from "@/features/line-items/ItemsEditor";
import type { InvoiceType, LocationType } from "@/shared/config/enums";
import { useObjects } from "@/entities/object";
import { useMaterials, useSuppliers } from "@/entities/catalog";
import { useCreateInvoice } from "@/entities/invoice";

export function InvoiceCreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { data: objects = [] } = useObjects();
  const { data: materials = [] } = useMaterials();
  const { data: suppliers = [] } = useSuppliers();
  const create = useCreateInvoice();

  const [type, setType] = useState<InvoiceType>("issue");
  const [destKind, setDestKind] = useState<"warehouse" | "object">("warehouse");
  const [objectId, setObjectId] = useState<number | "">("");
  const [supplierId, setSupplierId] = useState<number | "">("");
  const [barter, setBarter] = useState(false);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([{ material_id: "", quantity: "", unit_price: "" }]);

  const isIssue = type === "issue";

  const matById = new Map(materials.map((m) => [m.id, m]));
  const submit = () => {
    const items = lines
      .filter((l) => l.material_id && Number(l.quantity) > 0)
      .map((l) => ({
        material_id: Number(l.material_id),
        qty_planned: Number(l.quantity),
        // для выдачи цена — ориентировочная себестоимость (уточняется при приёмке)
        unit_price: isIssue
          ? matById.get(Number(l.material_id))?.default_price ?? 0
          : Number(l.unit_price || 0),
      }));
    if (items.length === 0) return toast.error("Добавьте позиции");

    let dest_type: LocationType;
    let dest_id: number;
    if (isIssue) {
      if (!objectId) return toast.error("Выберите объект");
      dest_type = "OBJECT";
      dest_id = Number(objectId);
    } else if (destKind === "object") {
      if (!objectId) return toast.error("Выберите объект");
      dest_type = "OBJECT";
      dest_id = Number(objectId);
    } else {
      dest_type = "WAREHOUSE";
      dest_id = 0;
    }

    create.mutate(
      {
        type,
        dest_type,
        dest_id,
        supplier_id: !isIssue && supplierId ? Number(supplierId) : null,
        is_internal_barter: !isIssue && barter,
        note,
        items,
      },
      {
        onSuccess: (inv) => {
          toast.success(`Накладная ${inv.number} создана`);
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
      size="lg"
      title="Новая накладная"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            Отмена
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            Оформить
          </Button>
        </>
      }
    >
      <div className="stack">
        <Field label="Тип накладной">
          <Segmented<InvoiceType>
            value={type}
            onChange={setType}
            items={[
              { value: "issue", label: "Выдача на объект" },
              { value: "inbound", label: "Приход / поставка" },
            ]}
          />
        </Field>

        {isIssue ? (
          <Field label="Объект назначения" required hint="выдача со склада → на объект, автосписание">
            <Select value={objectId} onChange={(e) => setObjectId(Number(e.target.value) || "")}>
              <option value="">— выберите объект —</option>
              {objects.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <>
            <div className="form-grid">
              <Field label="Куда приходуем">
                <Select value={destKind} onChange={(e) => setDestKind(e.target.value as "warehouse" | "object")}>
                  <option value="warehouse">Центральный склад</option>
                  <option value="object">Напрямую на объект (ЗАС-13)</option>
                </Select>
              </Field>
              {destKind === "object" && (
                <Field label="Объект" required>
                  <Select value={objectId} onChange={(e) => setObjectId(Number(e.target.value) || "")}>
                    <option value="">— выберите объект —</option>
                    {objects.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </div>
            <div className="form-grid">
              <Field label="Поставщик">
                <Select value={supplierId} onChange={(e) => setSupplierId(Number(e.target.value) || "")}>
                  <option value="">— не указан —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.is_internal ? " (свой)" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Внутренний бартер">
                <label className="row" style={{ height: 40, gap: 8 }}>
                  <input type="checkbox" checked={barter} onChange={(e) => setBarter(e.target.checked)} />
                  <span className="soft">Фиксировать как долг между бизнесами (ХОЛ-30)</span>
                </label>
              </Field>
            </div>
          </>
        )}

        <Field label="Позиции">
          <ItemsEditor
            value={lines}
            onChange={setLines}
            materials={materials}
            withPrice={!isIssue}
            showWarehouse={isIssue}
          />
        </Field>

        <Field label="Примечание">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Комментарий к накладной" />
        </Field>
      </div>
    </Modal>
  );
}
