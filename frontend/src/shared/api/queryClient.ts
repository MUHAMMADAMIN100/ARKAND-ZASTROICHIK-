import { QueryClient } from "@tanstack/react-query";

// Настройки под «мгновенный» UX: данные считаются свежими короткое время,
// без рефетча на фокусе — интерфейс не мигает и не дёргается.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});
