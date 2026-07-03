import type { QueryClient, QueryKey } from "@tanstack/react-query";

let _seq = -1;
/** Временный отрицательный id для оптимистично созданной записи. */
export function tempId(): number {
  return _seq--;
}
export function isTempId(id: number): boolean {
  return id < 0;
}

export type Snapshot = Array<readonly [QueryKey, unknown]>;

/** Отменяет активные запросы по ключам и снимает снапшот кэша для отката. */
export async function snapshot(qc: QueryClient, keys: QueryKey[]): Promise<Snapshot> {
  await Promise.all(keys.map((k) => qc.cancelQueries({ queryKey: k })));
  return keys.map((k) => [k, qc.getQueryData(k)] as const);
}

export function restore(qc: QueryClient, snap: Snapshot | undefined) {
  if (!snap) return;
  snap.forEach(([k, v]) => qc.setQueryData(k, v));
}

/** Обновляет данные списка в кэше (если список существует). */
export function patchList<T>(
  qc: QueryClient,
  key: QueryKey,
  updater: (list: T[]) => T[]
) {
  qc.setQueryData<T[]>(key, (old) => (old ? updater(old) : old));
}

export const listOps = {
  prepend<T>(item: T) {
    return (list: T[]) => [item, ...list];
  },
  update<T extends { id: number }>(id: number, patch: Partial<T>) {
    return (list: T[]) => list.map((x) => (x.id === id ? { ...x, ...patch } : x));
  },
  replace<T extends { id: number }>(oldId: number, item: T) {
    return (list: T[]) => list.map((x) => (x.id === oldId ? item : x));
  },
  remove<T extends { id: number }>(id: number) {
    return (list: T[]) => list.filter((x) => x.id !== id);
  },
};
