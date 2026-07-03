import { useMemo, useState } from "react";
import { Plus, Search, Pencil, AlertTriangle } from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Loader,
  PageHeader,
  Panel,
  Tabs,
} from "@/shared/ui";
import { fmtDateTime, fmtMoney, fmtQty, fmtQtyUnit } from "@/shared/lib/format";
import { MOVEMENT_REASON_LABELS } from "@/shared/config/labels";
import { useStock, useMovements } from "@/entities/stock";
import { useMaterials, type Material } from "@/entities/catalog";
import { MaterialFormModal } from "@/features/material-form/MaterialFormModal";

type Tab = "warehouse" | "objects" | "movements" | "catalog";

export function WarehousePage() {
  const { data: stock = [], isLoading } = useStock();
  const { data: movements = [] } = useMovements(200);
  const { data: materials = [] } = useMaterials();
  const [tab, setTab] = useState<Tab>("warehouse");
  const [search, setSearch] = useState("");
  const [matModal, setMatModal] = useState<{ open: boolean; edit?: Material }>({ open: false });

  const q = search.trim().toLowerCase();
  const warehouse = useMemo(
    () =>
      stock
        .filter((s) => s.location_type === "WAREHOUSE")
        .filter((s) => !q || s.material_name.toLowerCase().includes(q))
        .sort((a, b) => Number(b.is_low) - Number(a.is_low) || a.material_name.localeCompare(b.material_name)),
    [stock, q]
  );
  const whValue = warehouse.reduce((sum, s) => sum + s.quantity * s.avg_cost, 0);

  const byObject = useMemo(() => {
    const groups = new Map<string, typeof stock>();
    stock
      .filter((s) => s.location_type === "OBJECT" && s.quantity !== 0)
      .filter((s) => !q || s.material_name.toLowerCase().includes(q))
      .forEach((s) => {
        const key = s.location_name;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(s);
      });
    return [...groups.entries()];
  }, [stock, q]);

  if (isLoading) return <Loader label="Загрузка склада…" />;

  return (
    <>
      <PageHeader
        title="Склад материалов"
        subtitle="ЗАС-03, ЗАС-23 · общий склад, остатки = факт"
        actions={
          <Button icon={<Plus size={18} />} onClick={() => setMatModal({ open: true })}>
            Материал
          </Button>
        }
      />

      <Tabs
        active={tab}
        onChange={(k) => setTab(k as Tab)}
        items={[
          { key: "warehouse", label: "Центральный склад" },
          { key: "objects", label: "По объектам" },
          { key: "movements", label: "Движения" },
          { key: "catalog", label: "Каталог" },
        ]}
      />

      <div style={{ marginTop: 16 }}>
        {(tab === "warehouse" || tab === "objects") && (
          <div className="toolbar">
            <div className="toolbar__search">
              <Search size={17} />
              <Input placeholder="Поиск материала" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        )}

        {tab === "warehouse" && (
          <Panel
            title="Центральный склад"
            subtitle={`Итого по себестоимости: ${fmtMoney(whValue)} сом.`}
            bodyPad={false}
          >
            {warehouse.length === 0 ? (
              <div className="panel-body">
                <EmptyState title="Склад пуст" hint="Оприходуйте материалы через накладную-приход" />
              </div>
            ) : (
              <div className="scroll-x">
                <table className="ark-table">
                  <thead>
                    <tr>
                      <th>Материал</th>
                      <th>Категория</th>
                      <th className="num">Остаток</th>
                      <th className="num">Себест. ед.</th>
                      <th className="num">Сумма</th>
                      <th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warehouse.map((s) => (
                      <tr key={s.material_id}>
                        <td className="strong">{s.material_name}</td>
                        <td className="muted">{s.category}</td>
                        <td className="num">{fmtQtyUnit(s.quantity, s.unit)}</td>
                        <td className="num">{fmtMoney(s.avg_cost)}</td>
                        <td className="num">{fmtMoney(s.quantity * s.avg_cost)}</td>
                        <td>
                          {s.is_low ? (
                            <Badge tone="warning">
                              <AlertTriangle size={12} /> дефицит
                            </Badge>
                          ) : (
                            <Badge tone="success" dot>
                              в норме
                            </Badge>
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

        {tab === "objects" && (
          <div className="stack">
            {byObject.length === 0 ? (
              <Panel bodyPad>
                <EmptyState title="На объектах нет остатков" hint="Материалы появятся после выдачи на объект" />
              </Panel>
            ) : (
              byObject.map(([name, rows]) => (
                <Panel key={name} title={name} bodyPad={false}>
                  <div className="scroll-x">
                    <table className="ark-table">
                      <thead>
                        <tr>
                          <th>Материал</th>
                          <th className="num">Остаток</th>
                          <th className="num">Себест. ед.</th>
                          <th className="num">Сумма</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((s) => (
                          <tr key={s.material_id}>
                            <td className="strong">{s.material_name}</td>
                            <td className="num">{fmtQtyUnit(s.quantity, s.unit)}</td>
                            <td className="num">{fmtMoney(s.avg_cost)}</td>
                            <td className="num">{fmtMoney(s.quantity * s.avg_cost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              ))
            )}
          </div>
        )}

        {tab === "movements" && (
          <Panel title="История движений" subtitle="ЗАС-23 · остаток = факт" bodyPad={false}>
            {movements.length === 0 ? (
              <div className="panel-body">
                <EmptyState title="Движений нет" />
              </div>
            ) : (
              <div className="scroll-x">
                <table className="ark-table">
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Материал</th>
                      <th>Откуда</th>
                      <th>Куда</th>
                      <th className="num">Кол-во</th>
                      <th>Операция</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id}>
                        <td className="nowrap muted">{fmtDateTime(m.created_at)}</td>
                        <td className="strong">{m.material_name}</td>
                        <td className="muted">{m.from_name ?? "—"}</td>
                        <td className="muted">{m.to_name ?? "—"}</td>
                        <td className="num">{fmtQtyUnit(m.quantity, m.unit)}</td>
                        <td>
                          <Badge tone="neutral">{MOVEMENT_REASON_LABELS[m.reason]}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}

        {tab === "catalog" && (
          <Panel title="Каталог материалов" subtitle={`${materials.length} позиций`} bodyPad={false}>
            <div className="scroll-x">
              <table className="ark-table">
                <thead>
                  <tr>
                    <th>Материал</th>
                    <th>Ед.</th>
                    <th>Категория</th>
                    <th className="num">Мин. остаток</th>
                    <th className="num">Цена</th>
                    <th className="num">Всего</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => (
                    <tr key={m.id}>
                      <td className="strong">{m.name}</td>
                      <td className="muted">{m.unit}</td>
                      <td className="muted">{m.category}</td>
                      <td className="num">{fmtQty(m.min_stock)}</td>
                      <td className="num">{fmtMoney(m.default_price)}</td>
                      <td className="num">{fmtQtyUnit(m.total_qty, m.unit)}</td>
                      <td>
                        <button
                          className="icon-btn"
                          onClick={() => setMatModal({ open: true, edit: m })}
                          title="Изменить"
                        >
                          <Pencil size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>

      {matModal.open && (
        <MaterialFormModal
          open={matModal.open}
          edit={matModal.edit}
          onClose={() => setMatModal({ open: false })}
        />
      )}
    </>
  );
}
