import { useCallback, useEffect, useMemo, useRef, useState, type Component, type Ref } from "react";
import type { View } from "react-native";
import type { PlayerOverlay } from "@tentacle-tv/shared";
import { PLAYER_OSD_KEYS, playerFocusClaims, preferredFocusOf, skipIslandGuides, skipPillFocus } from "@tentacle-tv/tv-core";
import type { FocusBinder, FocusBinding } from "../../redesign/focus/focusBinding";
import { setSkipNode } from "../../components/player/focus/osdFocusBus";
import { useOverlayFocus, type TransportKey } from "../../components/player/focus/useOverlayFocus";
import { useSkipPillFocus } from "../../components/player/focus/useSkipPillFocus";
import { PLAYER_GROUP_CONTAINERS, withExitLock, withPreferredFocus, type PlayerFocusState } from "../../platform/tvos/player";
import type { FocusStore } from "../../platform/tvos/focus/focusStore";
import { useEndExitLocked, useExitLocked } from "./endExitLock";
import { usePanelReturnFocus } from "./usePanelReturnFocus";

/**
 * Le focus du lecteur Apple TV, posé sur l'habillage refondu par le port
 * (`FocusBindingProvider`). Rien n'y est réinventé : ce sont les mécanismes
 * de l'habillage actuel, branchés sur des clés au lieu de refs.
 * - L'habillage : la mémoire PARTAGÉE du dernier bouton (`useOverlayFocus`,
 *   restauration au signal, cycle de préférence propre à tvOS), et la garde
 *   anti-clic fantôme sur chacun de ses boutons.
 * - La pilule de saut : `useSkipPillFocus` (réclamation au front montant,
 *   relais quand elle s'en va), son nœud publié sur le bus pour le pont de la
 *   frise, sa préférence d'origine (« Masquer » quand ça part tout seul).
 * - Les entrées : l'écran de chargement (Retour, ou Réessayer), la carte
 *   « À suivre », l'affiche de fin et la feuille (Pistes, Réglages) RÉCLAMENT le focus
 *   à leur apparition — `hasTVPreferredFocus` seul n'est honoré qu'au montage,
 *   et ignoré quand le moteur tient déjà un élément ailleurs. Les croix de
 *   l'affiche de fin et du message-outil restent infocalisables tant que leur
 *   entrée n'a pas eu le focus (`useExitLocked`).
 * Le reste des clés passe par le magasin de l'écran (nœud, focus, réclamation).
 * Qui prend le focus, quelle préférence, quelle croix reste verrouillée : les
 * règles de tv-core (`player/playerFocus.ts`) ; leur application native :
 * `platform/tvos/player`.
 */

const OSD_KEYS: Readonly<Record<string, TransportKey>> = PLAYER_OSD_KEYS;

export interface PlayerFocusArgs {
  store: FocusStore;
  /** Signal et cible de la restauration de l'habillage (`useTVPanelControls`). */
  osdFocusSignal: number;
  osdFocusTargetRef: { readonly current: TransportKey | undefined };
  scrubbing: boolean;
  overlay: PlayerOverlay;
  /** La pilule est À L'ÉCRAN (même règle que `PlayerChromeView`). */
  pillShown: boolean;
  /** L'habillage est affiché (`controls.overlayVisible`). */
  overlayVisible: boolean;
  showSettings: boolean;
  showEpisodes: boolean;
  /** L'écran de chargement couvre la dalle ; `failed` : l'ouverture a échoué. */
  loading: boolean;
  failed: boolean;
  upNextShown: boolean;
  endShown: boolean;
  /** Le panneau du message-outil tient le focus (activé par un appui). */
  troubleActive: boolean;
  /** L'option de la feuille (Pistes, Réglages) qui prend le focus à l'ouverture, ou null (fermée). */
  sheetEntryKey: string | null;
  /** La pilule qui a ouvert la feuille (`player:tracks`, `player:settings`) : le focus y revient. */
  sheetOpener: string;
  activeSeasonIndex: number;
}

/** Les groupes ne portent qu'un conteneur, identique d'un rendu à l'autre. */
const GROUP_BINDINGS: Readonly<Record<string, FocusBinding>> = Object.fromEntries(
  Object.entries(PLAYER_GROUP_CONTAINERS).map(([key, container]) => [key, { container }]),
);

function applyRef(ref: Ref<View> | undefined, node: View | null) {
  if (typeof ref === "function") ref(node);
}

/** Réclame le focus pour `key` quand `active` DEVIENT vrai (ou que la clé change). */
function useClaimOnRise(store: FocusStore, key: string | null, active: boolean) {
  useEffect(() => {
    if (!active || !key) return;
    return store.claim(key);
  }, [store, key, active]);
}

