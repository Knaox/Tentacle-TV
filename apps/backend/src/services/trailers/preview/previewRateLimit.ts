/* ------------------------------------------------------------------ */
/*  La limite des aperçus, par compte                                   */
/*                                                                     */
/*  Le client attend une intention (un survol qui dure), mais le       */
/*  serveur se protège : un survol rapide d'une rangée ne doit pas     */
/*  lancer trente extractions. Un seau par compte — dix aperçus        */
/*  d'avance, puis un toutes les trois secondes (parcourir des titres  */
/*  neufs hors bibliothèque ne doit pas se heurter à « réessayez » ;   */
/*  le budget de l'heure de YouTube reste le vrai garde-fou). Seules   */
/*  les décisions À PRENDRE y puisent : un aperçu déjà décidé (mémoire */
/*  du serveur, préparation des titres à l'écran) ou en cours de       */
/*  décision ne coûte rien.                                            */
/* ------------------------------------------------------------------ */

export type RateVerdict = { ok: true } | { ok: false; retryAfterS: number };

export class PreviewRateLimiter {
  private readonly buckets = new Map<string, { tokens: number; at: number }>();

  /**
   * @param capacity aperçus d'avance ;
   * @param refillMs un aperçu de plus tous les `refillMs` ;
   * @param maxAccounts au-delà, les seaux les plus anciens sont oubliés (pleins).
   */
  constructor(
    private readonly capacity = 10,
    private readonly refillMs = 3_000,
    private readonly maxAccounts = 1_000,
  ) {}

  take(account: string, now = Date.now()): RateVerdict {
    const known = this.buckets.get(account);
    const refilled = known ? Math.min(this.capacity, known.tokens + (now - known.at) / this.refillMs) : this.capacity;
    this.buckets.delete(account);
    if (refilled < 1) {
      this.buckets.set(account, { tokens: refilled, at: now });
      return { ok: false, retryAfterS: Math.max(1, Math.ceil(((1 - refilled) * this.refillMs) / 1000)) };
    }
    this.buckets.set(account, { tokens: refilled - 1, at: now });
    while (this.buckets.size > this.maxAccounts) {
      const oldest = this.buckets.keys().next().value;
      if (oldest === undefined) break;
      this.buckets.delete(oldest);
    }
    return { ok: true };
  }

  clear(): void {
    this.buckets.clear();
  }
}
