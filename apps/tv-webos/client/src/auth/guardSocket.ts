import { acquireSocket } from "@tentacle-tv/api-client";

/**
 * La référence que la garde de session tient sur le socket Tentacle — pour
 * toute la vie de l'application, puisque le lecteur n'en prend aucune (voir
 * `sessionGuardTv.ts`). Le déjumelage la relâche : sans elle, le socket
 * restait authentifié avec l'ancien jeton.
 */

let release: (() => void) | null = null;

export function holdSocket(token: string): void {
  release?.();
  release = acquireSocket(token);
}

export function releaseHeldSocket(): void {
  release?.();
  release = null;
}
