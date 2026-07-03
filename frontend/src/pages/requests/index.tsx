import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Warehouse, ShoppingCart, X, Trash2, FileOutput } from "lucide-react";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Modal,
  PageHeader,
  Panel,
  Segmented,
  Input,
  Loader,
  useToast,
} from "@/shared/ui";
import { apiError } from "@/shared/api/client";
import { fmtDate, fmtDateTime, fmtQtyUnit } from "@/shared/lib/format";
import {
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_TONE,
  FULFILLMENT_LABELS,
} from "@/shared/config/labels";
import type { RequestStatus } from "@/shared/config/enums";
import {
  useRequests,
  useConfirmRequest,
  useRejectRequest,
  useDeleteRequest,
  type MaterialRequest,
} from "@/entities/request";
import { useCreateInvoiceFromRequest } from "@/entities/invoice";
import { RequestCreateModal } from "@/features/request-form/RequestCreateModal";

function RequestDetail({ req, onClose }: { req: MaterialRequest; onClose: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const confirm = useConfirmRequest();
  const reject = useRejectRequest();
  const del = useDeleteRequest();
  const genInvoice = useCreateInvoiceFromRequest();
  const [confirmDel, setConfirmDel] = useState(false);

  const doConfirm = (type: "from_stock" | "purchase") =>
    confirm.mutate(
      { id: req.id, fulfillment_type: type },
      {
        onSuccess: () => toast.success("Заявка подтверждена снабжением"),
        onError: (e) => toast.error(apiError(e)),
      }
    );

  const doGenerate = () =>
    genInvoice.mutate(req.id, {
      onSuccess: (inv) => {
        toast.success(`Накладная ${inv.number} сформирована`);
        onClose();
        navigate("/invoices");
      },
      onError: (e) => toast.error(apiError(e)),
    });

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={
        <span className="row" style={{ gap: 10 }}>
          {req.number}
          <Badge tone={REQUEST_STATUS_TONE[req.status]} dot>
            {REQUEST_STATUS_LABELS[req.status]}
          </Badge>
        </span>
      }
    >
      <div className="stack">
        <dl className="kv">
          <dt>Объект</dt>
          <dd>{req.object_name}</dd>
          <dt>Создал</dt>
          <dd>{req.created_by_name ?? "—"}</dd>
          <dt>Нужно к</dt>
          <dd>{fmtDate(req.needed_date)}</dd>
          {req.fulfillment_type && (
            <>
              <dt>Обеспечение</dt>
              <dd>{FULFILLMENT_LABELS[req.fulfillment_type]}</dd>
            </>
          )}
          {req.confirmed_at && (
            <>
              <dt>Подтверждена</dt>
              <dd>{fmtDateTime(req.confirmed_at)}</dd>
            </>
          )}
          {req.note && (
            <>
              <dt>Примечание</dt>
              <dd style={{ fontWeight: 400 }}>{req.note}</dd>
            </>
          )}
        </dl>

        <div className="scroll-x">
          <table className="ark-table">
            <thead>
              <tr>
                <th>Материал</th>
                <th className="num">Заявлено</th>
                <th className="num">На складе</th>
              </tr>
            </thead>
            <tbody>
              {req.items.map((it) => (
                <tr key={it.id}>
                  <td>{it.material_name}</td>
                  <td className="num">{fmtQtyUnit(it.quantity, it.unit)}</td>
                  <td className="num">
                    <span className={it.warehouse_qty < it.quantity ? "money--expense" : ""}>
                      {fmtQtyUnit(it.warehouse_qty, it.unit)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Действия по статусу */}
        {req.status === "submitted" && (
          <div className="stack" style={{ gap: 10 }}>
            <div className="soft">Подтвердите заявку снабжением и выберите способ обеспечения (ЗАС-12):</div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <Button
                icon={<Warehouse size={16} />}
                onClick={() => doConfirm("from_stock")}
                loading={confirm.isPending}
              >
                Выдать со склада
              </Button>
              <Button
                variant="secondary"
                icon={<ShoppingCart size={16} />}
                onClick={() => doConfirm("purchase")}
                loading={confirm.isPending}
              >
                Закупить
              </Button>
              <Button
                variant="danger"
                icon={<X size={16} />}
                onClick={() => reject.mutate(req.id)}
              >
                Отклонить
              </Button>
            </div>
          </div>
        )}

        {req.status === "confirmed" && (
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <Button icon={<FileOutput size={16} />} onClick={doGenerate} loading={genInvoice.isPending}>
              Сформировать накладную
            </Button>
            <span className="soft">
              Способ: <b>{FULFILLMENT_LABELS[req.fulfillment_type ?? "from_stock"]}</b>
            </span>
          </div>
        )}

        {req.status !== "fulfilled" && (
          <div>
            <Button variant="danger" size="sm" icon={<Trash2 size={15} />} onClick={() => setConfirmDel(true)}>
              Удалить заявку
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDel}
        title="Удалить заявку?"
        message={`Заявка ${req.number} будет удалена.`}
        danger
        confirmText="Удалить"
        loading={del.isPending}
        onClose={() => setConfirmDel(false)}
        onConfirm={() =>
          del.mutate(req.id, {
            onSuccess: () => {
              toast.success("Заявка удалена");
              onClose();
            },
            onError: (e) => toast.error(apiError(e)),
          })
        }
      />
    </Modal>
  );
}

export function RequestsPage() {
  const { data: requests = [], isLoading } = useRequests();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<RequestStatus | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (q && !`${r.number} ${r.object_name ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [requests, search, status]);

  const selected = requests.find((r) => r.id === selectedId) ?? null;

  if (isLoading) return <Loader label="Загрузка заявок…" />;

  return (
    <>
      <PageHeader
        title="Заявки на материалы"
        subtitle="ЗАС-10…14 · инициатор — объект, подтверждает снабжение"
        actions={
          <Button icon={<Plus size={18} />} onClick={() => setCreateOpen(true)}>
            Новая заявка
          </Button>
        }
      />

      <div className="toolbar">
        <div className="toolbar__search">
          <Search size={17} />
          <Input placeholder="Поиск по номеру, объекту" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Segmented<RequestStatus | "all">
          value={status}
          onChange={setStatus}
          items={[
            { value: "all", label: "Все" },
            { value: "submitted", label: "На подтв." },
            { value: "confirmed", label: "Подтв." },
            { value: "fulfilled", label: "Обеспечены" },
          ]}
        />
      </div>

      <Panel bodyPad={false}>
        {filtered.length === 0 ? (
          <div className="panel-body">
            <EmptyState title="Заявок нет" hint="Создайте заявку на материалы" />
          </div>
        ) : (
          <div className="scroll-x">
            <table className="ark-table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Объект</th>
                  <th className="num">Позиций</th>
                  <th>Нужно к</th>
                  <th>Обеспечение</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="is-clickable" onClick={() => setSelectedId(r.id)}>
                    <td className="strong nowrap">{r.number}</td>
                    <td>{r.object_name}</td>
                    <td className="num">{r.items.length}</td>
                    <td className="nowrap">{fmtDate(r.needed_date)}</td>
                    <td>{r.fulfillment_type ? FULFILLMENT_LABELS[r.fulfillment_type] : "—"}</td>
                    <td>
                      <Badge tone={REQUEST_STATUS_TONE[r.status]} dot>
                        {REQUEST_STATUS_LABELS[r.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {createOpen && <RequestCreateModal open={createOpen} onClose={() => setCreateOpen(false)} />}
      {selected && <RequestDetail req={selected} onClose={() => setSelectedId(null)} />}
    </>
  );
}
