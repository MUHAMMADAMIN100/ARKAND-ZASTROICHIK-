import axios, { AxiosError } from "axios";
import { tokenStore } from "./token";

const baseURL = import.meta.env.VITE_API_URL || "/api";

export const api = axios.create({ baseURL, timeout: 20000 });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    if (error.response?.status === 401 && !location.pathname.startsWith("/login")) {
      tokenStore.clear();
      // мягкий редирект на вход
      if (!location.pathname.startsWith("/login")) {
        location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

/** Достаёт человекочитаемое сообщение об ошибке из ответа API. */
export function apiError(error: unknown): string {
  const e = error as AxiosError<{ detail?: string | { msg: string }[] }>;
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) return detail[0]?.msg ?? "Ошибка запроса";
  if (e?.message) return e.message;
  return "Что-то пошло не так";
}
