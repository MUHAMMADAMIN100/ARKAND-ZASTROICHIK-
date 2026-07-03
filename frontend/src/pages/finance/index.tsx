import { useMemo, useState } from "react";
import { Plus, Wallet, TrendingUp, TrendingDown, PiggyBank, Trash2, Check, X } from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  Loader,
  Money,
  PageHeader,
  Panel,
  Progress,
  Segmented,
  Select,
  Stat,
  Tabs,
  useToast,
} from "@/shared/ui";
import { apiError } from "@/shared/api/client";
import { fmtDate, fmtMoney } from "@/shared/lib/format";
import {
  APPROVAL_LABELS,
  APPROVAL_TONE,
  PAYMENT_LABELS,
  TXN_CATEGORY_LABELS,
} from "@/shared/config/labels";
import {
  useTransactions,
  useCashRegisters,
  useDeleteTransaction,
  useApproveTransaction,
  type Transaction,
} from "@/entities/finance";
import { useObjects } from "@/entities/object";
import { isOwnerOrAdmin, useSession } from "@/entities/session";
import { TxnCreateModal, CashCreateModal } from "@/features/finance-form/FinanceModals";

type Tab = "txns" | "cash" | "approvals";

export function FinancePage() {
  const { data: txns = [], isLoading } = useTransactions();
  const { data: cashes = [] } = useCashRegisters();
  const { data: objects = [] } = useObjects();
  const user = useSession((s) => s.user);
  const toast = useToast();
  const del = useDeleteTransaction();
  const approve = useApproveTransaction();

  const [tab, setTab] = useState<Tab>("txns");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [objectFilter, setObjectFilter] = useState<string>("all");
  const [txnModal, setTxnModal] = useState(false);
  const [cashModal, setCashModal] = useState(false);

  const totals = useMemo(() => {
    let income = 0,
      expense = 0,
      admin = 0;
    txns.forEach((t) => {
      if (t.type === "income") income += t.amount;
      else {
        expense += t.amount;
        if (t.is_admin) admin += t.amount;
      }
    });
    return { income, expense, admin, profit: income - expense };
  }, [txns]);

  const filtered = useMemo(
    () =>
      txns.filter((t) => {
        if (typeFilter !== "all" && t.type !== typeFilter) return false;
        if (objectFilter !== "all" && String(t.object_id ?? "") !== objectFilter) return false;
        return true;
      }),
    [txns, typeFilter, objectFilter]
  );

  const pending = txns.filter((t) => t.approval_status === "pending");
  const canApprove = isOwnerOrAdmin(user?.role);

  if (isLoading) return <Loader label="Загрузка финансов…" />;

  return (
    <>
      <PageHeader
        title="Финансы и касса"
        subtitle="ЗАС-40…42 · доходы/расходы по объекту, прибыль"
        actions={
          <>
            {tab === "cash" ? (
              <Button icon={<Plus size={18} />} onClick={() => setCashModal(true)}>
                Касса
              </Button>
            ) : (
              <Button icon={<Plus size={18} />} onClick={() => setTxnModal(true)}>
                Операция
              </Button>
            )}
          </>
        }
      />

      <div className="grid-kpi" style={{ marginBottom: 20 }}>
        <Stat label="Доход" value={<Money value={totals.income} kind="income" currency />} icon={<TrendingUp size={18} />} iconTone="success" wide />
        <Stat label="Расход" value={<Money value={totals.expense} kind="expense" currency />} icon={<TrendingDown size={18} />} iconTone="warning" wide />
        <Stat label="Прибыль" value={<Money value={totals.profit} kind="balance" currency />} icon={<PiggyBank size={18} />} iconTone="brand" wide />
        <Stat label="Админ. расходы" value={<Money value={totals.admin} kind="expense" currency />} sub="отдельно от объектов" icon={<Wallet size={18} />} iconTone="info" wide />
      </div>

      <Tabs
        active={tab}
        onChange={(k) => setTab(k as Tab)}
        items={[
          { key: "txns", label: "Операции" },
          { key: "cash", label: "Кассы" },
          { key: "approvals", label: `Согласования${pending.length ? ` (${pending.length})` : ""}` },
        ]}
      />

      <div style={{ marginTop: 16 }}>
        {tab === "txns" && (
          <>
            <div className="toolbar">
              <Segmented
                value={typeFilter}
                onChange={setTypeFilter}
                items={[
                  { value: "all", label: "Все" },
                  { value: "income", label: "Доходы" },
                  { value: "expense", label: "Расходы" },
                ]}
              />
              <Select value={objectFilter} onChange={(e) => setObjectFilter(e.target.value)} style={{ maxWidth: 240 }}>
                <option value="all">Все объекты</option>
                {objects.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </div>

            <Panel bodyPad={false}>
              {filtered.length === 0 ? (
                <div className="panel-body">
                  <EmptyState title="Операций нет" hint="Добавьте доход или расход" />
                </div>
              ) : (
                <div className="scroll-x">
                  <table className="ark-table">
                    <thead>
                      <tr>
                        <th>Дата</th>
                        <th>Объект</th>
                        <th>Категория</th>
                        <th>Оплата</th>
                        <th className="num">Сумма</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((t) => (
                        <tr key={t.id}>
                          <td className="nowrap muted">{fmtDate(t.op_date)}</td>
                          <td>{t.object_name ?? <span className="muted">общий</span>}</td>
                          <td>
                            {TXN_CATEGORY_LABELS[t.category]}
                            {t.is_admin && <span className="chip" style={{ marginLeft: 6 }}>админ</span>}
                          </td>
                          <td className="muted">{PAYMENT_LABELS[t.payment_method]}</td>
                          <td className="num">
                            <Money
                              value={t.type === "income" ? t.amount : -t.amount}
                              kind={t.type === "income" ? "income" : "expense"}
                              signed
                            />
                          </td>
                          <td>
                            <button
                              className="icon-btn icon-btn--danger"
                              onClick={() =>
                                del.mutate(t.id, {
                                  onSuccess: () => toast.success("Операция удалена"),
                                  onError: (e) => toast.error(apiError(e)),
                                })
                              }
                              title="Удалить"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </>
        )}

        {tab === "cash" && (
          <div className="grid-kpi cols-2">
            {cashes.length === 0 ? (
              <Panel bodyPad>
                <EmptyState title="Касс нет" hint="Создайте кассу объекта (КАС-01)" />
              </Panel>
            ) : (
              cashes.map((c) => {
                const limitPct = c.limit_amount ? Math.min(100, (c.turnover / c.limit_amount) * 100) : 0;
                return (
                  <Panel key={c.id} title={c.name} subtitle={c.object_name ?? "без объекта"}>
                    <dl className="kv" style={{ gridTemplateColumns: "120px 1fr" }}>
                      <dt>Баланс</dt>
                      <dd>
                        <Money value={c.balance} kind="balance" currency />
                      </dd>
                      <dt>Оборот</dt>
                      <dd className="tnum">{fmtMoney(c.turnover)} сом.</dd>
                      <dt>Лимит</dt>
                      <dd className="tnum">{c.limit_amount ? `${fmtMoney(c.limit_amount)} сом.` : "—"}</dd>
                    </dl>
                    {c.limit_amount > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <Progress value={limitPct} tone={c.over_limit ? "error" : limitPct >= 85 ? "warning" : "success"} />
                        {c.over_limit && (
                          <div style={{ marginTop: 8 }}>
                            <Badge tone="warning">Превышен лимит оборота</Badge>
                          </div>
                        )}
                      </div>
                    )}
                  </Panel>
                );
              })
            )}
          </div>
        )}

        {tab === "approvals" && (
          <Panel
            title="Согласование крупных расходов"
            subtitle="ХОЛ-22…23 · заглушка согласования владельцев"
            bodyPad={false}
          >
            {pending.length === 0 ? (
              <div className="panel-body">
                <EmptyState title="Нет расходов на согласовании" hint="Крупные расходы появятся здесь" />
              </div>
            ) : (
              <div className="scroll-x">
                <table className="ark-table">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Объект</th>
                      <th>Описание</th>
                      <th className="num">Сумма</th>
                      <th>Статус</th>
                      {canApprove && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((t: Transaction) => (
                      <tr key={t.id}>
                        <td className="nowrap muted">{fmtDate(t.op_date)}</td>
                        <td>{t.object_name ?? "—"}</td>
                        <td>{t.description || TXN_CATEGORY_LABELS[t.category]}</td>
                        <td className="num">
                          <Money value={t.amount} kind="expense" />
                        </td>
                        <td>
                          <Badge tone={APPROVAL_TONE[t.approval_status]} dot>
                            {APPROVAL_LABELS[t.approval_status]}
                          </Badge>
                        </td>
                        {canApprove && (
                          <td>
                            <div className="row" style={{ gap: 4 }}>
                              <Button
                                size="sm"
                                variant="success"
                                icon={<Check size={14} />}
                                onClick={() => approve.mutate({ id: t.id, approve: true })}
                              >
                                Да
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                icon={<X size={14} />}
                                onClick={() => approve.mutate({ id: t.id, approve: false })}
                              >
                                Нет
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}
      </div>

      {txnModal && <TxnCreateModal open={txnModal} onClose={() => setTxnModal(false)} />}
      {cashModal && <CashCreateModal open={cashModal} onClose={() => setCashModal(false)} />}
    </>
  );
}
