import { onContentPolicyInvalidated } from "../contentPolicy";
import { connectedUserIds, sendToUser } from "../wsManager";

/**
 * Les droits d'un compte changent : ses appareils l'apprennent AUSSITÔT
 * (`rights:changed` sur le socket, capacité `rights.live`) et relisent ce
 * qu'ils montrent — listes, fiche, recos, droits de lecture, verdicts des
 * titres gardés hors ligne. Décision de Damien (20/10) : les droits se règlent
 * au bureau ou sur le web et s'appliquent PARTOUT, sans redémarrage.
 *
 * La source est le socle (`onContentPolicyInvalidated`), qui prévient pour
 * toute écriture de politique faite par Tentacle (fiche des droits, Famille :
 * contrôle parental, bibliothèques, membre mineur) ET pour un changement fait
 * dans le tableau de bord de Jellyfin, constaté par le guet de l'accès du
 * compte (`accountAccess/accessWatch.ts`). `null` = tous les comptes.
 *
 * Les sockets d'une session de profil (mobile, bureau, TV) sont rangées au nom
 * du PROFIL : elles reçoivent l'annonce de leur profil, jamais celle du compte
 * de l'appareil. Une rafale d'écritures (âge puis bibliothèques) ne fait
 * qu'une annonce par compte et par fenêtre.
 */

export const RIGHTS_LIVE_DEBOUNCE_MS = 1_000;

const pending = new Map<string, ReturnType<typeof setTimeout>>();
let unsubscribe: (() => void) | null = null;

const keyOf = (userId: string) => userId.replace(/-/g, "").toLowerCase();

/** Les comptes connectés que vise l'annonce (identifiants comparés sans tirets ni casse). */
function targets(userId: string | null): string[] {
  const connected = connectedUserIds();
  if (userId === null) return connected;
  const key = keyOf(userId);
  return connected.filter((id) => keyOf(id) === key);
}

/** Annonce (groupée) que les droits de ce compte — ou de tous — ont changé. */
export function announceRightsChanged(userId: string | null): void {
  const key = userId === null ? "*" : keyOf(userId);
  if (pending.has(key)) return;
  pending.set(key, setTimeout(() => {
    pending.delete(key);
    for (const target of targets(userId)) sendToUser(target, { type: "rights:changed" });
  }, RIGHTS_LIVE_DEBOUNCE_MS));
}

/** Branché une fois au démarrage. */
export function watchRightsLive(): void {
  if (unsubscribe) return;
  unsubscribe = onContentPolicyInvalidated(announceRightsChanged);
}

export function resetRightsLiveForTests(): void {
  unsubscribe?.();
  unsubscribe = null;
  for (const timer of pending.values()) clearTimeout(timer);
  pending.clear();
}
