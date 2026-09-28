import { useSyncExternalStore } from "react";
import type { WtAffinityStateDto } from "@tentacle-tv/shared";

/**
 * Affinité — l'état côté client, un magasin de module (même motif que
 * `roomModalStore`) : la séance de la salle telle que le serveur l'a diffusée,
 * la modale (monté UNE fois, par `AffinityRoot`), et deux mémoires courtes.
 *
 * - `state` suit `wt:affinity`, jamais un état plus vieux que le dernier vu
 *   (`seq`, monotone par salle, séances comprises) ;
 * - la modale a quatre vues : le choix du type, la pile, le match qui vient
 *   de tomber, la liste des matchs ;
 * - `followUntil` : un match vient d'être lancé par un autre et je swipais —
 *   le lancement du média qui suit m'emmène (cf. `wtEvents.ts`) ;
 * - `pillDismissed` : la séance dont j'ai masqué la pilule d'invitation.
 */

export type AffinityView = "kinds" | "deck" | "match" | "matches";

interface AffinityModal {
  open: boolean;
  view: AffinityView;
  /** La vue « match » : le titre qui vient de tomber. */
  matchKey: string | null;
  /** Où revient « Continuer » après un match. */
  returnTo: AffinityView | null;
}

interface AffinityStoreState {
  state: WtAffinityStateDto | null;
  lastSeq: number;
  modal: AffinityModal;
  pillDismissed: number | null;
}

/** Le temps laissé au lanceur pour résoudre et démarrer la lecture. */
const LAUNCH_FOLLOW_MS = 30_000;

const CLOSED: AffinityModal = { open: false, view: "kinds", matchKey: null, returnTo: null };
let store: AffinityStoreState = { state: null, lastSeq: 0, modal: CLOSED, pillDismissed: null };
let followUntil = 0;
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
 * Un état poussé par le socket. Le socket livre dans l'ordre : seul un état
 * plus vieux que le dernier vu est écarté (une séance arrêtée, `null`, n'a
 * pas de numéro — elle passe toujours). Rend faux s'il est écarté.
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
  const next = view ?? (store.state ? "deck" : "kinds");
  emit({ ...store, modal: { open: true, view: next, matchKey: null, returnTo: null } });
}

export function showAffinityView(view: AffinityView): void {
  if (store.modal.open) emit({ ...store, modal: { ...store.modal, view, matchKey: null } });
}

/** Un match vient de tomber : par-dessus la pile si elle est ouverte, sinon
 *  dans la modale ouverte pour lui (« Plus tard » la referme). */
export function showAffinityMatch(key: string): void {
  // Annoncé deux fois (réponse REST de mon vote, puis le socket) : une seule vue.
  if (store.modal.open && store.modal.view === "match" && store.modal.matchKey === key) return;
  const returnTo = store.modal.open ? (store.modal.view === "match" ? store.modal.returnTo : store.modal.view) : null;
  emit({ ...store, modal: { open: true, view: "match", matchKey: key, returnTo } });
}

/** « Continuer » après un match : retour à la vue d'avant, ou fermeture. */
export function leaveAffinityMatch(): void {
  const { returnTo } = store.modal;
  if (returnTo) emit({ ...store, modal: { open: true, view: returnTo, matchKey: null, returnTo: null } });
  else closeAffinity();
}

export function closeAffinity(): void {
  if (store.modal.open) emit({ ...store, modal: CLOSED });
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
  emit({ state: null, lastSeq: 0, modal: CLOSED, pillDismissed: null });
}

export function useAffinityStore(): AffinityStoreState {
  return useSyncExternalStore(subscribe, getAffinitySnapshot);
}
