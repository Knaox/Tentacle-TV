/**
 * Anti-rebond par clé : « a-t-on déjà TENTÉ récemment ? ». Le mutex d'un
 * travail (generatePool, rebuildProfile) dédoublonne les appels simultanés ;
 * cette garde borne la FRÉQUENCE des relances — un pool préliminaire dont la
 * relève échoue ne repartait qu'à chaque requête, c'est-à-dire sans cesse
 * sous un client qui sonde toutes les cinq secondes.
 *
 * `now` est injecté pour les tests ; `release` libère la clé quand le travail
 * a rendu son verdict (succès ou échec avéré) — la tentative suivante est
 * alors libre, sans attendre l'intervalle.
 */
export class AttemptGate {
  private readonly lastAttemptAt = new Map<string, number>();

  constructor(readonly minIntervalMs: number) {}

  /** true : à vous de jouer, la tentative est enregistrée ; false : trop tôt. */
  tryAcquire(key: string, now = Date.now()): boolean {
    const last = this.lastAttemptAt.get(key);
    if (last !== undefined && now - last < this.minIntervalMs) return false;
    this.lastAttemptAt.set(key, now);
    return true;
  }

  release(key: string): void {
    this.lastAttemptAt.delete(key);
  }

  clear(): void {
    this.lastAttemptAt.clear();
  }
}
