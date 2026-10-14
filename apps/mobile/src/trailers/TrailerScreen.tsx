import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { useTranslation } from "react-i18next";
import { reportTrailerPlayback, useTentacleConfig } from "@tentacle-tv/api-client";
import {
  trailerFailureStep, trailerItemKey, trailerNeighborIndex, trailerPublicUrl, trailerSubtitleUrl, type TrailerStream,
} from "@tentacle-tv/shared";
import { backOrHome } from "@/utils/backOrHome";
import { FONT_FAMILY, PLAYER } from "@/theme";
import { MobileTrailerVideo } from "./MobileTrailerVideo";
import { resolveMobileTrailer } from "./resolveMobileTrailer";
import { TrailerChrome } from "./TrailerChrome";
import { parseTrailerRoute } from "./trailerRoute";
import { useTrailerQueue } from "./useTrailerQueue";
import { useTrailerSubtitle } from "./useTrailerSubtitle";

type Phase = { kind: "resolving" } | { kind: "ready"; stream: TrailerStream };

/**
 * L'écran des bandes-annonces du mobile (`/trailer`) — lues DANS l'app, sans
 * publicité : la file du catalogue (l'ordre du serveur), une vidéo après
 * l'autre. Dailymotion se lit en direct depuis le téléphone, YouTube par le
 * relais du serveur. Une vidéo qui ne se lit pas cède la place à la suivante ;
 * YouTube que le serveur ne peut pas extraire en ce moment (`embed`), ou en
 * bout de file, part dans l'app YouTube — le seul endroit où des publicités
 * peuvent paraître. À la fin d'une vidéo, la suivante ; sans suivante, on
 * ferme. L'écran reste allumé pendant la lecture.
 */
export function TrailerScreen() {
  useKeepAwake();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { t, i18n } = useTranslation("common");
  const { storage } = useTentacleConfig();
  const route = useMemo(() => parseTrailerRoute(params), [params]);
  // La langue de la fiche : la même clé de cache que son catalogue.
  const { status, queue, start, language } = useTrailerQueue(route, i18n.language);
  const serverUrl = (storage.getItem("tentacle_server_url") ?? "").replace(/\/$/, "");

  const [index, setIndex] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "resolving" });
  const openedAt = useRef(Date.now());
  const close = useCallback(() => backOrHome(router), [router]);

  // La liste arrivée : on part de la bande-annonce touchée.
  useEffect(() => {
    if (status === "ready" && index === null) setIndex(start);
  }, [status, start, index]);

  const current = index !== null ? queue[index] ?? null : null;
  // Une relecture du catalogue rend une liste neuve : seule l'IDENTITÉ de la vidéo relance sa résolution.
  const currentKey = current ? trailerItemKey(current.playback) : null;
  const currentRef = useRef(current);
  currentRef.current = current;

  /** Un échec : le geste du plan (la suivante, l'app YouTube, ou fermer), et le compte rendu au serveur. */
  const fail = useCallback((cause: "embed" | "failed", reason: string) => {
    if (!current || index === null) return;
    if (cause === "failed") reportTrailerPlayback(current.playback, { ok: false, ms: Date.now() - openedAt.current, reason });
    const step = trailerFailureStep(current.playback, { index, count: queue.length }, cause);
    if (step === "next") {
      setIndex(index + 1);
      return;
    }
    if (step === "embed") Linking.openURL(trailerPublicUrl(current.playback)).catch(() => undefined);
    close();
  }, [current, index, queue.length, close]);

  // Lu au moment voulu, jamais une raison de relancer la résolution.
  const failRef = useRef(fail);
  failRef.current = fail;

  // Chaque vidéo : son flux, résolu une fois.
  useEffect(() => {
    const playing = currentRef.current;
    if (!currentKey || !playing) return;
    let cancelled = false;
    openedAt.current = Date.now();
    setPhase({ kind: "resolving" });
    void resolveMobileTrailer(playing.playback, serverUrl).then((result) => {
      if (cancelled) return;
      if (result.status === "ready") setPhase({ kind: "ready", stream: result.stream });
      else if (result.status === "embed") failRef.current("embed", "lecteur officiel demandé par le serveur");
      else failRef.current("failed", `résolution : ${result.status}`);
    });
    return () => {
      cancelled = true;
    };
  }, [currentKey, serverUrl]);

  const stream = phase.kind === "ready" ? phase.stream : null;
  const subtitle = useTrailerSubtitle(stream, { language, version: current?.version });
  const subtitleUrl = stream && serverUrl ? trailerSubtitleUrl(stream, serverUrl, subtitle.lang) : null;

  const onStarted = useCallback(() => {
    if (current) reportTrailerPlayback(current.playback, { ok: true, ms: Date.now() - openedAt.current });
  }, [current]);
  const onFailed = useCallback((reason: string) => fail("failed", reason), [fail]);
  const onEnded = useCallback(() => {
    const next = index === null ? null : trailerNeighborIndex(index, queue.length, 1);
    if (next === null) close();
    else setIndex(next);
  }, [index, queue.length, close]);

  const previous = index === null ? null : trailerNeighborIndex(index, queue.length, -1);
  const next = index === null ? null : trailerNeighborIndex(index, queue.length, 1);

  // Rien à lire (liste vide, route illisible) : on le dit, l'écran se ferme d'un geste.
  if (status === "empty" || (status === "ready" && queue.length === 0)) {
    return (
      <View style={st.center}>
        <Text style={st.message}>{t("trailerFailed")}</Text>
        <Text accessibilityRole="button" onPress={close} style={st.action}>{t("close")}</Text>
      </View>
    );
  }

  return (
    <View style={st.root}>
      {stream ? (
        <MobileTrailerVideo
          uri={stream.url}
          type={stream.type}
          subtitleUrl={subtitleUrl}
          onStarted={onStarted}
          onFailed={onFailed}
          onEnded={onEnded}
        />
      ) : (
        <View style={st.center}>
          <ActivityIndicator size="large" color={PLAYER.text} accessibilityLabel={t("loading")} />
        </View>
      )}
      {current && index !== null && (
        <TrailerChrome
          item={current}
          index={index}
          count={queue.length}
          language={language}
          subtitles={subtitle.toggleTarget ? { on: subtitle.lang !== null, toggle: subtitle.toggle } : null}
          onClose={close}
          onPrevious={previous === null ? null : () => setIndex(previous)}
          onNext={next === null ? null : () => setIndex(next)}
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: PLAYER.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: PLAYER.bg, padding: 24 },
  message: { color: PLAYER.text, fontSize: 15, fontFamily: FONT_FAMILY.medium, textAlign: "center" },
  action: { color: PLAYER.accentLight, fontSize: 15, fontFamily: FONT_FAMILY.semibold, padding: 8 },
});
