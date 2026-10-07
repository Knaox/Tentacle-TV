import { BackHandler, Platform, TVEventHandler, type HWEvent } from "react-native";
import {
  ANDROIDTV_BACK_SIGNAL,
  ANDROIDTV_BINDINGS,
  createBackTakers,
  createAndroidTvReader,
  createRemoteInput,
  type IntentEvent,
} from "@tentacle-tv/tv-core";

/**
 * L'ENTRÉE UNIQUE de la télécommande d'Android TV — le pendant de
 * `platform/tvos/input/remoteInput.ts`, et le seul abonnement natif à la
 * télécommande du chemin refondu sur Android.
 *
 * Chaque événement de `TVEventHandler` est lu en signal (`createAndroidTvReader`)
 * et donné à l'entrée commune de tv-core (`createRemoteInput`), qui le traduit
 * par la table d'Android TV (`ANDROIDTV_BINDINGS`) en intention, la montre à
 * ses observateurs puis la fait résoudre par la pile des contextes. Rien ne se
 * décide ici.
 *
 * Retour n'arrive pas par `TVEventHandler` : Android le rend à l'activité, qui
 * le passe à `BackHandler` — au relâchement, en demandant tout de suite s'il
 * est pris (`traits.backDecidedAhead` : faux). L'adaptateur y tient UN
 * écouteur : Retour entre dans l'entrée commune (signal `back` → `retour`),
 * puis il est PRIS si un contexte l'a pris, ou si un preneur inscrit le prend
 * (`takeBack` : l'applicateur du Retour, couches et pages poussées) ; sinon
 * il est laissé à la suite — le navigateur, puis la sortie de l'app. Une
 * `Modal` a son propre `Dialog` : son Retour va à `onRequestClose`
 * (`withMenuIntent`), sans passer par ici.
 *
 * L'abonnement à `TVEventHandler` naît avec le premier écouteur (observateur
 * ou contexte) et part avec le dernier. Android TV seulement : ailleurs, rien
 * ne s'abonne et rien n'arrive.
 */

export const ANDROIDTV_REMOTE_SUPPORTED = Platform.OS === "android" && Platform.isTV;

/** L'entrée commune, nourrie par la télécommande d'Android TV. Une seule pour l'app. */
export const androidTvInput = createRemoteInput(ANDROIDTV_BINDINGS);

const backTakers = createBackTakers();

/**
 * Inscrit un preneur du Retour (le dernier inscrit répond le premier) ; rend
 * de quoi le retirer. Chaque inscription — chaque écran qui se monte —
 * remet l'écouteur de `BackHandler` en tête (`installBack`).
 */
export function takeBack(taker: () => boolean): () => void {
  const remove = backTakers.add(taker);
  installBack();
  return remove;
}

let keySubscription: { remove(): void } | null = null;
let backSubscription: { remove(): void } | null = null;
let backInstallPending = false;

/** La lecture se souvient des touches enfoncées : un enfoncement redit est une répétition (`repeat`). */
const read = createAndroidTvReader();

function dispatch(event: HWEvent): void {
  androidTvInput.receive(read(event, Date.now()));
}

/**
 * Retour, d'où qu'il vienne : il entre dans l'entrée commune (ses
 * observateurs voient `retour`, la pile des contextes le résout), et rend
 * vrai s'il a été pris — par un contexte, ou par un preneur inscrit.
 */
export function receiveBack(): boolean {
  const takenByContext = androidTvInput.contexts.resolve({ type: "retour" }) !== null;
  androidTvInput.receive({ name: ANDROIDTV_BACK_SIGNAL, phase: "up", at: Date.now() });
  return takenByContext || backTakers.take();
}

/**
 * L'écouteur de `BackHandler` doit répondre AVANT celui du navigateur
 * (`useBackButton` de react-navigation, inscrit à la pose du conteneur) :
 * `BackHandler` interroge le DERNIER inscrit d'abord. Les effets d'un rendu
 * passent enfants d'abord, conteneur ensuite : on s'inscrit donc une fois le
 * rendu en cours terminé.
 *
 * Et on s'y RÉINSCRIT à chaque nouveau preneur. Quitter l'app par Retour ne
 * finit que l'activité : le contexte JS survit, et à la réouverture un NOUVEAU
 * conteneur réinscrit son écouteur, en tête, par-dessus le nôtre, inscrit une
 * fois pour toutes. Il dépilait alors lui-même la page devant, avant toute
 * couche : Retour dans la feuille du lecteur QUITTAIT la lecture (retour
 * d'essai, Shield ; reproduit à l'émulateur : sortie par Retour, réouverture,
 * feuille « Pistes », Retour → l'accueil).
 */
function installBack(): void {
  if (backInstallPending || !ANDROIDTV_REMOTE_SUPPORTED) return;
  backInstallPending = true;
  setTimeout(() => {
    backInstallPending = false;
    backSubscription?.remove();
    backSubscription = BackHandler.addEventListener("hardwareBackPress", receiveBack);
  }, 0);
}

function sync(needed: boolean): void {
  if (!ANDROIDTV_REMOTE_SUPPORTED) return;
  if (needed) installBack();
  if (needed && !keySubscription) {
    keySubscription = TVEventHandler.addListener(dispatch) ?? null;
  } else if (!needed && keySubscription) {
    keySubscription.remove();
    keySubscription = null;
  }
}

androidTvInput.onDemand(sync);

/** Même nom que sur Apple TV (Menu y est le Retour) : Retour, rendu par une source à part. */
export function receiveMenu(): IntentEvent | null {
  return androidTvInput.receive({ name: ANDROIDTV_BACK_SIGNAL, phase: "up", at: Date.now() });
}

/**
 * Pour `Modal.onRequestClose` (Retour dans une modale, qui a son propre
 * `Dialog`) : Retour passe d'abord par l'entrée unique, puis la modale se
 * ferme comme avant — `onRequestClose={withMenuIntent(close)}`.
 */
export function withMenuIntent(close: () => void): () => void {
  return () => {
    receiveMenu();
    close();
  };
}
