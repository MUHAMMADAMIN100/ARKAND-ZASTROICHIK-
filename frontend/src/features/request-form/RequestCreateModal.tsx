import { useState } from "react";
import { Button, Field, Input, Modal, Select, Textarea, useToast } from "@/shared/ui";
import { apiError } from "@/shared/api/client";
import { ItemsEditor, type Line } from "@/features/line-items/ItemsEditor";
import { useObjects } from "@/entities/object";
import { useMaterials } from "@/entities/catalog";
import { useCreateRequest } from "@/entities/request";

export function RequestCreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { data: objects = [] } = useObjects();
  const { data: materials = [] } = useMaterials();
  const create = useCreateRequest();

  const [objectId, setObjectId] = useState<number | "">("");
  const [neededDate, setNeededDate] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([{ material_id: "", quantity: "" }]);

  const submit = () => {
    if (!objectId) return toast.error("Выберите объект");
    const items = lines
      .filter((l) => l.material_id && Number(l.quantity) > 0)
      .map((l) => ({ material_id: Number(l.material_id), quantity: Number(l.quantity) }));
    if (items.length === 0) return toast.error("Добавьте хотя бы одну позицию");

    create.mutate(
      { object_id: Number(objectId), needed_date: neededDate || null, note, items },
      {
        onSuccess: () => {
          toast.success("Заявка создана и отправлена снабжению");
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
      title="Новая заявка на материалы"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            Отмена
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            Создать заявку
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="form-grid">
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
          <Field label="Нужно к дате">
            <Input type="date" value={neededDate} onChange={(e) => setNeededDate(e.target.value)} />
          </Field>
        </div>

        <Field label="Позиции">
          <ItemsEditor value={lines} onChange={setLines} materials={materials} showWarehouse />
        </Field>

        <Field label="Примечание">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Например: для устройства фундамента"
          />
        </Field>
      </div>
    </Modal>
  );
}
