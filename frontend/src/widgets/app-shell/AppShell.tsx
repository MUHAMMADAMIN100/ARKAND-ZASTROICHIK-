import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { Drawer } from "@/shared/ui";
import { Sidebar } from "./Sidebar";
import logoUrl from "@/shared/assets/logo.png";

const TITLES: Record<string, string> = {
  "/": "Обзор",
  "/objects": "Объекты",
  "/requests": "Заявки на материалы",
  "/warehouse": "Склад материалов",
  "/invoices": "Накладные",
  "/estimates": "Смета по объектам",
  "/finance": "Финансы и касса",
  "/inventory": "Инвентаризация",
  "/reports": "Отчёты",
  "/admin": "Настройки",
};

function titleFor(pathname: string): string {
  if (pathname.startsWith("/objects/")) return "Карточка объекта";
  return TITLES[pathname] ?? "Arkand · Застройщик";
}

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    <div className="shell">
      <Sidebar />

      <div className="shell-main">
        <header className="topbar">
          <button
            className="icon-btn topbar__burger"
            onClick={() => setDrawerOpen(true)}
            aria-label="Меню"
          >
            <Menu size={22} />
          </button>
          <img src={logoUrl} alt="Arkand" className="topbar__logo-m" />
          <span className="topbar__title">{titleFor(location.pathname)}</span>
          <div className="topbar__spacer" />
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Sidebar onNavigate={() => setDrawerOpen(false)} />
      </Drawer>
    </div>
  );
}
