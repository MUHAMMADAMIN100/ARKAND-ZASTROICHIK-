import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { queryClient } from "@/shared/api/queryClient";
import { tokenStore } from "@/shared/api/token";
import { ToastProvider, Loader } from "@/shared/ui";
import { useHydrateSession, useSession, isOwnerOrAdmin } from "@/entities/session";
import { AppShell } from "@/widgets/app-shell";

import { LoginPage } from "@/pages/login";
import { DashboardPage } from "@/pages/dashboard";
import { ObjectsPage, ObjectDetailPage } from "@/pages/objects";
import { RequestsPage } from "@/pages/requests";
import { WarehousePage } from "@/pages/warehouse";
import { InvoicesPage } from "@/pages/invoices";
import { EstimatesPage } from "@/pages/estimates";
import { FinancePage } from "@/pages/finance";
import { InventoryPage } from "@/pages/inventory";
import { ReportsPage } from "@/pages/reports";
import { AdminPage } from "@/pages/admin";

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, ready } = useSession();
  const token = tokenStore.get();
  if (!token) return <Navigate to="/login" replace />;
  if (!user) return ready ? <Navigate to="/login" replace /> : <Loader label="Загрузка…" />;
  return <>{children}</>;
}

function RequireOwner({ children }: { children: ReactNode }) {
  const user = useSession((s) => s.user);
  if (!isOwnerOrAdmin(user?.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Root() {
  useHydrateSession();
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/objects" element={<ObjectsPage />} />
        <Route path="/objects/:id" element={<ObjectDetailPage />} />
        <Route path="/requests" element={<RequestsPage />} />
        <Route path="/warehouse" element={<WarehousePage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/estimates" element={<EstimatesPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route
          path="/admin"
          element={
            <RequireOwner>
              <AdminPage />
            </RequireOwner>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Root />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
