import { useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  Plus,
  MapPin,
  User as UserIcon,
  CalendarClock,
  Building2,
  ArrowLeft,
  Pencil,
  Trash2,
  Search,
} from "lucide-react";
import {
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Loader,
  Money,
  PageHeader,
  Panel,
  Progress,
  Segmented,
  Select,
} from "@/shared/ui";
import { apiError } from "@/shared/api/client";
import { fmtDate } from "@/shared/lib/format";
import {
  OBJECT_STATUS_LABELS,
  OBJECT_STATUS_TONE,
  STAGE_STATUS_LABELS,
} from "@/shared/config/labels";
import type { ObjectStatus, StageStatus } from "@/shared/config/enums";
import {
  useObjects,
  useObject,
  useDeleteObject,
  useAddStage,
  useUpdateStage,
  useDeleteStage,
  type ConstructionObject,
} from "@/entities/object";
import { useObjectExpenses } from "@/entities/report";
import { useToast } from "@/shared/ui";
import { ObjectFormModal } from "@/features/object-form/ObjectFormModal";
import "./objects.css";

function stagesProgress(o: ConstructionObject) {
  const total = o.stages.length;
  const done = o.stages.filter((s) => s.status === "done").length;
  return { total, done, pct: total ? (done / total) * 100 : 0 };
}

function ObjectCard({ o }: { o: ConstructionObject }) {
  const navigate = useNavigate();
  const pr = stagesProgress(o);
  return (
    <div className="obj-card" onClick={() => navigate(`/objects/${o.id}`)}>
      <div className="obj-card__top">
        <div className="obj-card__name">{o.name}</div>
        <Badge tone={OBJECT_STATUS_TONE[o.status]} dot>
          {OBJECT_STATUS_LABELS[o.status]}
        </Badge>
      </div>
      <div className="obj-card__meta">
        <div className="obj-meta-row">
          <MapPin size={15} />
          {o.city_name ? `${o.city_name}, ` : ""}
          {o.address || "адрес не указан"}
        </div>
        <div className="obj-meta-row">
          <UserIcon size={15} />
          {o.responsible_name ?? "ответственный не назначен"}
        </div>
        <div className="obj-meta-row">
          <CalendarClock size={15} />
          Сдача: {fmtDate(o.deadline)}
        </div>
      </div>
      <div className="obj-card__foot">
        <div className="obj-progress">
          <div className="obj-progress__label">
            <span>Этапы</span>
            <span>
              {pr.done}/{pr.total}
            </span>
          </div>
          <Progress value={pr.pct} tone={pr.pct === 100 ? "success" : undefined} />
        </div>
      </div>
    </div>
  );
}

