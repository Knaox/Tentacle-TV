import { StyleSheet, View } from "react-native";
import { playerBackgroundFocus } from "@tentacle-tv/tv-core";
import { FocusBindingProvider } from "../../redesign/focus/focusBinding";
import { PlayerChromeView } from "../../redesign/screens/player/PlayerChromeView";
import { TVPlayerEngine } from "../../components/player/TVPlayerEngine";
import type { TransportKey } from "../../components/player/focus/useOverlayFocus";
import { useTvFocusClaim } from "../../hooks/useTvFocusClaim";
import { PlayerBackground, PlayerFocusStateProvider } from "../../platform/tvos/player";
import { useFocusStore } from "../focus/focusStore";
import type { PlayerRedesignStageProps } from "./playerStageTypes";
import { usePlayerBackLayers, useOsdPin } from "./usePlayerBackLayers";
import { usePlayerChrome } from "./usePlayerChrome";
import { usePlayerFocus } from "./usePlayerFocus";

const NO_TARGET: { readonly current: TransportKey | undefined } = { current: undefined };

/**
 * Le lecteur Apple TV avec l'habillage de la refonte : le MÊME moteur
 * (`TVPlayerEngine`), le même fond qui réveille l'habillage, la même
 * orchestration (l'écran la tient) — seul ce qui se pose sur la vidéo change
 * (`PlayerChromeView`), et le focus s'y pose par le port (`usePlayerFocus`).
 *
 * Trois écarts assumés avec l'habillage d'Android TV, propres à tvOS :
 * - la feuille des pistes et des réglages s'ouvre DANS l'habillage (comme le
 *   panneau des épisodes) au lieu d'une route modale ;
 * - Retour suit la pile de couches (`usePlayerBackLayers`) : un menu se
 *   ferme, puis l'habillage se masque, puis la lecture se quitte ;
 * - le fond ne réclame jamais le focus sous l'écran de chargement : c'est la
 *   sortie de celui-ci qui le tient.
 */
export function PlayerRedesignStage(props: PlayerRedesignStageProps) {
  const store = useFocusStore();
  const { controls } = props;
  const pin = useOsdPin(props.paused, controls.overlayVisible);
  const chrome = usePlayerChrome(props, store, pin.pinned);
  usePlayerBackLayers(props, { shown: chrome.osdShown, unpin: pin.unpin });

  // Le fond : focalisable seulement quand l'habillage est caché et que rien
  // ne le recouvre — OK ou une direction le rallume (la règle : tv-core
  // `playerBackgroundFocus`). Un bouton de saut monté garde le focus, sinon
  // c'est le fond qui le reprend.
  const background = playerBackgroundFocus({
    loading: chrome.loading, overlayVisible: controls.overlayVisible, pinned: pin.pinned, scrubbing: controls.scrubbing,
    showSettings: props.showSettings, showEpisodes: !!props.showEpisodes, autoPlayActive: props.autoPlayActive,
    troubleCovers: chrome.troubleCovers, overlayKind: props.overlay.kind,
  });
  useTvFocusClaim(props.backgroundRef as unknown as React.RefObject<unknown>, background.claims);

  const focus = usePlayerFocus({
    store,
    osdFocusSignal: props.osdFocusSignal ?? 0,
    osdFocusTargetRef: props.osdFocusTargetRef ?? NO_TARGET,
    scrubbing: controls.scrubbing,
    overlay: props.overlay,
    pillShown: chrome.pillShown,
    overlayVisible: controls.overlayVisible,
    showSettings: props.showSettings,
    showEpisodes: !!props.showEpisodes,
    loading: chrome.loading,
    failed: props.failed,
    upNextShown: chrome.upNextShown,
    endShown: chrome.endShown,
    troubleActive: chrome.troubleCovers,
    sheetEntryKey: chrome.sheetEntryKey,
    sheetOpener: chrome.sheetOpener,
    activeSeasonIndex: chrome.activeSeasonIndex,
  });

  return (
    <View style={styles.root}>
      {props.streamUrl ? <TVPlayerEngine {...props} streamUrl={props.streamUrl} /> : null}
      <PlayerBackground
        backgroundRef={props.backgroundRef}
        holdsFocus={background.focusable}
        covered={background.panelOpen}
        onPress={controls.showOverlay}
      />
      <FocusBindingProvider bind={focus.binder}>
        <PlayerFocusStateProvider value={focus.state}>
          <PlayerChromeView {...chrome.view} onPanelExited={focus.onPanelExited} />
        </PlayerFocusStateProvider>
      </FocusBindingProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
});
