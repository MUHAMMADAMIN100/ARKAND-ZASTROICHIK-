import { Loader, Money, PageHeader, Panel, EmptyState, Badge } from "@/shared/ui";
import { fmtMoney } from "@/shared/lib/format";
import { useObjectExpenses, useCityAnalytics } from "@/entities/report";

export function ReportsPage() {
  const { data: objects = [], isLoading } = useObjectExpenses();
  const { data: cities = [] } = useCityAnalytics();

  if (isLoading) return <Loader label="Загрузка отчётов…" />;

  return (
    <>
      <PageHeader
        title="Отчёты руководству"
        subtitle="ЗАС-60…62 · расходы, прибыль и аналитика по объекту и городу"
      />

      <Panel
        title="Расходы и прибыль по объектам"
        subtitle="ЗАС-62 · прямые расходы; административные учитываются отдельно"
        bodyPad={false}
        className="card"
      >
        {objects.length === 0 ? (
          <div className="panel-body">
            <EmptyState title="Нет данных" hint="Появятся после операций по объектам" />
          </div>
        ) : (
          <div className="scroll-x">
            <table className="ark-table">
              <thead>
                <tr>
                  <th>Объект</th>
                  <th>Город</th>
                  <th className="num">Материалы</th>
                  <th className="num">Работы</th>
                  <th className="num">Техника</th>
                  <th className="num">Прочее</th>
                  <th className="num">Расход</th>
                  <th className="num">Доход</th>
                  <th className="num">Прибыль</th>
                </tr>
              </thead>
              <tbody>
                {objects.map((o) => (
                  <tr key={o.object_id}>
                    <td className="strong">{o.object_name}</td>
                    <td className="muted">{o.city_name ?? "—"}</td>
                    <td className="num">{fmtMoney(o.materials)}</td>
                    <td className="num">{fmtMoney(o.work)}</td>
                    <td className="num">{fmtMoney(o.tech)}</td>
                    <td className="num">{fmtMoney(o.other)}</td>
                    <td className="num">
                      <Money value={o.total_expense} kind="expense" />
                    </td>
                    <td className="num">
                      <Money value={o.income} kind="income" />
                    </td>
                    <td className="num strong">
                      <Money value={o.profit} kind="balance" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div style={{ height: 20 }} />

      <Panel
        title="Аналитика по городам"
        subtitle="ЗАС-02, ЗАС-62 · сквозной разрез «город»"
        bodyPad={false}
        className="card"
      >
        {cities.length === 0 ? (
          <div className="panel-body">
            <EmptyState title="Нет данных" />
          </div>
        ) : (
          <div className="scroll-x">
            <table className="ark-table">
              <thead>
                <tr>
                  <th>Город</th>
                  <th className="num">Объектов</th>
                  <th className="num">Расход</th>
                  <th className="num">Доход</th>
                  <th className="num">Прибыль</th>
                  <th>Рентабельность</th>
                </tr>
              </thead>
              <tbody>
                {cities.map((c) => {
                  const margin = c.income > 0 ? (c.profit / c.income) * 100 : 0;
                  return (
                    <tr key={c.city_name}>
                      <td className="strong">{c.city_name}</td>
                      <td className="num">{c.objects_count}</td>
                      <td className="num">
                        <Money value={c.total_expense} kind="expense" />
                      </td>
                      <td className="num">
                        <Money value={c.income} kind="income" />
                      </td>
                      <td className="num strong">
                        <Money value={c.profit} kind="balance" />
                      </td>
                      <td>
                        <Badge tone={c.profit >= 0 ? "success" : "error"}>
                          {margin.toFixed(0)}%
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
