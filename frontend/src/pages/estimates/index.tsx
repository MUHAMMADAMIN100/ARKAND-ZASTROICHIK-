import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Calculator } from "lucide-react";
import {
  Button,
  EmptyState,
  Loader,
  Money,
  PageHeader,
  Panel,
  Progress,
  Select,
  Stat,
  useToast,
} from "@/shared/ui";
import { apiError } from "@/shared/api/client";
import { fmtMoney, fmtPercent, fmtQty } from "@/shared/lib/format";
import { ESTIMATE_CATEGORY_LABELS } from "@/shared/config/labels";
import {
  useEstimates,
  useEstimateCompare,
  useDeleteEstimateItem,
  type EstimateItem,
} from "@/entities/estimate";
import { EstimateCreateModal, EstimateItemModal } from "@/features/estimate-form/EstimateModals";

export function EstimatesPage() {
  const { data: estimates = [], isLoading } = useEstimates();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [itemModal, setItemModal] = useState<{ open: boolean; edit?: EstimateItem }>({ open: false });
  const delItem = useDeleteEstimateItem();

  useEffect(() => {
    if (selectedId == null && estimates.length) setSelectedId(estimates[0].id);
    if (selectedId != null && !estimates.some((e) => e.id === selectedId)) {
      setSelectedId(estimates[0]?.id ?? null);
    }
  }, [estimates, selectedId]);

  const estimate = estimates.find((e) => e.id === selectedId) ?? null;
  const { data: compare } = useEstimateCompare(estimate?.id);

  if (isLoading) return <Loader label="Загрузка сметы…" />;

  return (
    <>
      <PageHeader
        title="Смета по объектам"
        subtitle="ЗАС-30…32 · плановые расходы и сравнение план/факт"
        actions={
          <Button icon={<Plus size={18} />} onClick={() => setCreateOpen(true)}>
            Новая смета
          </Button>
        }
      />

      {estimates.length === 0 ? (
        <Panel bodyPad>
          <EmptyState
            icon={<Calculator size={40} strokeWidth={1.5} />}
            title="Смет пока нет"
            hint="Создайте смету по объекту и добавьте плановые позиции"
            action={
              <Button icon={<Plus size={18} />} onClick={() => setCreateOpen(true)}>
                Новая смета
              </Button>
            }
          />
        </Panel>
      ) : (
        <>
          <div className="toolbar">
            <Select
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(Number(e.target.value))}
              style={{ maxWidth: 420 }}
            >
              {estimates.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {e.object_name}
                </option>
              ))}
            </Select>
          </div>

          {estimate && (
            <>
              <div className="grid-kpi cols-3" style={{ marginBottom: 20 }}>
                <Stat label="План" value={<Money value={compare?.total_plan ?? estimate.total_plan} currency />} iconTone="info" wide />
                <Stat label="Факт" value={<Money value={compare?.total_fact ?? estimate.total_fact} currency />} iconTone="brand" wide />
                <Stat
                  label="Отклонение"
                  value={
                    <Money
                      value={(compare?.total_fact ?? 0) - (compare?.total_plan ?? 0)}
                      kind="auto"
                      signed
                      currency
                    />
                  }
                  sub={compare ? `освоено ${fmtPercent(compare.percent)}` : undefined}
                  iconTone="warning"
                  wide
                />
              </div>

              <div className="grid-2">
                <Panel title="План / факт по категориям" subtitle="ЗАС-31">
                  {compare && compare.by_category.length > 0 ? (
                    <div className="stack" style={{ gap: 16 }}>
                      {compare.by_category.map((row) => {
                        const pct = row.plan ? Math.min(100, (row.fact / row.plan) * 100) : row.fact > 0 ? 100 : 0;
                        const over = row.fact > row.plan;
                        return (
                          <div key={row.category}>
                            <div className="row row--between" style={{ marginBottom: 6 }}>
                              <span className="strong">{row.label}</span>
                              <span className="tnum soft">
                                {fmtMoney(row.fact)} / {fmtMoney(row.plan)}
                              </span>
                            </div>
                            <Progress value={pct} tone={over ? "error" : pct >= 90 ? "warning" : "success"} />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <EmptyState title="Нет данных" hint="Добавьте позиции и расходы" />
                  )}
                </Panel>

                <Panel
                  title="Позиции сметы"
                  actions={
                    <Button
                      size="sm"
                      icon={<Plus size={15} />}
                      onClick={() => setItemModal({ open: true })}
                    >
                      Позиция
                    </Button>
                  }
                  bodyPad={false}
                >
                  {estimate.items.length === 0 ? (
                    <div className="panel-body">
                      <EmptyState title="Позиций нет" hint="Добавьте плановые расходы" />
                    </div>
                  ) : (
                    <div className="scroll-x">
                      <table className="ark-table">
                        <thead>
                          <tr>
                            <th>Категория</th>
                            <th>Наименование</th>
                            <th className="num">Кол-во</th>
                            <th className="num">Цена</th>
                            <th className="num">Сумма</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {estimate.items.map((it) => (
                            <tr key={it.id}>
                              <td className="muted nowrap">{ESTIMATE_CATEGORY_LABELS[it.category]}</td>
                              <td className="strong">
                                {it.name}
                                {it.unit ? <span className="muted"> · {it.unit}</span> : null}
                              </td>
                              <td className="num">{fmtQty(it.qty_plan)}</td>
                              <td className="num">{fmtMoney(it.price_plan)}</td>
                              <td className="num strong">{fmtMoney(it.amount_plan)}</td>
                              <td>
                                <div className="row" style={{ gap: 2 }}>
                                  <button
                                    className="icon-btn"
                                    onClick={() => setItemModal({ open: true, edit: it })}
                                    title="Изменить"
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  <button
                                    className="icon-btn icon-btn--danger"
                                    onClick={() =>
                                      delItem.mutate(it.id, {
                                        onSuccess: () => toast.success("Позиция удалена"),
                                        onError: (e) => toast.error(apiError(e)),
                                      })
                                    }
                                    title="Удалить"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>
              </div>
            </>
          )}
        </>
      )}

      {createOpen && <EstimateCreateModal open={createOpen} onClose={() => setCreateOpen(false)} />}
      {itemModal.open && estimate && (
        <EstimateItemModal
          open={itemModal.open}
          estimateId={estimate.id}
          edit={itemModal.edit}
          onClose={() => setItemModal({ open: false })}
        />
      )}
    </>
  );
}
