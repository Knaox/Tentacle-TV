import { useSyncExternalStore } from "react";
import type { WtAffinityStateDto } from "@tentacle-tv/shared";

/**
 * Affinité — l'état côté client, un magasin de module (même motif que
 * `roomModalStore`) : la séance de la salle telle que le serveur l'a diffusée,
 * la modale (montée UNE fois, par `AffinityRoot`), et deux mémoires courtes.
 *
 * - `state` suit `wt:affinity`, jamais un état plus vieux que le dernier vu
 *   (`seq`, monotone par salle, séances comprises) ;
 * - la modale a deux vues à soi : le choix du type et la pile. Le match ne
 *   s'y choisit pas : il se lit dans l'état (`proposals`), chez tous à la fois ;
 * - `notice` : ce que les autres viennent de faire (lancer, quitter, écarter
 *   un match…), dit DANS la modale — un toast passerait sous son voile ;
 * - `followUntil` : un match vient d'être lancé par un autre et je swipais —
 *   le lancement du média qui suit m'emmène (cf. `wtEvents.ts`) ;
 * - `pillDismissed` : la séance dont j'ai masqué la pilule d'invitation.
 */

export type AffinityView = "kinds" | "deck";

interface AffinityModal {
  open: boolean;
  view: AffinityView;
}

/** Un fait du groupe, dit dans la modale ; `userId` : son auteur (l'avatar). */
export interface AffinityNotice {
  id: number;
  userId: string | null;
  text: string;
}

interface AffinityStoreState {
  state: WtAffinityStateDto | null;
  lastSeq: number;
  modal: AffinityModal;
  pillDismissed: number | null;
  notice: AffinityNotice | null;
}

/** Le temps laissé au lanceur pour résoudre et démarrer la lecture. */
const LAUNCH_FOLLOW_MS = 30_000;

const CLOSED: AffinityModal = { open: false, view: "kinds" };
let store: AffinityStoreState = { state: null, lastSeq: 0, modal: CLOSED, pillDismissed: null, notice: null };
let followUntil = 0;
let noticeId = 0;
const listeners = new Set<() => void>();

function emit(next: AffinityStoreState): void {
  store = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Diffusions appliquées : une lecture REST partie avant l'une d'elles est périmée. */
let pushCount = 0;

/**
 * Un état poussé par le socket (ou rendu par un geste). Le socket livre dans
 * l'ordre : seul un état plus vieux que le dernier vu est écarté (une séance
 * refermée, `null`, n'a pas de numéro — elle passe toujours). Rend faux s'il
 * est écarté.
 */
export function applyAffinityPush(state: WtAffinityStateDto | null): boolean {
  if (state && state.seq <= store.lastSeq) return false;
  pushCount++;
  emit({ ...store, state, lastSeq: state?.seq ?? store.lastSeq });
  return true;
}

/** À prendre AVANT une lecture REST, à rendre avec sa réponse. */
export function affinityFetchMark(): number {
  return pushCount;
}

/** La réponse d'une lecture REST : ignorée si le socket a parlé depuis. */
export function applyAffinityFetch(state: WtAffinityStateDto | null, mark: number): boolean {
  if (mark !== pushCount) return false;
  emit({ ...store, state, lastSeq: Math.max(store.lastSeq, state?.seq ?? 0) });
  return true;
}

export function getAffinitySnapshot(): AffinityStoreState {
  return store;
}

/** Ouvre la modale sur la vue qui convient : la pile s'il y a une séance. */
export function openAffinity(view?: AffinityView): void {
  emit({ ...store, modal: { open: true, view: view ?? (store.state ? "deck" : "kinds") } });
}

export function showAffinityView(view: AffinityView): void {
  if (store.modal.open) emit({ ...store, modal: { ...store.modal, view } });
}

/** Referme la modale, sans rien dire au serveur (il l'a décidé, ou rien ne
 *  tournait) ; quitter la séance, c'est `leaveAffinity` d'abord. */
export function closeAffinity(): void {
  if (store.modal.open || store.notice) emit({ ...store, modal: CLOSED, notice: null });
}

/** Dit dans la modale ce qu'un membre vient de faire ; remplace le précédent. */
export function showAffinityNotice(userId: string | null, text: string): void {
  emit({ ...store, notice: { id: ++noticeId, userId, text } });
}

/** Efface ce fait-là — pas un plus récent arrivé entre-temps. */
export function clearAffinityNotice(id: number): void {
  if (store.notice?.id === id) emit({ ...store, notice: null });
}

export function dismissAffinityPill(sessionId: number): void {
  emit({ ...store, pillDismissed: sessionId });
}

/** Un autre lance un match pendant que je swipais : je le suivrai. */
export function armLaunchFollow(now = Date.now()): void {
  followUntil = now + LAUNCH_FOLLOW_MS;
}

/** Le lancement de groupe qui arrive doit-il m'emmener ? (consommé une fois) */
export function consumeLaunchFollow(now = Date.now()): boolean {
  const follow = now < followUntil;
  followUntil = 0;
  return follow;
}

/** La salle quittée : plus de séance, plus de modale. */
export function resetAffinity(): void {
  followUntil = 0;
  emit({ state: null, lastSeq: 0, modal: CLOSED, pillDismissed: null, notice: null });
}

export function useAffinityStore(): AffinityStoreState {
  return useSyncExternalStore(subscribe, getAffinitySnapshot);
}
