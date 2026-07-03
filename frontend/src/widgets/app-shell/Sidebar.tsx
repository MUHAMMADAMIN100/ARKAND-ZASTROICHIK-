import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  ClipboardList,
  Package,
  ScrollText,
  Calculator,
  Wallet,
  ClipboardCheck,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";
import { cx } from "@/shared/lib/cx";
import { ROLE_LABELS } from "@/shared/config/labels";
import { Avatar } from "@/shared/ui";
import { logout, useSession, isOwnerOrAdmin } from "@/entities/session";
import { useDashboard } from "@/entities/report";
import logoUrl from "@/shared/assets/logo.png";

interface NavDef {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  end?: boolean;
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const user = useSession((s) => s.user);
  const { data: dash } = useDashboard();

  const main: NavDef[] = [
    { to: "/", label: "Обзор", icon: <LayoutDashboard size={19} />, end: true },
    { to: "/objects", label: "Объекты", icon: <Building2 size={19} /> },
    {
      to: "/requests",
      label: "Заявки",
      icon: <ClipboardList size={19} />,
      badge: dash?.requests_open,
    },
    { to: "/warehouse", label: "Склад", icon: <Package size={19} /> },
    {
      to: "/invoices",
      label: "Накладные",
      icon: <ScrollText size={19} />,
      badge: dash?.invoices_pending,
    },
    { to: "/estimates", label: "Смета", icon: <Calculator size={19} /> },
    { to: "/finance", label: "Финансы", icon: <Wallet size={19} /> },
    {
      to: "/inventory",
      label: "Инвентаризация",
      icon: <ClipboardCheck size={19} />,
      badge: dash?.inventory_active,
    },
    { to: "/reports", label: "Отчёты", icon: <BarChart3 size={19} /> },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <img src={logoUrl} alt="Arkand" className="sidebar__logo" />
        <span className="sidebar__brand-sub">Застройщик</span>
      </div>

      <nav className="sidebar__nav">
        <div className="nav-section">Основное</div>
        {main.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            onClick={onNavigate}
            className={({ isActive }) => cx("nav-item", isActive && "nav-item--active")}
          >
            {n.icon}
            <span>{n.label}</span>
            {!!n.badge && n.badge > 0 && <span className="nav-item__badge">{n.badge}</span>}
          </NavLink>
        ))}

        {isOwnerOrAdmin(user?.role) && (
          <>
            <div className="nav-section">Управление</div>
            <NavLink
              to="/admin"
              onClick={onNavigate}
              className={({ isActive }) => cx("nav-item", isActive && "nav-item--active")}
            >
              <Settings size={19} />
              <span>Настройки</span>
            </NavLink>
          </>
        )}
      </nav>

      <div className="sidebar__user">
        <div className="user-card">
          <Avatar name={user?.full_name ?? "?"} />
          <div className="user-card__info">
            <div className="user-card__name">{user?.full_name}</div>
            <div className="user-card__role">{ROLE_LABELS[user?.role ?? ""] ?? user?.role}</div>
          </div>
          <button className="icon-btn" onClick={logout} title="Выйти">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
