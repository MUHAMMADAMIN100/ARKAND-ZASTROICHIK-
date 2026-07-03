import { useState } from "react";
import { Button, Field, Input, Modal, Select, Segmented, Textarea, useToast } from "@/shared/ui";
import { apiError } from "@/shared/api/client";
import { todayISO } from "@/shared/lib/format";
import { PAYMENT_LABELS, TXN_CATEGORY_LABELS } from "@/shared/config/labels";
import type { PaymentMethod, TxnCategory, TxnType } from "@/shared/config/enums";
import { useObjects } from "@/entities/object";
import { useCashRegisters, useCreateCash, useCreateTransaction } from "@/entities/finance";

const INCOME_CATS: TxnCategory[] = ["sale_income", "other"];
const EXPENSE_CATS: TxnCategory[] = ["material", "work", "tech", "admin", "salary", "other"];

export function TxnCreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { data: objects = [] } = useObjects();
  const { data: cashes = [] } = useCashRegisters();
  const create = useCreateTransaction();

  const [type, setType] = useState<TxnType>("expense");
  const [category, setCategory] = useState<TxnCategory>("material");
  const [objectId, setObjectId] = useState<number | "">("");
  const [cashId, setCashId] = useState<number | "">("");
  const [amount, setAmount] = useState<number | "">("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [isAdmin, setIsAdmin] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [desc, setDesc] = useState("");

  const cats = type === "income" ? INCOME_CATS : EXPENSE_CATS;

  const switchType = (t: TxnType) => {
    setType(t);
    setCategory(t === "income" ? "sale_income" : "material");
  };

  const submit = () => {
    if (!amount || Number(amount) <= 0) return toast.error("Укажите сумму больше нуля");
    create.mutate(
      {
        type,
        category,
        object_id: objectId ? Number(objectId) : null,
        cash_id: cashId ? Number(cashId) : null,
        amount: Number(amount),
        payment_method: method,
        is_admin: isAdmin,
        op_date: date || null,
        description: desc,
      },
      {
        onSuccess: () => {
          toast.success(type === "income" ? "Доход добавлен" : "Расход добавлен");
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
      title="Новая операция"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={create.isPending}>
            Отмена
          </Button>
          <Button onClick={submit} loading={create.isPending}>
            Добавить
          </Button>
        </>
      }
    >
      <div className="stack">
        <Field label="Тип">
          <Segmented<TxnType>
            value={type}
            onChange={switchType}
            items={[
              { value: "expense", label: "Расход" },
              { value: "income", label: "Доход" },
            ]}
          />
        </Field>

        <div className="form-grid">
          <Field label="Категория">
            <Select value={category} onChange={(e) => setCategory(e.target.value as TxnCategory)}>
              {cats.map((c) => (
                <option key={c} value={c}>
                  {TXN_CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Сумма" required>
            <Input
              type="number"
              min={0}
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
              suffix="сом."
              autoFocus
            />
          </Field>
        </div>

        <div className="form-grid">
          <Field label="Объект" hint={type === "income" ? "доход от продажи квартир (ЗАС-41)" : "расход ляжет на объект"}>
            <Select value={objectId} onChange={(e) => setObjectId(Number(e.target.value) || "")}>
              <option value="">— общий / без объекта —</option>
              {objects.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Касса">
            <Select value={cashId} onChange={(e) => setCashId(Number(e.target.value) || "")}>
              <option value="">— без кассы —</option>
              {cashes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="form-grid">
          <Field label="Способ оплаты">
            <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {(["cash", "transfer"] as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_LABELS[m]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Дата">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

        {type === "expense" && (
          <label className="row" style={{ gap: 8 }}>
            <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
            <span className="soft">Административный расход (учитывается отдельно от объекта, ЗАС-42)</span>
          </label>
        )}

        <Field label="Описание">
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Назначение операции" />
        </Field>
      </div>
    </Modal>
  );
}

export function CashCreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const { data: objects = [] } = useObjects();
  const create = useCreateCash();
  const [name, setName] = useState("");
  const [objectId, setObjectId] = useState<number | "">("");
  const [limit, setLimit] = useState<number | "">("");

  const submit = () => {
    if (!name.trim()) return toast.error("Укажите название кассы");
    create.mutate(
      { name: name.trim(), object_id: objectId ? Number(objectId) : null, limit_amount: Number(limit || 0) },
      {
        onSuccess: () => {
          toast.success("Касса создана");
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
      title="Новая касса"
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
        <Field label="Название" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Касса ЖК «Феникс»" autoFocus />
        </Field>
        <Field label="Объект">
          <Select value={objectId} onChange={(e) => setObjectId(Number(e.target.value) || "")}>
            <option value="">— не привязана —</option>
            {objects.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Лимит оборота" hint="КАС-03 · при превышении — предупреждение">
          <Input
            type="number"
            min={0}
            step="any"
            value={limit}
            onChange={(e) => setLimit(e.target.value === "" ? "" : Number(e.target.value))}
            suffix="сом."
          />
        </Field>
      </div>
    </Modal>
  );
}