export function usePlayerFocus(args: PlayerFocusArgs): { binder: FocusBinder; state: PlayerFocusState; onPanelExited: () => void } {
  const { store, overlay, pillShown, showSettings, showEpisodes } = args;

  const osd = useOverlayFocus({
    focusSignal: args.osdFocusSignal,
    scrubbing: args.scrubbing,
    focusTargetRef: args.osdFocusTargetRef,
  });

  // La pilule : ses deux boutons, lus dans le magasin au moment où il le faut.
  const skipRef = useMemo(() => ({ get current() { return store.node("player:skip"); } }), [store]);
  const dismissRef = useMemo(() => ({ get current() { return store.node("player:skip-dismiss"); } }), [store]);
  // Ce qui revient par l'habillage a déjà été refusé : il se montre, il ne
  // s'impose pas.
  const { refusable, grabs } = skipPillFocus({ overlay, pillShown, showSettings });
  const pill = useSkipPillFocus({
    skipRef, dismissRef, shown: pillShown, grabs, refusable, overlayVisible: args.overlayVisible,
    focusOwnedElsewhere: overlay.kind === "nextCard" || showSettings || showEpisodes,
  });

  // Miroirs lus par les liaisons STABLES : elles ne se recréent jamais.
  const osdRef = useRef(osd);
  osdRef.current = osd;
  const pillRef = useRef(pill);
  pillRef.current = pill;
  const [stable] = useState(() => new Map<string, FocusBinding>());

  const stableBinding = useCallback((key: string): FocusBinding => {
    const cached = stable.get(key);
    if (cached) return cached;
    // Le magasin répond toujours ; le type du port admet « rien ».
    const base: FocusBinding = store.binder(key) ?? {};
    const transport = OSD_KEYS[key];
    let binding: FocusBinding = base;
    if (transport) {
      binding = {
        ...base,
        ref: (node: View | null) => { applyRef(base.ref, node); osdRef.current.registerButton(transport)(node); },
        onFocus: () => { base.onFocus?.(); osdRef.current.buttonProps(transport).onFocus(); },
        phantomPressGuard: true,
      };
    } else if (key === "player:skip" || key === "player:skip-dismiss") {
      const which = key === "player:skip" ? "skip" : "dismiss";
      binding = {
        ...base,
        ref: (node: View | null) => {
          applyRef(base.ref, node);
          // Le pont MONTANT de la frise vise ce nœud (bus de l'habillage).
          if (which === "skip") setSkipNode((node as unknown as Component | null) ?? null);
        },
        onFocus: () => { base.onFocus?.(); pillRef.current.handlers[which].onFocus(); },
        onBlur: () => { base.onBlur?.(); pillRef.current.handlers[which].onBlur(); },
      };
    }
    stable.set(key, binding);
    return binding;
  }, [store, stable]);

  const { failed, sheetEntryKey } = args;
  const endExitLocked = useEndExitLocked(store, args.endShown);
  // Le message-outil réclame lui-même « Réessayer maintenant » (usePlaybackTrouble).
  const troubleExitLocked = useExitLocked(store, args.troubleActive, "trouble:retry");
  const binder = useCallback<FocusBinder>((key) => {
    const group = GROUP_BINDINGS[key];
    if (group) return group;
    const binding = stableBinding(key);
    if ((key === "end:leave" && endExitLocked) || (key === "trouble:back" && troubleExitLocked)) {
      return withExitLock(binding);
    }
    return withPreferredFocus(binding, preferredFocusOf(key, { grabs, refusable, failed, sheetEntryKey }));
  }, [stableBinding, grabs, refusable, failed, sheetEntryKey, endExitLocked, troubleExitLocked]);

  // Quatre réclamations, toujours dans le même ordre (règle des crochets).
  const [loadingClaim, upNextClaim, endClaim, sheetClaim] = playerFocusClaims({
    loading: args.loading, failed, upNextShown: args.upNextShown, endShown: args.endShown, sheetEntryKey,
  });
  useClaimOnRise(store, loadingClaim.key, loadingClaim.active);
  useClaimOnRise(store, upNextClaim.key, upNextClaim.active);
  useClaimOnRise(store, endClaim.key, endClaim.active);
  useClaimOnRise(store, sheetClaim.key, sheetClaim.active);
  // Un panneau refermé rend le focus à son bouton, à la fin de son fondu.
  const onPanelExited = usePanelReturnFocus(store, showSettings, showEpisodes, args.sheetOpener, args.overlayVisible);

  const state = useMemo<PlayerFocusState>(() => {
    const island = skipIslandGuides({ refusable, overlayVisible: args.overlayVisible, islandFocused: pill.islandFocused });
    return { store, islandTrap: island.trap, islandExit: island.exits, activeSeasonIndex: args.activeSeasonIndex };
  }, [store, refusable, args.overlayVisible, pill.islandFocused, args.activeSeasonIndex]);

  return { binder, state, onPanelExited };
}
