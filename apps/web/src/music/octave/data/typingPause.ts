/**
 * Octave — la recherche PRÉPARÉE à la pause de frappe (accord de Damien, 25/10),
 * BUREAU SEULEMENT : quand la barre se tait `TYPING_PAUSE_MS`, le texte est
 * annoncé à l'extension (sa route `typingPause` du manifeste), qui prépare la
 * recherche depuis l'appareil — RIEN n'est affiché ni attendu ici : à Entrée,
 * la recherche validée trouve sa page déjà prête. Générique : le cœur ne sait
 * pas ce que l'extension en fait.
 *
 * Jamais sur le web (aucun exécuteur de requêtes déléguées), jamais sans la
 * route déclarée, jamais deux fois le même texte de suite, au moins
 * `MIN_CHARS` caractères ; Entrée (ou une suggestion choisie) annule la pause
 * en cours (`cancel`).
 */

import { useEffect, useMemo } from "react";
import { musicRouteUrl, tentacleApiFetch, type MusicProvider } from "@tentacle-tv/api-client";
import { supportsClientFetch } from "../../../desktop/bridge";
import { useOctaveProvider } from "../mode/useOctaveProvider";

export const TYPING_PAUSE_MS = 600;
export const MIN_CHARS = 3;

export interface TypingPause {
  /** Le texte de la barre a changé. */
  note(query: string): void;
  /** La recherche est validée (ou la barre quittée) : la pause en cours n'est plus annoncée. */
  cancel(): void;
  dispose(): void;
}

interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

const realTimers: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) };

const comparable = (q: string) => q.trim().replace(/\s+/g, " ").toLocaleLowerCase();

/** La règle, sans React : `send` reçoit le texte tel que tapé, une fois par pause. */
export function createTypingPause(send: (query: string) => void, timers: Timers = realTimers, delayMs = TYPING_PAUSE_MS): TypingPause {
  let pending: unknown = null;
  let last: string | null = null;
  const clear = () => {
    if (pending !== null) timers.clear(pending);
    pending = null;
  };
  return {
    note(query) {
      clear();
      const key = comparable(query);
      if ([...key.replace(/\s/g, "")].length < MIN_CHARS || key === last) return;
      pending = timers.set(() => {
        pending = null;
        last = key;
        send(query.trim());
      }, delayMs);
    },
    cancel: clear,
    dispose: clear,
  };
}

/** La route de l'extension, si elle la déclare (champ additif du manifeste : un cœur ou une extension d'avant n'en ont pas). */
export function typingPauseRoute(provider: MusicProvider | null): string | null {
  const route = (provider?.music as { typingPause?: unknown } | undefined)?.typingPause;
  return typeof route === "string" && route.startsWith("/") ? route : null;
}

const NOOP: TypingPause = { note: () => undefined, cancel: () => undefined, dispose: () => undefined };

export function useTypingPause(): TypingPause {
  const provider = useOctaveProvider();
  const route = typingPauseRoute(provider);
  const pause = useMemo(() => {
    if (!provider || !route || !supportsClientFetch()) return NOOP;
    // Annonce sans attente ni erreur visible : une préparation manquée ne coûte qu'un aller-retour à Entrée.
    return createTypingPause((q) => void tentacleApiFetch(musicRouteUrl(provider, route), { method: "POST", body: JSON.stringify({ q }) }).catch(() => undefined));
  }, [provider, route]);
  useEffect(() => () => pause.dispose(), [pause]);
  return pause;
}
