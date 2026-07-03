import { create } from "zustand";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { tokenStore } from "@/shared/api/token";
import { qk } from "@/shared/api/keys";
import { queryClient } from "@/shared/api/queryClient";
import type { Role } from "@/shared/config/enums";

export interface User {
  id: number;
  full_name: string;
  username: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

interface SessionState {
  user: User | null;
  ready: boolean;
  setUser: (u: User | null) => void;
  setReady: (v: boolean) => void;
}

export const useSession = create<SessionState>((set) => ({
  user: null,
  ready: false,
  setUser: (user) => set({ user }),
  setReady: (ready) => set({ ready }),
}));

interface LoginResponse {
  access_token: string;
  user: User;
}

export function useLogin() {
  return useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const res = await api.post<LoginResponse>("/auth/login", data);
      return res.data;
    },
    onSuccess: (data) => {
      tokenStore.set(data.access_token);
      useSession.getState().setUser(data.user);
    },
  });
}

/** Гидратация сессии при загрузке приложения по сохранённому токену. */
export function useHydrateSession() {
  const setUser = useSession((s) => s.setUser);
  const setReady = useSession((s) => s.setReady);

  return useQuery({
    queryKey: qk.me,
    enabled: !!tokenStore.get(),
    retry: false,
    queryFn: async () => {
      try {
        const res = await api.get<User>("/auth/me");
        setUser(res.data);
        return res.data;
      } finally {
        setReady(true);
      }
    },
  });
}

export function logout() {
  tokenStore.clear();
  useSession.getState().setUser(null);
  queryClient.clear();
  location.href = "/login";
}

/** Проверка прав: владелец и админ видят всё. */
export function canManageUsers(role?: Role): boolean {
  return role === "admin";
}
export function isOwnerOrAdmin(role?: Role): boolean {
  return role === "owner" || role === "admin";
}
