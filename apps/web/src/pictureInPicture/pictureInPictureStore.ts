/**
 * La session PiP du bureau : la lecture réduite qui continue pendant qu'on
 * parcourt l'application.
 *
 * Un état de MODULE, et non un état React : la route du lecteur s'en va
 * (`navigate(-1)`) au moment même où la session commence, et c'est elle qui
 * dit à `PlayerStage` de garder le lecteur monté. Un `useState` monté sous la
 * route mourrait avec elle.
 *
 * Là où le PiP existe seulement (`supportsPictureInPicture`) : ailleurs, rien
 * n'appelle `startPipSession`, la session reste vide.
 */

import { useSyncExternalStore } from "react";
import type { Location } from "react-router-dom";

/** Flottant (au-dessus de tout, déplaçable sur tout le bureau) ou ancré dans l'application. */
export type PipMode = "floating" | "docked";

export interface PipSession {
  /** La route du lecteur (`/watch/…`) que le PiP continue de jouer. */
  location: Location;
  mode: PipMode;
  /** Le lecteur était plein écran quand on l'a réduit : on le lui rendra. */
  restoreFullscreen: boolean;
}

let session: PipSession | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPipSession(): PipSession | null {
  return session;
}

export function startPipSession(next: PipSession): void {
  session = next;
  emit();
}

export function updatePipSession(patch: Partial<PipSession>): void {
  if (session === null) return;
  session = { ...session, ...patch };
  emit();
}

export function endPipSession(): void {
  if (session === null) return;
  session = null;
  emit();
}

export function usePipSession(): PipSession | null {
  return useSyncExternalStore(subscribe, getPipSession, getPipSession);
}

/**
 * La route d'un autre épisode, jouée dans le PiP sans toucher à la page que
 * l'utilisateur parcourt. Une clé neuve, comme une vraie navigation.
 */
export function watchLocation(path: string, state: unknown = null): Location {
  const url = new URL(path, "http://pip.invalid");
  return {
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    state,
    key: Math.random().toString(36).slice(2, 10),
    // Le masque d'URL de React Router (7.13) : aucun ici.
    unstable_mask: undefined,
  };
}

/** Le mode choisi la dernière fois, repris à la prochaine réduction. */
const MODE_KEY = "tentacle_pip_mode";

export function preferredPipMode(): PipMode {
  try {
    return localStorage.getItem(MODE_KEY) === "docked" ? "docked" : "floating";
  } catch {
    return "floating";
  }
}

export function rememberPipMode(mode: PipMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* stockage indisponible : le mode par défaut reviendra */
  }
}
