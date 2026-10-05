"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Anonymous, device-local favourites.
 *
 * There are no visitor accounts by design, so the shortlist lives in
 * `localStorage`. That keeps the entire authentication surface limited to
 * agency staff, removes a whole class of GDPR obligations, and means saving a
 * property costs zero server requests.
 *
 * Implemented as a module-level external store rather than React context so the
 * heart button on a listing card, the counter in the header and the favourites
 * page all read the same value without a provider wrapping the tree — which
 * matters because most of the tree is a server component.
 */

const STORAGE_KEY = "estate:favorites:v1";
const MAX_FAVORITES = 100;
export const MAX_COMPARE = 4;

type Listener = () => void;

let snapshot: readonly string[] = [];
let hydrated = false;
const listeners = new Set<Listener>();

const EMPTY: readonly string[] = [];

function read(): readonly string[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed
      .filter((value): value is string => typeof value === "string")
      .slice(0, MAX_FAVORITES);
  } catch {
    // Private browsing, a full quota or hand-edited storage: degrade to empty.
    return EMPTY;
  }
}

function persist(next: readonly string[]) {
  snapshot = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Losing persistence is survivable; losing the in-memory list is not.
  }
  for (const listener of listeners) listener();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  snapshot = read();

  // Keep multiple tabs in agreement.
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    snapshot = read();
    for (const listener of listeners) listener();
  });
}

function subscribe(listener: Listener): () => void {
  ensureHydrated();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): readonly string[] {
  ensureHydrated();
  return snapshot;
}

/** The server has no favourites, so the first render always matches the HTML. */
function getServerSnapshot(): readonly string[] {
  return EMPTY;
}

export function useFavorites() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback((id: string) => {
    const current = getSnapshot();
    persist(
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [id, ...current].slice(0, MAX_FAVORITES),
    );
  }, []);

  const remove = useCallback((id: string) => {
    persist(getSnapshot().filter((item) => item !== id));
  }, []);

  const add = useCallback((newIds: readonly string[]) => {
    const current = getSnapshot();
    const merged = [...new Set([...newIds, ...current])].slice(
      0,
      MAX_FAVORITES,
    );
    persist(merged);
  }, []);

  const clear = useCallback(() => persist(EMPTY), []);

  return { ids, toggle, remove, add, clear };
}

export function useIsFavorite(id: string): boolean {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return ids.includes(id);
}

export function useFavoriteCount(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot).length;
}
