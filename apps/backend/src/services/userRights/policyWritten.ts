import { invalidateContentPolicy } from "../contentPolicy";
import { resyncGuestsOfCreator } from "../family/guestPolicySync";

/**
 * Après TOUTE écriture de politique faite par Tentacle : ce qui en dépend ne doit
 * pas survivre — la politique de contenu gardée 30 s, et (contrôle parental de la
 * Famille) les invités dont ce compte est le créateur, recalculés.
 */

type Listener = (userId: string) => Promise<void> | void;
const listeners: Listener[] = [resyncGuestsOfCreator];

/** Un service qui dépend d'une politique s'abonne ici (sans dépendance circulaire). */
export function onPolicyWritten(listener: Listener): void {
  listeners.push(listener);
}

/** Jamais une exception : une suite qui échoue ne défait pas l'écriture. */
export async function notePolicyWritten(userId: string): Promise<void> {
  invalidateContentPolicy(userId);
  for (const listener of listeners) {
    try {
      await listener(userId);
    } catch {
      console.log("[user-rights] une suite d'écriture de politique a échoué");
    }
  }
}