export function ObjectsPage() {
  const { data: objects = [], isLoading } = useObjects();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ObjectStatus | "all">("all");
  const [modal, setModal] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return objects.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (q && !`${o.name} ${o.address} ${o.city_name ?? ""}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [objects, search, status]);

  if (isLoading) return <Loader label="Загрузка объектов…" />;

  return (
    <>
      <PageHeader
        title="Объекты"
        subtitle="Строительство многоэтажных домов · разрез объекта и города"
        actions={
          <Button icon={<Plus size={18} />} onClick={() => setModal(true)}>
            Новый объект
          </Button>
        }
      />

      <div className="toolbar">
        <div className="toolbar__search">
          <Search size={17} />
          <Input
            className="input"
            placeholder="Поиск по названию, адресу, городу"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Segmented<ObjectStatus | "all">
          value={status}
          onChange={setStatus}
          items={[
            { value: "all", label: "Все" },
            { value: "in_progress", label: "В работе" },
            { value: "planning", label: "План" },
            { value: "done", label: "Завершены" },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <Panel bodyPad>
          <EmptyState
            icon={<Building2 size={40} strokeWidth={1.5} />}
            title="Объектов пока нет"
            hint="Создайте первый объект застройки"
            action={
              <Button icon={<Plus size={18} />} onClick={() => setModal(true)}>
                Новый объект
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="obj-grid">
          {filtered.map((o) => (
            <ObjectCard key={o.id} o={o} />
          ))}
        </div>
      )}

      {modal && <ObjectFormModal open={modal} onClose={() => setModal(false)} />}
    </>
  );
}

// ─────────────────────────── Детальная ─────────────────────────────
const STAGE_STATUSES: StageStatus[] = ["pending", "in_progress", "done"];

export function ObjectDetailPage() {
  const { id } = useParams();
  const objectId = Number(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { data: object, isLoading } = useObject(objectId);
  const { data: expenses = [] } = useObjectExpenses();
  const deleteObject = useDeleteObject();
  const addStage = useAddStage();
  const updateStage = useUpdateStage();
  const deleteStage = useDeleteStage();

  const [edit, setEdit] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [stageName, setStageName] = useState("");

  const fin = expenses.find((e) => e.object_id === objectId);

  if (isLoading || !object) return <Loader label="Загрузка объекта…" />;

  const addStageSubmit = () => {
    if (!stageName.trim()) return;
    addStage.mutate(
      { objectId, input: { name: stageName.trim() } },
      {
        onSuccess: () => {
          setStageName("");
          toast.success("Этап добавлен");
        },
        onError: (e) => toast.error(apiError(e)),
      }
    );
  };

  return (
    <>
      <Link to="/objects" className="detail-back">
        <ArrowLeft size={16} /> К объектам
      </Link>

      <PageHeader
        title={object.name}
        subtitle={`${object.city_name ? object.city_name + ", " : ""}${object.address || "—"}`}
        actions={
          <>
            <Button variant="secondary" icon={<Pencil size={16} />} onClick={() => setEdit(true)}>
              Изменить
            </Button>
            <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setConfirmDel(true)}>
              Удалить
            </Button>
          </>
        }
      />

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <Panel title="Карточка объекта" subtitle="ЗАС-01">
          <dl className="kv">
            <dt>Статус</dt>
            <dd>
              <Badge tone={OBJECT_STATUS_TONE[object.status]} dot>
                {OBJECT_STATUS_LABELS[object.status]}
              </Badge>
            </dd>
            <dt>Город</dt>
            <dd>{object.city_name ?? "—"}</dd>
            <dt>Адрес</dt>
            <dd>{object.address || "—"}</dd>
            <dt>Ответственный</dt>
            <dd>{object.responsible_name ?? "—"}</dd>
            <dt>Начало</dt>
            <dd>{fmtDate(object.start_date)}</dd>
            <dt>Срок сдачи</dt>
            <dd>{fmtDate(object.deadline)}</dd>
            {object.description && (
              <>
                <dt>Описание</dt>
                <dd style={{ fontWeight: 400 }}>{object.description}</dd>
              </>
            )}
          </dl>
        </Panel>

        <Panel title="Финансы объекта" subtitle="ЗАС-42 · прибыль = доход − прямые расходы">
          <dl className="kv">
            <dt>Доход</dt>
            <dd>
              <Money value={fin?.income ?? 0} kind="income" currency />
            </dd>
            <dt>Материалы</dt>
            <dd>
              <Money value={fin?.materials ?? 0} kind="expense" currency />
            </dd>
            <dt>Работы</dt>
            <dd>
              <Money value={fin?.work ?? 0} kind="expense" currency />
            </dd>
            <dt>Техника</dt>
            <dd>
              <Money value={fin?.tech ?? 0} kind="expense" currency />
            </dd>
            <dt>Прочее</dt>
            <dd>
              <Money value={fin?.other ?? 0} kind="expense" currency />
            </dd>
            <dt>Прибыль</dt>
            <dd>
              <Money value={fin?.profit ?? 0} kind="balance" currency />
            </dd>
          </dl>
        </Panel>
      </div>

      <Panel title="Этапы / договоры" subtitle="сроки по каждому этапу">
        <div className="row" style={{ marginBottom: 16, gap: 8 }}>
          <Input
            placeholder="Название этапа (напр. Каркас)"
            value={stageName}
            onChange={(e) => setStageName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addStageSubmit()}
          />
          <Button icon={<Plus size={16} />} onClick={addStageSubmit} loading={addStage.isPending}>
            Добавить
          </Button>
        </div>

        {object.stages.length === 0 ? (
          <EmptyState title="Этапов нет" hint="Добавьте этапы строительства" />
        ) : (
          <div className="list">
            {object.stages.map((s) => (
              <div key={s.id} className="list-row">
                <div className="list-row__main">
                  <div className="list-row__title">{s.name}</div>
                  <div className="list-row__sub">
                    {fmtDate(s.planned_start)} — {fmtDate(s.planned_end)}
                  </div>
                </div>
                <Select
                  value={s.status}
                  onChange={(e) =>
                    updateStage.mutate({
                      stageId: s.id,
                      input: { name: s.name, status: e.target.value as StageStatus },
                    })
                  }
                  style={{ width: 150 }}
                >
                  {STAGE_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {STAGE_STATUS_LABELS[st]}
                    </option>
                  ))}
                </Select>
                <button
                  className="icon-btn icon-btn--danger"
                  onClick={() => deleteStage.mutate(s.id)}
                  title="Удалить этап"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {edit && <ObjectFormModal open={edit} onClose={() => setEdit(false)} edit={object} />}
      <ConfirmDialog
        open={confirmDel}
        title="Удалить объект?"
        message={`Объект «${object.name}» и его этапы будут удалены. Действие необратимо.`}
        confirmText="Удалить"
        danger
        loading={deleteObject.isPending}
        onClose={() => setConfirmDel(false)}
        onConfirm={() =>
          deleteObject.mutate(objectId, {
            onSuccess: () => {
              toast.success("Объект удалён");
              navigate("/objects");
            },
            onError: (e) => toast.error(apiError(e)),
          })
        }
      />
    </>
  );
}
