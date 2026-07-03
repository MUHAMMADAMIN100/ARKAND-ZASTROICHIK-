import { useMemo, useState } from "react";
import { Plus, Search, Printer, PackageCheck, X, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Loader,
  Modal,
  Money,
  PageHeader,
  Panel,
  Segmented,
  useToast,
} from "@/shared/ui";
import { apiError } from "@/shared/api/client";
import { fmtDate, fmtDateTime, fmtMoney, fmtQty } from "@/shared/lib/format";
import { printInvoice } from "@/shared/lib/printInvoice";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_TONE, INVOICE_TYPE_LABELS } from "@/shared/config/labels";
import {
  useInvoices,
  useCancelInvoice,
  useDeleteInvoice,
  type Invoice,
} from "@/entities/invoice";
import { InvoiceCreateModal } from "@/features/invoice-form/InvoiceCreateModal";
import { InvoiceReceiveModal } from "@/features/invoice-form/InvoiceReceiveModal";

function InvoiceDetail({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const toast = useToast();
  const cancel = useCancelInvoice();
  const del = useDeleteInvoice();
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <>
      <Modal
        open
        onClose={onClose}
        size="lg"
        title={
          <span className="row" style={{ gap: 10 }}>
            {inv.number}
            <Badge tone={INVOICE_STATUS_TONE[inv.status]} dot>
              {INVOICE_STATUS_LABELS[inv.status]}
            </Badge>
          </span>
        }
      >
        <div className="stack">
          <dl className="kv">
            <dt>Тип</dt>
            <dd>{INVOICE_TYPE_LABELS[inv.type]}</dd>
            <dt>Откуда</dt>
            <dd>{inv.source_name ?? "внешний поставщик"}</dd>
            <dt>Куда</dt>
            <dd>{inv.dest_name}</dd>
            {inv.supplier_name && (
              <>
                <dt>Поставщик</dt>
                <dd>{inv.supplier_name}</dd>
              </>
            )}
            <dt>Создана</dt>
            <dd>{fmtDate(inv.created_at)}</dd>
            {inv.received_at && (
              <>
                <dt>Принята</dt>
                <dd>{fmtDateTime(inv.received_at)}</dd>
              </>
            )}
          </dl>

          <div className="scroll-x">
            <table className="ark-table">
              <thead>
                <tr>
                  <th>Материал</th>
                  <th className="num">План</th>
                  <th className="num">Факт</th>
                  <th className="num">Цена</th>
                  <th className="num">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {inv.items.map((it) => (
                  <tr key={it.id}>
                    <td className="strong">{it.material_name}</td>
                    <td className="num">
                      {fmtQty(it.qty_planned)} {it.unit}
                    </td>
                    <td className="num">{it.qty_fact != null ? `${fmtQty(it.qty_fact)} ${it.unit}` : "—"}</td>
                    <td className="num">{fmtMoney(it.unit_price)}</td>
                    <td className="num">{fmtMoney(it.line_total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="num strong">
                    Итого:
                  </td>
                  <td className="num strong">
                    <Money value={inv.total_amount} currency />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {inv.status === "shipped" && (
              <Button icon={<PackageCheck size={16} />} onClick={() => setReceiveOpen(true)}>
                Принять
              </Button>
            )}
            <Button variant="secondary" icon={<Printer size={16} />} onClick={() => printInvoice(inv)}>
              Печать
            </Button>
            {inv.status === "shipped" && (
              <Button variant="danger" icon={<X size={16} />} onClick={() => cancel.mutate(inv.id)}>
                Отменить
              </Button>
            )}
            {inv.status !== "received" && (
              <Button variant="ghost" icon={<Trash2 size={16} />} onClick={() => setConfirmDel(true)}>
                Удалить
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {receiveOpen && (
        <InvoiceReceiveModal
          invoice={inv}
          onClose={() => {
            setReceiveOpen(false);
            onClose();
          }}
        />
      )}
      <ConfirmDialog
        open={confirmDel}
        title="Удалить накладную?"
        message={`Накладная ${inv.number} будет удалена.`}
        danger
        confirmText="Удалить"
        loading={del.isPending}
        onClose={() => setConfirmDel(false)}
        onConfirm={() =>
          del.mutate(inv.id, {
            onSuccess: () => {
              toast.success("Накладная удалена");
              onClose();
            },
            onError: (e) => toast.error(apiError(e)),
          })
        }
      />
    </>
  );
}

export function InvoicesPage() {
  const { data: invoices = [], isLoading } = useInvoices();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((i) => {
      if (status !== "all" && i.status !== status) return false;
      if (q && !`${i.number} ${i.dest_name ?? ""} ${i.source_name ?? ""}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [invoices, search, status]);

  const selected = invoices.find((i) => i.id === selectedId) ?? null;

  if (isLoading) return <Loader label="Загрузка накладных…" />;

  return (
    <>
      <PageHeader
        title="Накладные"
        subtitle="ЗАС-20…24 · движение материалов, приёмка со сверкой"
        actions={
          <Button icon={<Plus size={18} />} onClick={() => setCreateOpen(true)}>
            Новая накладная
          </Button>
        }
      />

      <div className="toolbar">
        <div className="toolbar__search">
          <Search size={17} />
          <Input placeholder="Поиск по номеру, направлению" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Segmented
          value={status}
          onChange={setStatus}
          items={[
            { value: "all", label: "Все" },
            { value: "shipped", label: "К приёмке" },
            { value: "received", label: "Принятые" },
          ]}
        />
      </div>

      <Panel bodyPad={false}>
        {filtered.length === 0 ? (
          <div className="panel-body">
            <EmptyState title="Накладных нет" hint="Оформите накладную на выдачу или приход" />
          </div>
        ) : (
          <div className="scroll-x">
            <table className="ark-table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Тип</th>
                  <th>Направление</th>
                  <th className="num">Позиций</th>
                  <th className="num">Сумма</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr key={i.id} className="is-clickable" onClick={() => setSelectedId(i.id)}>
                    <td className="strong nowrap">{i.number}</td>
                    <td>
                      <Badge tone={i.type === "issue" ? "info" : "brand"}>{INVOICE_TYPE_LABELS[i.type]}</Badge>
                    </td>
                    <td className="muted">
                      {(i.source_name ?? "поставщик") + " → " + (i.dest_name ?? "")}
                    </td>
                    <td className="num">{i.items.length}</td>
                    <td className="num">{fmtMoney(i.total_amount)}</td>
                    <td>
                      <Badge tone={INVOICE_STATUS_TONE[i.status]} dot>
                        {INVOICE_STATUS_LABELS[i.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {createOpen && <InvoiceCreateModal open={createOpen} onClose={() => setCreateOpen(false)} />}
      {selected && <InvoiceDetail inv={selected} onClose={() => setSelectedId(null)} />}
    </>
  );
}
