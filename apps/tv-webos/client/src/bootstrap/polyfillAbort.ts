/**
 * `AbortController` (Chrome 66) et `AbortSignal.timeout` (Chrome 103).
 *
 * Cinq points d'`apps/web` et de `packages/api-client` annulent des requêtes
 * avec un contrôleur ; `react-router` en utilise un lui aussi. core-js ne les
 * fournit pas — ce sont des API du DOM, pas du langage.
 *
 * L'implémentation est volontairement minimale : elle porte l'état `aborted`,
 * la raison, et les auditeurs. Ce que `fetch` en fait est une autre affaire —
 * un moteur de 2016 ignorera le `signal` qu'on lui passe et la requête ira à
 * son terme. Aucun appelant du dépôt ne dépend de l'interruption réseau
 * elle-même : ils vérifient `signal.aborted` pour jeter le résultat.
 */

type Auditeur = () => void;

class SignalAnnulation {
  aborted = false;
  reason: unknown = undefined;
  onabort: Auditeur | null = null;

  private readonly auditeurs = new Set<Auditeur>();

  addEventListener(type: string, auditeur: Auditeur): void {
    if (type === "abort") this.auditeurs.add(auditeur);
  }

  removeEventListener(type: string, auditeur: Auditeur): void {
    if (type === "abort") this.auditeurs.delete(auditeur);
  }

  throwIfAborted(): void {
    if (this.aborted) throw this.reason;
  }

  declencher(raison: unknown): void {
    if (this.aborted) return;
    this.aborted = true;
    this.reason = raison;
    if (this.onabort) this.onabort();
    for (const auditeur of this.auditeurs) auditeur();
    this.auditeurs.clear();
  }
}

class ControleurAnnulation {
  readonly signal = new SignalAnnulation();

  abort(raison?: unknown): void {
    this.signal.declencher(raison ?? new Error("AbortError"));
  }
}

export function installerPolyfillAbort(): void {
  const global = window as unknown as Record<string, unknown>;

  if (typeof global.AbortController !== "function") {
    global.AbortController = ControleurAnnulation;
    global.AbortSignal = SignalAnnulation;
  }

  const signal = global.AbortSignal as { timeout?: unknown } | undefined;
  if (signal && typeof signal.timeout !== "function") {
    signal.timeout = (millisecondes: number) => {
      const controleur = new (global.AbortController as new () => ControleurAnnulation)();
      setTimeout(() => controleur.abort(new Error("TimeoutError")), millisecondes);
      return controleur.signal;
    };
  }
}
