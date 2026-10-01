import { useEffect, useRef } from "react";
import { cachedBitrate, useJellyfinClient } from "@tentacle-tv/api-client";
import { decideStartupWait, type Health } from "@tentacle-tv/tv-core";
import { publishPlaybackTrouble, readPlaybackTrouble, type StartWait } from "./playbackTroubleStore";
import type { RecoverySources } from "./recoverySources";
import { loadGrew, readPlayerLoad, type PlayerLoad } from "../utils/playerLoadProbe";
import { probeStreamPath } from "../utils/streamPathProbe";
import { plog } from "../utils/playerDiag";

const TICK_MS = 1000;

interface OpeningState {
  emittedAt: number;
  lastProgressAt: number | null;
  loaded: boolean;
  buffered: number;
  /** Ce qu'AVPlayer avait chargé à la lecture d'avant (`playerLoadProbe`). */
  load: PlayerLoad | null;
  source: Health;
  checkedAt: number | null;
  probing: boolean;
  gaveUp: boolean;
}

function publishStartWait(next: StartWait | null): void {
  const current = readPlaybackTrouble();
  if (current.startWait?.kind === next?.kind) return;
  publishPlaybackTrouble({ ...current, startWait: next });
}

/**
 * L'OUVERTURE d'un transcodage qui se fait attendre — avant la première
 * image : la règle `decideStartupWait` (tv-core), exécutée. Un serveur peu
 * puissant livre ses premiers segments lentement : l'écran d'ouverture le dit
 * (`startWait`, une ligne discrète) au lieu de tourner sans un mot, et ne
 * conclut à l'échec que deux minutes sans rien — ou le chemin du flux vu à
 * terre, que la reprise d'ouverture (`useStartupRecovery`) prend alors en
 * charge (qui manque, relance à son retour). L'échec par l'attente se dit
 * (`gaveUp`), « Réessayer » relance le flux.
 *
 * Commune aux deux téléviseurs, sans `Platform.OS` ; montée par la reprise
 * (`usePlaybackRecovery`).
 */
export function useStartupWait(sources: RecoverySources | undefined): void {
  const client = useJellyfinClient();
  const src = useRef(sources);
  src.current = sources;
  const streamUrl = sources?.p.streamUrl ?? null;
  const opening = !!sources && !!streamUrl && !sources.s.hasStarted;

  useEffect(() => {
    if (!opening) return undefined;
    const st: OpeningState = {
      emittedAt: Date.now(), lastProgressAt: null, loaded: false, buffered: src.current?.s.bufferedTimeRef.current ?? 0, load: null,
      source: "unknown", checkedAt: null, probing: false, gaveUp: false,
    };
    let alive = true;
    const probe = async () => {
      st.probing = true;
      const result = await probeStreamPath(client);
      if (!alive) return;
      st.probing = false;
      st.checkedAt = Date.now();
      st.source = result.ok ? "ok" : "down";
    };
    const tick = () => {
      const s = src.current;
      if (!s || st.gaveUp) return;
      const now = Date.now();
      // Les signes de vie de l'ouverture : le lecteur prêt (`onLoad`), la mémoire
      // qui grossit — et, avant la première image, les données qui arrivent chez
      // AVPlayer (tvOS), seul signe d'un serveur qui transcode lentement.
      void readPlayerLoad().then((load) => {
        if (alive && loadGrew(st.load, load)) st.lastProgressAt = Date.now();
        st.load = load;
      });
      const loaded = !s.s.isLoading;
      const buffered = s.s.bufferedTimeRef.current;
      if ((loaded && !st.loaded) || buffered > st.buffered + 0.5) st.lastProgressAt = now;
      st.loaded = loaded;
      st.buffered = Math.max(st.buffered, buffered);
      const decision = decideStartupWait({
        now,
        transcoding: !s.p.isDirectPlay && !s.p.isPrismCore,
        emittedAt: st.emittedAt,
        lastProgressAt: st.lastProgressAt,
        failed: s.p.failed || s.s.openFailed,
        source: st.source,
        sourceCheckedAt: st.checkedAt,
        probing: st.probing,
        measuredBps: cachedBitrate(),
        neededBps: s.p.streamBitrate,
      });
      if (decision.fail) {
        st.gaveUp = true;
        const down = st.source === "down";
        plog("recover", `ouverture du transcodage ${down ? "sans chemin du flux" : "sans progression depuis 2 min"} → échec`);
        // Chemin à terre : la reprise d'ouverture dit qui manque ; sinon, l'attente vaine se dit.
        publishStartWait(down ? null : { kind: "gaveUp" });
        s.s.setOpenFailed(true);
        return;
      }
      publishStartWait(decision.hint);
      if (decision.probe) void probe();
    };
    const timer = setInterval(tick, TICK_MS);
    return () => {
      alive = false;
      clearInterval(timer);
      publishStartWait(null);
    };
  }, [opening, streamUrl, client]);
}
