import { normalizeProviderFilter } from "@tentacle-tv/api-client";
import { readRecoFilterMirror, writeRecoFilterMirror } from "./recoFilterStorage";

/**
 * Le store EXTERNE du filtre de plateformes (useSyncExternalStore) : une
 * valeur, ses abonnés, le compte propriétaire, et un drapeau « modification
 * locale en attente » — le serveur ne reprend la main que quand rien
 * n'attend d'être poussé.
 */
let owner: string | null = null;
let bound = false;
let value: number[] = [];
let dirty = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function same(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/** Lie le store à un compte : relit le miroir de CE compte. Idempotent. */
export function bindRecoFilterOwner(next: string | null): void {
  if (bound && next === owner) return;
  bound = true;
  owner = next;
  const mirrored = readRecoFilterMirror(owner);
  dirty = false;
  if (!same(mirrored, value)) {
    value = mirrored;
    emit();
  }
}

export function getRecoFilter(): number[] {
  return value;
}

export function subscribeRecoFilter(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** « user » : choix local, miroir écrit, à pousser ; « server » : réglage
 *  reçu, adopté seulement si rien de local n'attend. */
export function setRecoFilter(ids: readonly number[], source: "user" | "server"): void {
  const next = normalizeProviderFilter(ids);
  if (source === "server" && dirty) return;
  if (same(next, value)) return;
  value = next;
  if (source === "user") dirty = true;
  writeRecoFilterMirror(next, owner);
  emit();
}

/** Le PUT a abouti pour ces ids : plus rien en attente (si la valeur n'a pas bougé depuis). */
export function markRecoFilterSynced(ids: readonly number[]): void {
  if (same(normalizeProviderFilter(ids), value)) dirty = false;
}

export function isRecoFilterDirty(): boolean {
  return dirty;
}

/** Isolation des tests. */
export function resetRecoFilterStoreForTests(): void {
  owner = null;
  bound = false;
  value = [];
  dirty = false;
  listeners.clear();
}
