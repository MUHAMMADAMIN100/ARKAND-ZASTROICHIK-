import { useNavigate } from "react-router-dom";
import {
  Building2,
  ClipboardList,
  ScrollText,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  ArrowRight,
  PackageMinus,
} from "lucide-react";
import { Badge, EmptyState, Money, PageHeader, Panel, Stat, Loader } from "@/shared/ui";
import { fmtDate, fmtDateTime, fmtQtyUnit } from "@/shared/lib/format";
import {
  INVOICE_TYPE_LABELS,
  MOVEMENT_REASON_LABELS,
  REQUEST_STATUS_LABELS,
} from "@/shared/config/labels";
import { useDashboard } from "@/entities/report";
import { useRequests } from "@/entities/request";
import { useInvoices } from "@/entities/invoice";
import { useStock } from "@/entities/stock";
import { useMovements } from "@/entities/stock";

export function DashboardPage() {
  const navigate = useNavigate();
  const { data: dash, isLoading } = useDashboard();
  const { data: requests = [] } = useRequests();
  const { data: invoices = [] } = useInvoices();
  const { data: stock = [] } = useStock();
  const { data: movements = [] } = useMovements(8);

  if (isLoading || !dash) return <Loader label="Загрузка обзора…" />;

  const submitted = requests.filter((r) => r.status === "submitted").slice(0, 5);
  const toReceive = invoices.filter((i) => i.status === "shipped").slice(0, 5);
  const lowStock = stock.filter((s) => s.is_low).slice(0, 6);

  return (
    <>
      <PageHeader
        title="Обзор"
        subtitle={`Сводка по застройщику · ${fmtDate(new Date().toISOString())}`}
      />

      <div className="grid-kpi" style={{ marginBottom: 24 }}>
        <Stat
          label="Объекты в работе"
          value={dash.objects_active}
          sub={`из ${dash.objects_total} всего`}
          icon={<Building2 size={18} />}
          iconTone="brand"
          onClick={() => navigate("/objects")}
        />
        <Stat
          label="Заявки открытые"
          value={dash.requests_open}
          sub="ожидают обработки"
          icon={<ClipboardList size={18} />}
          iconTone="info"
          onClick={() => navigate("/requests")}
        />
        <Stat
          label="Накладные к приёмке"
          value={dash.invoices_pending}
          sub="ожидают сверки"
          icon={<ScrollText size={18} />}
          iconTone="warning"
          onClick={() => navigate("/invoices")}
        />
        <Stat
          label="Дефицит склада"
          value={dash.low_stock_count}
          sub="ниже минимума"
          icon={<AlertTriangle size={18} />}
          iconTone="warning"
          onClick={() => navigate("/warehouse")}
        />
        <Stat
          label="Доход за месяц"
          value={<Money value={dash.income_month} kind="income" signed currency />}
          icon={<TrendingUp size={18} />}
          iconTone="success"
          wide
        />
        <Stat
          label="Расход за месяц"
          value={<Money value={-dash.expense_month} kind="expense" signed currency />}
          icon={<TrendingDown size={18} />}
          iconTone="warning"
          wide
        />
        <Stat
          label="Прибыль за месяц"
          value={<Money value={dash.profit_month} kind="balance" currency />}
          icon={<PiggyBank size={18} />}
          iconTone="brand"
          wide
        />
        <Stat
          label="Баланс кассы"
          value={<Money value={dash.cash_balance} kind="balance" currency />}
          icon={<Wallet size={18} />}
          iconTone="info"
          wide
          onClick={() => navigate("/finance")}
        />
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <Panel
          title="Заявки на подтверждении"
          subtitle="ЗАС-11 · подтверждает снабжение"
          bodyPad
        >
          {submitted.length === 0 ? (
            <EmptyState title="Нет новых заявок" hint="Все заявки обработаны" />
          ) : (
            <div className="list">
              {submitted.map((r) => (
                <div
                  key={r.id}
                  className="list-row is-clickable"
                  onClick={() => navigate("/requests")}
                  style={{ cursor: "pointer" }}
                >
                  <div className="list-row__main">
                    <div className="list-row__title">
                      {r.number} · {r.object_name}
                    </div>
                    <div className="list-row__sub">
                      {r.items.length} поз. · нужно к {fmtDate(r.needed_date)}
                    </div>
                  </div>
                  <Badge tone="warning" dot>
                    {REQUEST_STATUS_LABELS[r.status]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Накладные к приёмке" subtitle="ЗАС-21 · сверка факта" bodyPad>
          {toReceive.length === 0 ? (
            <EmptyState title="Нет накладных к приёмке" hint="Все накладные приняты" />
          ) : (
            <div className="list">
              {toReceive.map((inv) => (
                <div
                  key={inv.id}
                  className="list-row is-clickable"
                  onClick={() => navigate("/invoices")}
                  style={{ cursor: "pointer" }}
                >
                  <div className="list-row__main">
                    <div className="list-row__title">
                      {inv.number} · {inv.dest_name}
                    </div>
                    <div className="list-row__sub">
                      {INVOICE_TYPE_LABELS[inv.type]} · {inv.items.length} поз.
                    </div>
                  </div>
                  <ArrowRight size={16} className="muted" />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid-2">
        <Panel
          title="Дефицит на складе"
          subtitle="ниже минимального остатка"
          actions={<PackageMinus size={18} className="muted" />}
          bodyPad
        >
          {lowStock.length === 0 ? (
            <EmptyState title="Дефицита нет" hint="Все остатки выше минимума" />
          ) : (
            <div className="list">
              {lowStock.map((s) => (
                <div key={s.material_id} className="list-row">
                  <div className="list-row__main">
                    <div className="list-row__title">{s.material_name}</div>
                    <div className="list-row__sub">минимум {fmtQtyUnit(s.min_stock, s.unit)}</div>
                  </div>
                  <span className="qty-low">{fmtQtyUnit(s.quantity, s.unit)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Последние движения" subtitle="история материалов (ЗАС-23)" bodyPad>
          {movements.length === 0 ? (
            <EmptyState title="Движений нет" />
          ) : (
            <div className="list">
              {movements.map((m) => (
                <div key={m.id} className="list-row">
                  <div className="list-row__main">
                    <div className="list-row__title">{m.material_name}</div>
                    <div className="list-row__sub">
                      {m.from_name ? `${m.from_name} → ` : ""}
                      {m.to_name ?? "—"} · {fmtDateTime(m.created_at)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="strong tnum">{fmtQtyUnit(m.quantity, m.unit)}</div>
                    <div className="list-row__sub">{MOVEMENT_REASON_LABELS[m.reason]}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
