import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { preferredFocusOf, STILL_WATCHING_TV_KEYS, stillWatchingFocusEntry } from "@tentacle-tv/tv-core";
import { FocusBindingProvider, type FocusBinder } from "../../../src/redesign/focus/focusBinding";
import { PlayerChromeView } from "../../../src/redesign/screens/player/PlayerChromeView";
import { useFocusStore } from "../../../src/platform/tvos/focus/focusStore";
import { PLAYER_GROUP_CONTAINERS, PlayerFocusStateProvider, type PlayerFocusState } from "../../../src/platform/tvos/player";
import { buildStillWatching } from "../../../src/redesignWiring/player/playerChromeModels";
import type { BenchData } from "../data/benchData";
import { t } from "../data/playerModels";
import { film, patch, scene } from "./playerScenes";
import type { BenchScene } from "./types";

/**
 * « Vous regardez encore ? » au lecteur TV, sans lecture ni compte : la
 * question et la pause figées (planches), puis une scène CÂBLÉE et VIVANTE —
 * un vrai décompte de 20 s, le focus natif réclamé comme dans le lecteur
 * (`usePlayerFocus` : « Continuer », puis « Reprendre »), la barre armée une
 * fois sur le temps qui reste. « Continuer » et « Reprendre » relancent le
 * décompte ; « Mettre en pause » passe en pause tout de suite.
 */

const COUNTDOWN_MS = 60_000;
const LIVE_COUNTDOWN_MS = 20_000;
const KEYS: ReadonlySet<string> = new Set(Object.values(STILL_WATCHING_TV_KEYS));

const asking = (remainingMs: number) => patch(film, () => ({
  osdVisible: false,
  stillWatching: buildStillWatching({ phase: "asking", remainingMs, countdownMs: COUNTDOWN_MS }, t),
}));
const pausedStage = patch(film, () => ({
  osdVisible: false,
  paused: true,
  stillWatching: buildStillWatching({ phase: "paused", remainingMs: 0, countdownMs: COUNTDOWN_MS }, t),
}));

function LiveStillWatching({ data }: { data: BenchData }) {
  const store = useFocusStore();
  const [deadline, setDeadline] = useState(() => Date.now() + LIVE_COUNTDOWN_MS);
  const [pausedNow, setPausedNow] = useState(false);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const remainingMs = Math.max(0, deadline - now);
  const phase = pausedNow || remainingMs === 0 ? "paused" : "asking";

  // L'entrée réclamée à chaque phase, comme `useClaimOnRise` du lecteur.
  const entry = stillWatchingFocusEntry(phase);
  useEffect(() => (entry ? store.claim(entry) : undefined), [store, entry]);
  const state = useMemo<PlayerFocusState>(() => ({ store, islandTrap: false, islandExit: false, activeSeasonIndex: 0 }), [store]);
  const bind = useCallback<FocusBinder>((key) => {
    const container = PLAYER_GROUP_CONTAINERS[key];
    if (container) return { container };
    const binding = store.binder(key);
    if (!KEYS.has(key)) return binding;
    const preferred = preferredFocusOf(key, { grabs: false, refusable: false, failed: false, sheetEntryKey: null });
    return { ...binding, phantomPressGuard: true, ...(preferred ? { native: { hasTVPreferredFocus: true } } : null) };
  }, [store]);

  const restart = useCallback(() => {
    setPausedNow(false);
    setDeadline(Date.now() + LIVE_COUNTDOWN_MS);
  }, []);
  const stage = useMemo(() => film(data), [data]);
  const model = useMemo(
    () => buildStillWatching({ phase, remainingMs, countdownMs: LIVE_COUNTDOWN_MS }, t),
    [phase, remainingMs],
  );
  if (!stage) return <View style={styles.stage} />;
  return (
    <FocusBindingProvider bind={bind}>
      <PlayerFocusStateProvider value={state}>
        <View style={styles.stage}>
          <PlayerChromeView
            {...stage.props}
            osdVisible={false}
            paused={phase === "paused"}
            stillWatching={model}
            onStillWatchingContinue={restart}
            onStillWatchingPause={() => setPausedNow(true)}
            onStillWatchingResume={restart}
          />
        </View>
      </PlayerFocusStateProvider>
    </FocusBindingProvider>
  );
}

export const STILL_WATCHING_SCENES: BenchScene[] = [
  scene("regardez-encore", "Vous regardez encore ? · la question, 42 s", asking(42_000), [
    STILL_WATCHING_TV_KEYS.continue, STILL_WATCHING_TV_KEYS.pause,
  ]),
  scene("regardez-encore-pause", "Vous regardez encore ? · lecture en pause", pausedStage, [STILL_WATCHING_TV_KEYS.resume]),
  {
    id: "retour/regardez-encore-cablee",
    group: "Retour",
    label: "Câblée (focus natif) — Vous regardez encore ? : décompte vivant de 20 s, « Continuer » puis « Reprendre »",
    settleMs: 1400,
    render: (data) => <LiveStillWatching data={data} />,
  },
];

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: "#000" },
});
