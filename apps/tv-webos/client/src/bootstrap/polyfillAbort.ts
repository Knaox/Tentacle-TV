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

type Listener = () => void;

class AbortSignal2 {
  aborted = false;
  reason: unknown = undefined;
  onabort: Listener | null = null;

  private readonly listeners = new Set<Listener>();

  addEventListener(type: string, listener: Listener): void {
    if (type === "abort") this.listeners.add(listener);
  }

  removeEventListener(type: string, listener: Listener): void {
    if (type === "abort") this.listeners.delete(listener);
  }

  throwIfAborted(): void {
    if (this.aborted) throw this.reason;
  }

  trigger2(reason: unknown): void {
    if (this.aborted) return;
    this.aborted = true;
    this.reason = reason;
    if (this.onabort) this.onabort();
    for (const listener of this.listeners) listener();
    this.listeners.clear();
  }
}

class AbortController2 {
  readonly signal = new AbortSignal2();

  abort(reason?: unknown): void {
    this.signal.trigger2(reason ?? new Error("AbortError"));
  }
}

export function installAbortPolyfill(): void {
  const global = window as unknown as Record<string, unknown>;

  if (typeof global.AbortController !== "function") {
    global.AbortController = AbortController2;
    global.AbortSignal = AbortSignal2;
  }

  const signal = global.AbortSignal as { timeout?: unknown } | undefined;
  if (signal && typeof signal.timeout !== "function") {
    signal.timeout = (milliseconds: number) => {
      const controller = new (global.AbortController as new () => AbortController2)();
      setTimeout(() => controller.abort(new Error("TimeoutError")), milliseconds);
      return controller.signal;
    };
  }
}
