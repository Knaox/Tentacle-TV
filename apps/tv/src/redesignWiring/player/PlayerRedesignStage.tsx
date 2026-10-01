import { StyleSheet, TouchableOpacity, View } from "react-native";
import { usePreventRemove } from "@react-navigation/native";
import { FocusBindingProvider } from "../../redesign/focus/focusBinding";
import { PlayerChromeView } from "../../redesign/screens/player/PlayerChromeView";
import { TVPlayerEngine } from "../../components/player/TVPlayerEngine";
import { BACKGROUND_FOCUS } from "../../components/player/focus/osdFocusBus";
import type { TransportKey } from "../../components/player/focus/useOverlayFocus";
import { useTvFocusClaim } from "../../hooks/useTvFocusClaim";
import { useFocusStore } from "../focus/focusStore";
import { PlayerFocusStateProvider } from "./playerFocusContainers";
import type { PlayerRedesignStageProps } from "./playerStageTypes";
import { usePlayerChrome } from "./usePlayerChrome";
import { usePlayerFocus } from "./usePlayerFocus";

const NO_TARGET: { readonly current: TransportKey | undefined } = { current: undefined };

/**
 * Le lecteur Apple TV avec l'habillage de la refonte : le MÊME moteur
 * (`TVPlayerEngine`), le même fond qui réveille l'habillage, la même
 * orchestration (l'écran la tient) — seul ce qui se pose sur la vidéo change
 * (`PlayerChromeView`), et le focus s'y pose par le port (`usePlayerFocus`).
 *
 * Deux écarts assumés avec l'habillage d'Android TV, tous deux propres à
 * tvOS :
 * - le panneau des pistes s'ouvre DANS l'habillage (comme celui des épisodes)
 *   au lieu d'une route modale : le Menu le referme par `usePreventRemove`,
 *   le même chemin que le panneau des épisodes depuis le patch tvOS de
 *   react-native-screens ;
 * - le fond ne réclame jamais le focus sous l'écran de chargement : c'est la
 *   sortie de celui-ci qui le tient.
 */
export function PlayerRedesignStage(props: PlayerRedesignStageProps) {
  const store = useFocusStore();
  const chrome = usePlayerChrome(props, store);
  const { controls } = props;

  // Le fond : focalisable seulement quand l'habillage est caché et que rien
  // ne le recouvre — OK ou une direction le rallume (`TVPlayerView`).
  const overlayShown = controls.overlayVisible || (props.paused && !controls.scrubbing);
  const panelOpen = props.showSettings || props.autoPlayActive || !!props.showEpisodes;
  const backgroundFocusable = !chrome.loading && !overlayShown && !panelOpen;
  // Un bouton de saut monté garde le focus, sinon c'est le fond qui le reprend.
  const skipActive = props.overlay.kind === "skip" || props.overlay.kind === "nextButton";
  useTvFocusClaim(props.backgroundRef as unknown as React.RefObject<unknown>, backgroundFocusable && !skipActive);

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
    tracksEntryKey: chrome.tracksEntryKey,
    activeSeasonIndex: chrome.activeSeasonIndex,
  });

  // Menu : le panneau des pistes se referme, la lecture continue.
  usePreventRemove(props.showSettings, () => props.onCloseSettings());

  return (
    <View style={styles.root}>
      {props.streamUrl ? <TVPlayerEngine {...props} streamUrl={props.streamUrl} /> : null}
      <TouchableOpacity
        ref={props.backgroundRef}
        {...BACKGROUND_FOCUS}
        activeOpacity={1}
        style={StyleSheet.absoluteFill}
        onPress={controls.showOverlay}
        hasTVPreferredFocus={backgroundFocusable}
        focusable={backgroundFocusable}
        accessible={backgroundFocusable}
        importantForAccessibility={panelOpen ? "no-hide-descendants" : "auto"}
      >
        <View style={styles.fill} />
      </TouchableOpacity>
      <FocusBindingProvider bind={focus.binder}>
        <PlayerFocusStateProvider value={focus.state}>
          <PlayerChromeView {...chrome.view} />
        </PlayerFocusStateProvider>
      </FocusBindingProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" },
  fill: { flex: 1 },
});
