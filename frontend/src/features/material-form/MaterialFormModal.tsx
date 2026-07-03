import { useState } from "react";
import { Button, Field, Input, Modal, useToast } from "@/shared/ui";
import { apiError } from "@/shared/api/client";
import {
  useCreateMaterial,
  useUpdateMaterial,
  type Material,
  type MaterialInput,
} from "@/entities/catalog";

interface Props {
  open: boolean;
  onClose: () => void;
  edit?: Material;
}

export function MaterialFormModal({ open, onClose, edit }: Props) {
  const toast = useToast();
  const create = useCreateMaterial();
  const update = useUpdateMaterial();

  const [form, setForm] = useState<MaterialInput>(() => ({
    name: edit?.name ?? "",
    unit: edit?.unit ?? "шт",
    category: edit?.category ?? "Прочее",
    sku: edit?.sku ?? "",
    min_stock: edit?.min_stock ?? 0,
    default_price: edit?.default_price ?? 0,
  }));

  const set = <K extends keyof MaterialInput>(k: K, v: MaterialInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const pending = create.isPending || update.isPending;

  const submit = () => {
    if (!form.name.trim()) return toast.error("Укажите название материала");
    const payload = { ...form, name: form.name.trim() };
    const done = (msg: string) => {
      toast.success(msg);
      onClose();
    };
    if (edit) {
      update.mutate(
        { id: edit.id, input: payload },
        { onSuccess: () => done("Материал обновлён"), onError: (e) => toast.error(apiError(e)) }
      );
    } else {
      create.mutate(payload, {
        onSuccess: () => done("Материал добавлен"),
        onError: (e) => toast.error(apiError(e)),
      });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={edit ? "Редактировать материал" : "Новый материал"}
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
        <Field label="Название" required>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Цемент М400" autoFocus />
        </Field>
        <div className="form-grid">
          <Field label="Ед. измерения">
            <Input value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="шт, м³, кг, тонна" />
          </Field>
          <Field label="Категория">
            <Input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="Вяжущие" />
          </Field>
        </div>
        <div className="form-grid">
          <Field label="Мин. остаток" hint="дефицит подсвечивается">
            <Input
              type="number"
              min={0}
              step="any"
              value={form.min_stock}
              onChange={(e) => set("min_stock", Number(e.target.value))}
            />
          </Field>
          <Field label="Цена по умолчанию">
            <Input
              type="number"
              min={0}
              step="any"
              value={form.default_price}
              onChange={(e) => set("default_price", Number(e.target.value))}
              suffix="сом."
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
