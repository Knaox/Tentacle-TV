import { useEffect, useRef } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { TEXT } from "@tentacle-tv/shared/theme";
import { patchBench, signalReady, type BenchState } from "../control/benchRemote";
import type { BenchData } from "../data/benchData";
import { SCENE_BY_ID } from "../scenes";
import { BenchFocus } from "./BenchFocus";

// react-native-tvos exporte `useTVEventHandler` sans le typer.
const { useTVEventHandler } = require("react-native") as {
  useTVEventHandler: (callback: (evt: { eventType: string; eventKeyAction?: number }) => void) => void;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

/**
 * L'écran d'une scène : la monte, précharge ses images, puis dit « prêt » au
 * relais pour la révision affichée — c'est ce signal qu'attend la capture.
 *
 * Lecture/Pause fige le focus sur l'élément suivant de la scène, puis rend la
 * main au focus natif après le dernier : de quoi voir chaque état focalisé
 * depuis le simulateur, sans ligne de commande.
 */
export function SceneHost({ state, data }: { state: BenchState; data: BenchData }) {
  const scene = state.scene ? SCENE_BY_ID.get(state.scene) : undefined;
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;
    const rev = state.rev;
    (async () => {
      const urls = scene?.images?.(data) ?? [];
      await Promise.all(urls.map((url) => Image.prefetch(url).catch(() => false)));
      await wait(scene?.settleMs ?? 900);
      await nextFrame();
      await nextFrame();
      if (!cancelled) signalReady(rev);
    })();
    return () => {
      cancelled = true;
    };
  }, [state.rev, scene, data]);

  useTVEventHandler((evt) => {
    if (evt.eventType !== "playPause" || evt.eventKeyAction === 0) return;
    const current = stateRef.current;
    const keys = (current.scene ? SCENE_BY_ID.get(current.scene)?.focusKeys : undefined) ?? [];
    if (!keys.length) return;
    const index = current.focus ? keys.indexOf(current.focus) : -1;
    patchBench({ focus: index + 1 < keys.length ? keys[index + 1] : null });
  });

  if (!scene) {
    return (
      <View style={styles.unknown}>
        <Text style={styles.unknownText}>Scène inconnue : {state.scene}</Text>
      </View>
    );
  }
  // La clé remonte la scène à chaque changement : un état propre, comme à
  // l'ouverture d'un écran.
  return (
    <View key={scene.id} style={styles.fill}>
      <BenchFocus sweep={state.sweep}>{scene.render(data)}</BenchFocus>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  unknown: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#07070c" },
  unknownText: { color: TEXT.secondary, fontSize: 32 },
});
