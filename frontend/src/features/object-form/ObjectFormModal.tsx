import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { Button, Field, Input, Modal, Select, Textarea, useToast, IconButton } from "@/shared/ui";
import { apiError } from "@/shared/api/client";
import { OBJECT_STATUS_LABELS, ROLE_LABELS } from "@/shared/config/labels";
import type { ObjectStatus } from "@/shared/config/enums";
import {
  useCreateObject,
  useUpdateObject,
  type ConstructionObject,
  type ObjectInput,
} from "@/entities/object";
import { useCities, useCreateCity } from "@/entities/catalog";
import { useUsers } from "@/entities/admin";

interface Props {
  open: boolean;
  onClose: () => void;
  edit?: ConstructionObject;
}

const STATUSES: ObjectStatus[] = ["planning", "in_progress", "on_hold", "done"];

export function ObjectFormModal({ open, onClose, edit }: Props) {
  const toast = useToast();
  const { data: cities = [] } = useCities();
  const { data: users = [] } = useUsers();
  const createObject = useCreateObject();
  const updateObject = useUpdateObject();
  const createCity = useCreateCity();

  const [form, setForm] = useState<ObjectInput>(() => ({
    name: edit?.name ?? "",
    address: edit?.address ?? "",
    city_id: edit?.city_id ?? null,
    responsible_id: edit?.responsible_id ?? null,
    status: edit?.status ?? "planning",
    start_date: edit?.start_date ?? null,
    deadline: edit?.deadline ?? null,
    description: edit?.description ?? "",
  }));
  const [newCity, setNewCity] = useState("");
  const [addingCity, setAddingCity] = useState(false);

  const set = <K extends keyof ObjectInput>(k: K, v: ObjectInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const pending = createObject.isPending || updateObject.isPending;

  const addCity = () => {
    const name = newCity.trim();
    if (!name) return;
    createCity.mutate(name, {
      onSuccess: (c) => {
        set("city_id", c.id);
        setNewCity("");
        setAddingCity(false);
        toast.success("Город добавлен");
      },
      onError: (e) => toast.error(apiError(e)),
    });
  };

  const submit = () => {
    if (!form.name.trim()) {
      toast.error("Укажите название объекта");
      return;
    }
    const payload = { ...form, name: form.name.trim() };
    if (edit) {
      updateObject.mutate(
        { id: edit.id, input: payload },
        {
          onSuccess: () => {
            toast.success("Объект обновлён");
            onClose();
          },
          onError: (e) => toast.error(apiError(e)),
        }
      );
    } else {
      createObject.mutate(payload, {
        onSuccess: () => {
          toast.success("Объект создан");
          onClose();
        },
        onError: (e) => toast.error(apiError(e)),
      });
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={edit ? "Редактировать объект" : "Новый объект"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button onClick={submit} loading={pending}>
            {edit ? "Сохранить" : "Создать"}
          </Button>
        </>
      }
    >
      <div className="stack">
        <Field label="Название объекта" required>
          <Input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="ЖК «Феникс», 12 этажей"
            autoFocus
          />
        </Field>

        <div className="form-grid">
          <Field label="Город">
            {addingCity ? (
              <div className="row" style={{ gap: 6 }}>
                <Input
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  placeholder="Новый город"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCity())}
                  autoFocus
                />
                <IconButton onClick={addCity} title="Добавить">
                  <Check size={18} />
                </IconButton>
              </div>
            ) : (
              <div className="row" style={{ gap: 6 }}>
                <Select
                  value={form.city_id ?? ""}
                  onChange={(e) => set("city_id", e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">— не выбран —</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <IconButton onClick={() => setAddingCity(true)} title="Добавить город">
                  <Plus size={18} />
                </IconButton>
              </div>
            )}
          </Field>

          <Field label="Статус">
            <Select value={form.status} onChange={(e) => set("status", e.target.value as ObjectStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {OBJECT_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Адрес">
          <Input
            value={form.address ?? ""}
            onChange={(e) => set("address", e.target.value)}
            placeholder="ул. Рудаки, 145"
          />
        </Field>

        <Field label="Ответственный (прораб)">
          <Select
            value={form.responsible_id ?? ""}
            onChange={(e) =>
              set("responsible_id", e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">— не выбран —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} · {ROLE_LABELS[u.role]}
              </option>
            ))}
          </Select>
        </Field>

        <div className="form-grid">
          <Field label="Начало">
            <Input
              type="date"
              value={form.start_date ?? ""}
              onChange={(e) => set("start_date", e.target.value || null)}
            />
          </Field>
          <Field label="Срок сдачи">
            <Input
              type="date"
              value={form.deadline ?? ""}
              onChange={(e) => set("deadline", e.target.value || null)}
            />
          </Field>
        </div>

        <Field label="Описание">
          <Textarea
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Краткое описание объекта"
          />
        </Field>
      </div>
    </Modal>
  );
}
