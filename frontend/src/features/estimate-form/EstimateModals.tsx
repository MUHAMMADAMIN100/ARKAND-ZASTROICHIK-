import { useState } from "react";
import { Button, Field, Input, Modal, Select, useToast } from "@/shared/ui";
import { apiError } from "@/shared/api/client";
import { ESTIMATE_CATEGORY_LABELS } from "@/shared/config/labels";
import type { EstimateCategory } from "@/shared/config/enums";
import { useObjects } from "@/entities/object";
import {
  useCreateEstimate,
  useAddEstimateItem,
  useUpdateEstimateItem,
  type EstimateItem,
} from "@/entities/estimate";

const CATEGORIES: EstimateCategory[] = ["material", "work", "tech", "money", "other"];

export function EstimateCreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { data: objects = [] } = useObjects();
  const create = useCreateEstimate();
  const [objectId, setObjectId] = useState<number | "">("");
  const [name, setName] = useState("Смета по объекту");

  const submit = () => {
    if (!objectId) return toast.error("Выберите объект");
    create.mutate(
      { object_id: Number(objectId), name: name.trim() || "Смета по объекту" },
      {
        onSuccess: () => {
          toast.success("Смета создана");
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
      title="Новая смета"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            Отмена
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            Создать
          </Button>
        </>
      }
    >
      <div className="stack">
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
        <Field label="Название сметы">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

interface ItemModalProps {
  open: boolean;
  onClose: () => void;
  estimateId: number;
  edit?: EstimateItem;
}

export function EstimateItemModal({ open, onClose, estimateId, edit }: ItemModalProps) {
  const toast = useToast();
  const add = useAddEstimateItem();
  const update = useUpdateEstimateItem();
  const [form, setForm] = useState(() => ({
    category: edit?.category ?? ("material" as EstimateCategory),
    name: edit?.name ?? "",
    unit: edit?.unit ?? "",
    qty_plan: edit?.qty_plan ?? 0,
    price_plan: edit?.price_plan ?? 0,
  }));

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const pending = add.isPending || update.isPending;

  const submit = () => {
    if (!form.name.trim()) return toast.error("Укажите наименование");
    const done = () => {
      toast.success(edit ? "Позиция обновлена" : "Позиция добавлена");
      onClose();
    };
    if (edit) {
      update.mutate(
        { itemId: edit.id, input: form },
        { onSuccess: done, onError: (e) => toast.error(apiError(e)) }
      );
    } else {
      add.mutate(
        { estimateId, input: form },
        { onSuccess: done, onError: (e) => toast.error(apiError(e)) }
      );
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={edit ? "Позиция сметы" : "Новая позиция сметы"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={submit} loading={pending}>
            {edit ? "Сохранить" : "Добавить"}
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="form-grid">
          <Field label="Категория">
            <Select value={form.category} onChange={(e) => set("category", e.target.value as EstimateCategory)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {ESTIMATE_CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ед. изм.">
            <Input value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="м³, шт…" />
          </Field>
        </div>
        <Field label="Наименование" required>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Монолитные работы" autoFocus />
        </Field>
        <div className="form-grid">
          <Field label="Кол-во (план)">
            <Input
              type="number"
              min={0}
              step="any"
              value={form.qty_plan}
              onChange={(e) => set("qty_plan", Number(e.target.value))}
            />
          </Field>
          <Field label="Цена (план)">
            <Input
              type="number"
              min={0}
              step="any"
              value={form.price_plan}
              onChange={(e) => set("price_plan", Number(e.target.value))}
              suffix="сом."
            />
          </Field>
        </div>
        <div className="soft">
          Сумма плана: <b>{(form.qty_plan * form.price_plan).toLocaleString("ru-RU")} сом.</b>
        </div>
      </div>
    </Modal>
  );
}
