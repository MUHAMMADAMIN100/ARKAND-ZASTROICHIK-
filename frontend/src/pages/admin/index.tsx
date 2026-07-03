import { useState } from "react";
import { Plus, Save, Gauge } from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Loader,
  Modal,
  Money,
  PageHeader,
  Panel,
  Select,
  Tabs,
  useToast,
} from "@/shared/ui";
import { apiError } from "@/shared/api/client";
import { fmtDate } from "@/shared/lib/format";
import { ROLE_LABELS } from "@/shared/config/labels";
import type { Role } from "@/shared/config/enums";
import {
  useSettings,
  useUpdateSettings,
  useDebts,
  useSettleDebt,
  useUsers,
  useCreateUser,
  useUpdateUser,
  useKpi,
} from "@/entities/admin";

type Tab = "settings" | "users" | "debts" | "kpi";
const ROLES: Role[] = ["foreman", "sales", "storekeeper", "cashier", "supply", "owner", "admin"];

function UserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const create = useCreateUser();
  const [form, setForm] = useState({ full_name: "", username: "", password: "", role: "foreman" as Role });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.full_name.trim() || !form.username.trim() || !form.password.trim())
      return toast.error("Заполните все поля");
    create.mutate(
      { ...form, username: form.username.trim().toLowerCase() },
      {
        onSuccess: () => {
          toast.success("Пользователь создан");
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
      title="Новый пользователь"
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
        <Field label="ФИО" required>
          <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} autoFocus />
        </Field>
        <div className="form-grid">
          <Field label="Логин" required>
            <Input value={form.username} onChange={(e) => set("username", e.target.value)} />
          </Field>
          <Field label="Пароль" required>
            <Input value={form.password} onChange={(e) => set("password", e.target.value)} />
          </Field>
        </div>
        <Field label="Роль">
          <Select value={form.role} onChange={(e) => set("role", e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

export function AdminPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("settings");
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const { data: debts = [] } = useDebts();
  const settle = useSettleDebt();
  const { data: users = [] } = useUsers();
  const updateUser = useUpdateUser();
  const { data: kpi } = useKpi();
  const [userModal, setUserModal] = useState(false);

  const [limit, setLimit] = useState<number | "">("");
  const [threshold, setThreshold] = useState<number | "">("");

  if (isLoading) return <Loader label="Загрузка настроек…" />;

  const saveSettings = () => {
    updateSettings.mutate(
      {
        expense_limit: limit === "" ? settings?.expense_limit : Number(limit),
        large_threshold: threshold === "" ? settings?.large_threshold : Number(threshold),
      },
      {
        onSuccess: () => toast.success("Настройки сохранены"),
        onError: (e) => toast.error(apiError(e)),
      }
    );
  };

  return (
    <>
      <PageHeader title="Настройки" subtitle="Лимиты, пользователи, взаиморасчёты, KPI" />

      <Tabs
        active={tab}
        onChange={(k) => setTab(k as Tab)}
        items={[
          { key: "settings", label: "Лимиты" },
          { key: "users", label: "Пользователи" },
          { key: "debts", label: "Взаиморасчёты" },
          { key: "kpi", label: "KPI" },
        ]}
      />

      <div style={{ marginTop: 16 }}>
        {tab === "settings" && (
          <Panel title="Лимиты расходов" subtitle="ХОЛ-20…21 · порог «крупно/мелко» (заглушка согласований)">
            <div className="form-grid" style={{ maxWidth: 560 }}>
              <Field label="Лимит расходов бизнеса" hint="в пределах — без владельцев">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  defaultValue={settings?.expense_limit ?? 0}
                  onChange={(e) => setLimit(e.target.value === "" ? "" : Number(e.target.value))}
                  suffix="сом."
                />
              </Field>
              <Field label="Порог крупной закупки" hint="выше — требует согласования (заглушка)">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  defaultValue={settings?.large_threshold ?? 0}
                  onChange={(e) => setThreshold(e.target.value === "" ? "" : Number(e.target.value))}
                  suffix="сом."
                />
              </Field>
            </div>
            <div style={{ marginTop: 16 }}>
              <Button icon={<Save size={16} />} onClick={saveSettings} loading={updateSettings.isPending}>
                Сохранить
              </Button>
            </div>
          </Panel>
        )}

        {tab === "users" && (
          <Panel
            title="Пользователи и роли"
            subtitle="ХОЛ-11 · доступ по ролям"
            actions={
              <Button size="sm" icon={<Plus size={15} />} onClick={() => setUserModal(true)}>
                Пользователь
              </Button>
            }
            bodyPad={false}
          >
            <div className="scroll-x">
              <table className="ark-table">
                <thead>
                  <tr>
                    <th>ФИО</th>
                    <th>Логин</th>
                    <th>Роль</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="strong">{u.full_name}</td>
                      <td className="muted">{u.username}</td>
                      <td style={{ width: 220 }}>
                        <Select
                          value={u.role}
                          onChange={(e) =>
                            updateUser.mutate({ id: u.id, input: { role: e.target.value as Role } })
                          }
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td>
                        <button
                          onClick={() => updateUser.mutate({ id: u.id, input: { is_active: !u.is_active } })}
                        >
                          <Badge tone={u.is_active ? "success" : "neutral"} dot>
                            {u.is_active ? "Активен" : "Отключён"}
                          </Badge>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {tab === "debts" && (
          <Panel
            title="Взаиморасчёты между бизнесами"
            subtitle="ХОЛ-30…32 · долги при внутреннем бартере"
            bodyPad={false}
          >
            {debts.length === 0 ? (
              <div className="panel-body">
                <EmptyState title="Долгов нет" hint="Появятся при бартере со своими заводами" />
              </div>
            ) : (
              <div className="scroll-x">
                <table className="ark-table">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>От кого</th>
                      <th>Кому</th>
                      <th className="num">Сумма</th>
                      <th>Статус</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {debts.map((d) => (
                      <tr key={d.id}>
                        <td className="nowrap muted">{fmtDate(d.created_at)}</td>
                        <td className="strong">{d.from_business}</td>
                        <td>{d.to_business}</td>
                        <td className="num">
                          <Money value={d.amount} kind="expense" />
                        </td>
                        <td>
                          <Badge tone={d.status === "open" ? "warning" : "success"} dot>
                            {d.status === "open" ? "Открыт" : "Закрыт"}
                          </Badge>
                        </td>
                        <td>
                          {d.status === "open" && (
                            <Button size="sm" variant="secondary" onClick={() => settle.mutate(d.id)}>
                              Закрыть
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}

        {tab === "kpi" && (
          <Panel title="KPI по ролям" subtitle="ХОЛ-40 · место под метрики (уточняются на опыте)">
            <div className="soft" style={{ marginBottom: 16 }}>
              {kpi?.note ?? "Место под KPI. Метрики уточняются на опыте эксплуатации."}
            </div>
            <div className="grid-kpi">
              {(kpi?.roles ?? []).map((r) => (
                <div key={r.role} className="stat">
                  <div className="stat__top">
                    <span className="stat__label">{r.label}</span>
                    <span className="stat__icon stat__icon--brand">
                      <Gauge size={18} />
                    </span>
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    Метрики появятся по мере готовности
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>

      {userModal && <UserModal open={userModal} onClose={() => setUserModal(false)} />}
    </>
  );
}
