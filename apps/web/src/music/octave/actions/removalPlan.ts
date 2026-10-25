/**
 * Octave — retirer des rangées d'une playlist, et savoir les REMETTRE (« Annuler » de l'avis, retour de Damien du
 * 25/10 : un geste, jamais une confirmation). Règle pure :
 * - une entrée Jellyfin retient sa place parmi les entrées Jellyfin (les attentes intercalées n'y comptent pas) ;
 * - une attente (titre hors bibliothèque) retient sa demande : son titre externe, sa position voulue, son doublon ;
 * - remettre les entrées dans l'ordre CROISSANT de leur place reconstruit la liste telle qu'elle était.
 */

import type { MusicTrack, PendingMusicItem } from "@tentacle-tv/shared/music";
import type { ListRow } from "@tentacle-tv/shared/octave";

export interface EntryRemoval {
  entryId: string;
  /** L'élément Jellyfin à réinsérer ; `null` : rien à remettre (entrée sans identifiant connu). */
  itemId: string | null;
  position: number;
  track: MusicTrack;
}

export interface WaitRemoval {
  operationId: string;
  externalId: string | null;
  /** La position voulue à l'origine ; `null` : à la fin. */
  position: number | null;
  duplicate: boolean;
  track: MusicTrack;
}

export interface RemovalPlan {
  entries: EntryRemoval[];
  waits: WaitRemoval[];
}

export function removalPlan(rows: readonly ListRow[], keys: ReadonlySet<string>, pending: readonly PendingMusicItem[]): RemovalPlan {
  const plan: RemovalPlan = { entries: [], waits: [] };
  let entryIndex = 0;
  for (const row of rows) {
    if (row.entryId !== null) {
      if (keys.has(row.rowKey)) plan.entries.push({ entryId: row.entryId, itemId: row.track.jellyfinId, position: entryIndex, track: row.track });
      entryIndex += 1;
    } else if (row.pending && keys.has(row.rowKey)) {
      const operationId = row.pending.operationId;
      const item = pending.find((p) => p.operationId === operationId);
      plan.waits.push({
        operationId,
        externalId: item?.externalId ?? row.track.external?.id ?? null,
        position: item?.position ?? null,
        duplicate: item?.duplicate === true,
        track: row.track,
      });
    }
  }
  return plan;
}

/** Les entrées à remettre, dans l'ordre qui rend à chacune sa place. */
export function restoreOrder(entries: readonly EntryRemoval[]): EntryRemoval[] {
  return [...entries].filter((e) => e.itemId !== null).sort((a, b) => a.position - b.position);
}

export function removalCount(plan: RemovalPlan): number {
  return plan.entries.length + plan.waits.length;
}

/** Les gestes qu'un retrait et sa remise demandent (le crochet les branche sur l'API ; les tests, sur des doublures). */
export interface RemovalDeps {
  removeEntry: (entry: EntryRemoval) => Promise<unknown>;
  /** `true` : l'attente est retirée (sa demande annulée). */
  removeWait: (wait: WaitRemoval) => Promise<boolean>;
  insertEntry: (entry: EntryRemoval) => Promise<unknown>;
  /** `true` : la demande est refaite. */
  addWait: (wait: WaitRemoval) => Promise<boolean>;
}

/** Retire ce que le plan dit ; rend ce qui est VRAIMENT parti (seul cela revient à l'annulation). Un refus arrête les entrées. */
export async function applyRemoval(deps: RemovalDeps, plan: RemovalPlan): Promise<RemovalPlan> {
  const done: RemovalPlan = { entries: [], waits: [] };
  try {
    for (const e of plan.entries) {
      await deps.removeEntry(e);
      done.entries.push(e);
    }
  } catch {
    /* Ce qui est parti reste annulable ; les attentes se retirent quand même. */
  }
  for (const w of plan.waits) {
    if (await deps.removeWait(w).catch(() => false)) done.waits.push(w);
  }
  return done;
}

/** Remet ce qui a été retiré, chaque entrée à sa place ; `false` au premier refus. */
export async function applyRestore(deps: RemovalDeps, done: RemovalPlan): Promise<boolean> {
  try {
    for (const e of restoreOrder(done.entries)) await deps.insertEntry(e);
    for (const w of done.waits) {
      if (w.externalId !== null && !(await deps.addWait(w))) return false;
    }
    return true;
  } catch {
    return false;
  }
}
