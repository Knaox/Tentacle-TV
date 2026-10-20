import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { EpisodeBrowser } from "@/components/player/episodeBrowser/EpisodeBrowser";
import { toEpisodeEntry, toSeasonEntry, type EpisodeEntry } from "../../player/episodes/episodeBrowserModel";
import { videoRect } from "../../player/episodes/episodeBrowserLayout";
import { BENCH_SERIES, benchScenario, type BenchFrame } from "./benchSeries";
import { BenchPlayerChrome } from "./BenchPlayerChrome";

/** Le Jellyfin de banc (`lot1014-jf-10.11`) : ses images ne demandent aucun jeton. */
const DEFAULT_IMAGE_BASE = "http://127.0.0.1:18710";

const ORIENTATION = { landscape: "landscape", portrait: "portrait_up" } as const;

interface BenchParams {
  [key: string]: string | undefined;
  frame?: string;
  orient?: string;
  open?: string;
  loading?: string;
  img?: string;
}

/**
 * Banc d'UI de la liste des épisodes du lecteur (développement seulement) :
 * le lecteur figé en pause sur une image, sa liste des épisodes ouverte — la
 * carte qui s'ouvre —, sur une vraie série (`benchSeries`). On y navigue par
 * l'inspecteur Hermes (`router.replace`), jamais par `simctl openurl`, dont
 * l'alerte « Ouvrir dans… » ne se ferme pas.
 *
 * `/dev/episodes?frame=light|dark&orient=landscape|portrait&open=0&loading=1&img=<base des images>`
 */
export function EpisodeBenchScreen() {
  const params = useLocalSearchParams() as BenchParams;
  // Comme la route du lecteur : un fournisseur des marges sûres à la racine,
  // mesurées dans la vraie orientation de l'écran (sinon, celles du portrait).
  // Un lien qui change les paramètres repart d'un banc neuf (état, saison, image).
  return (
    <SafeAreaProvider style={st.root}>
      <BenchBody key={JSON.stringify(params)} params={params} />
    </SafeAreaProvider>
  );
}

function BenchBody({ params }: { params: BenchParams }) {
  const frame: BenchFrame = params.frame === "light" ? "light" : "dark";
  const base = params.img ?? DEFAULT_IMAGE_BASE;
  const scenario = useMemo(() => benchScenario(frame), [frame]);
  const { width, height } = useWindowDimensions();

  const [open, setOpen] = useState(params.open !== "0");
  const [currentId, setCurrentId] = useState(scenario.current.Id);
  const [seasonId, setSeasonId] = useState(scenario.current.SeasonId ?? scenario.seasons[0].Id);
  const playingSeasonId = useMemo(
    () => Object.keys(scenario.episodesBySeason).find((id) => scenario.episodesBySeason[id].some((ep) => ep.Id === currentId)),
    [scenario, currentId],
  );
  const current = (playingSeasonId ? scenario.episodesBySeason[playingSeasonId] : []).find((ep) => ep.Id === currentId) ?? scenario.current;

  const seasons = useMemo(() => scenario.seasons.map((season) => toSeasonEntry(season, playingSeasonId)), [scenario, playingSeasonId]);
  const episodes = useMemo(
    () => (scenario.episodesBySeason[seasonId] ?? []).map((ep) => toEpisodeEntry(ep, currentId)),
    [scenario, seasonId, currentId],
  );

  const imageUri = useCallback((id: string, maxWidth: number) => `${base}/Items/${id}/Images/Backdrop?maxWidth=${maxWidth}&quality=85`, [base]);
  const renderArtwork = useCallback((entry: EpisodeEntry) => (
    scenario.missingImages.has(entry.id) ? null : (
      <Image source={{ uri: imageUri(entry.id, 720) }} recyclingKey={entry.id} contentFit="cover" style={StyleSheet.absoluteFill} transition={0} />
    )
  ), [scenario, imageUri]);
  const play = useCallback((entry: EpisodeEntry) => { setCurrentId(entry.id); setOpen(false); }, []);
  const close = useCallback(() => setOpen(false), []);

  const runtime = (current.RunTimeTicks ?? 0) / 10_000_000;
  const position = (current.UserData?.PlaybackPositionTicks ?? 0) / 10_000_000;
  const orientation = params.orient === "landscape" || params.orient === "portrait" ? ORIENTATION[params.orient] : "all";

  return (
    <View style={st.root}>
      <Stack.Screen options={{ headerShown: false, orientation, animation: "none", gestureEnabled: false }} />
      <Image source={{ uri: imageUri(current.Id, 1920) }} contentFit="contain" style={StyleSheet.absoluteFill} transition={0} />
      <BenchPlayerChrome
        mode={open ? "top" : "full"}
        title={current.Name ?? ""}
        currentTime={position}
        duration={runtime}
        onEpisodes={() => setOpen(true)}
      />
      {open ? (
        <EpisodeBrowser
          seriesTitle={BENCH_SERIES.name}
          seasons={seasons}
          activeSeasonId={seasonId}
          onSelectSeason={setSeasonId}
          episodes={episodes}
          loading={params.loading === "1"}
          renderArtwork={renderArtwork}
          onPlay={play}
          onClose={close}
          video={videoRect(width, height)}
        />
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
});
