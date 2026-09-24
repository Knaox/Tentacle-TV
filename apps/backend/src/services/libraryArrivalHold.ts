// Le temps de laisser une arrivée se poser. Jellyfin range un pack de saison
// en plusieurs vagues — dossier par dossier, métadonnées en décalé — et une
// annonce à la première vague donnait « Saison 1 (3 épisodes) », puis
// « Saison 1 (7 épisodes) » une minute plus tard. Les nouveaux IDs attendent
// donc que la bibliothèque se taise SETTLE_MS, sans jamais attendre plus de
// MAX_HOLD_MS : une importation qui n'en finit pas n'étouffe rien.
//
// L'attente vit en mémoire : un redémarrage la perd sans rien perdre d'autre,
// les IDs pas encore relâchés n'étant pas dans l'instantané, le diff suivant
// les retrouve.

export const SETTLE_MS = 45_000;
export const MAX_HOLD_MS = 10 * 60_000;
/** Jellyfin remplit les métadonnées (vrai titre, numéros, TMDB) après l'ajout :
 *  un item pas prêt attend jusque-là depuis sa détection, puis part tel quel. */
export const METADATA_WAIT_MS = 5 * 60_000;

interface Held {
  firstSeen: number;
}

export class ArrivalHold {
  private readonly held = new Map<string, Held>();

  get size(): number {
    return this.held.size;
  }

  ids(): string[] {
    return [...this.held.keys()];
  }

  /**
   * Le diff du moment : `newIds` = tout ce qui n'est pas dans l'instantané
   * (les IDs déjà en attente y figurent encore). Un ID qui n'y est plus a
   * disparu avant d'être annoncé — fichier temporaire, import annulé — et sort.
   */
  observe(newIds: string[], now: number): void {
    const current = new Set(newIds);
    for (const id of this.held.keys()) if (!current.has(id)) this.held.delete(id);
    for (const id of newIds) if (!this.held.has(id)) this.held.set(id, { firstSeen: now });
  }

  /** Relâcher maintenant ? La bibliothèque s'est tue, ou l'attente a assez duré. */
  isSettled(now: number): boolean {
    const next = this.nextCheckAt();
    return next !== null && now >= next;
  }

  /** Quand revenir voir (null : rien en attente). */
  nextCheckAt(): number | null {
    if (this.held.size === 0) return null;
    let newest = -Infinity;
    let oldest = Infinity;
    for (const h of this.held.values()) {
      newest = Math.max(newest, h.firstSeen);
      oldest = Math.min(oldest, h.firstSeen);
    }
    return Math.min(newest + SETTLE_MS, oldest + MAX_HOLD_MS);
  }

  /**
   * Un item aux métadonnées pas prêtes peut-il encore attendre ? Faux = assez
   * attendu depuis sa détection : on l'annonce avec ce qu'on a.
   */
  canWait(id: string, now: number): boolean {
    const h = this.held.get(id);
    return !!h && now - h.firstSeen < METADATA_WAIT_MS;
  }

  release(ids: string[]): void {
    for (const id of ids) this.held.delete(id);
  }
}
