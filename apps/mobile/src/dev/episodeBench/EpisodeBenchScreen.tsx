import { useCallback, useMemo, useRef, useState, type ComponentType } from "react";
import { Animated, StyleSheet, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { IndexBrowser } from "@/components/player/episodeBrowser/index/IndexBrowser";
import { OpenShelfBrowser } from "@/components/player/episodeBrowser/open/OpenShelfBrowser";
import { PanelBrowser } from "@/components/player/episodeBrowser/panel/PanelBrowser";
import { ShelfBrowser } from "@/components/player/episodeBrowser/shelf/ShelfBrowser";
import type { EpisodeBrowserProps } from "@/components/player/episodeBrowser/types";
import { toEpisodeEntry, toSeasonEntry, type EpisodeEntry } from "../../player/episodes/episodeBrowserModel";
import { videoRect, type EpisodeBrowserStyle } from "../../player/episodes/episodeBrowserLayout";
import { BENCH_SERIES, benchScenario, type BenchFrame } from "./benchSeries";
import { BenchPlayerChrome, type BenchChrome } from "./BenchPlayerChrome";

/** Le Jellyfin de banc (`lot1014-jf-10.11`) : ses images ne demandent aucun jeton. */
const DEFAULT_IMAGE_BASE = "http://127.0.0.1:18710";

const BROWSERS: Record<EpisodeBrowserStyle, { view: ComponentType<EpisodeBrowserProps>; chrome: BenchChrome }> = {
  shelf: { view: ShelfBrowser, chrome: "top" },
  open: { view: OpenShelfBrowser, chrome: "top" },
  panel: { view: PanelBrowser, chrome: "none" },
  index: { view: IndexBrowser, chrome: "none" },
};

const ORIENTATION = { landscape: "landscape", portrait: "portrait_up" } as const;

/**
 * Banc d'UI de la liste des épisodes du lecteur (développement seulement) :
 * le lecteur figé en pause sur une image, sa liste des épisodes ouverte dans
 * la mise en page voulue, sur une vraie série (`benchSeries`).
 *
 * `tentacle://dev/episodes?v=shelf|open|panel|index&frame=light|dark
 *   &orient=landscape|portrait&open=0&loading=1&img=<base des images>`
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

interface BenchParams {
  [key: string]: string | undefined;
  v?: string;
  frame?: string;
  orient?: string;
  open?: string;
  loading?: string;
  img?: string;
}

function BenchBody({ params }: { params: BenchParams }) {
  const style: EpisodeBrowserStyle = params.v === "open" || params.v === "panel" || params.v === "index" ? params.v : "shelf";
  const frame: BenchFrame = params.frame === "light" ? "light" : "dark";
  const base = params.img ?? DEFAULT_IMAGE_BASE;
  const scenario = useMemo(() => benchScenario(frame), [frame]);
  const { width, height } = useWindowDimensions();
  const video = videoRect(width, height);

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
      <Image source={{ uri: imageUri(entry.id, 640) }} recyclingKey={entry.id} contentFit="cover" style={StyleSheet.absoluteFill} transition={0} />
    )
  ), [scenario, imageUri]);

  // L'image remonte quand le panneau debout le demande (ressort, fil natif).
  const lift = useRef(new Animated.Value(0)).current;
  const onVideoLift = useCallback((amount: number) => {
    Animated.spring(lift, { toValue: -amount, useNativeDriver: true, damping: 28, stiffness: 240 }).start();
  }, [lift]);
  const play = useCallback((entry: EpisodeEntry) => { setCurrentId(entry.id); setOpen(false); }, []);
  const close = useCallback(() => setOpen(false), []);

  const browser = BROWSERS[style];
  const Browser = browser.view;
  const runtime = (current.RunTimeTicks ?? 0) / 10_000_000;
  const position = (current.UserData?.PlaybackPositionTicks ?? 0) / 10_000_000;
  const orientation = params.orient === "landscape" || params.orient === "portrait" ? ORIENTATION[params.orient] : "all";

  return (
    <View style={st.root}>
      <Stack.Screen options={{ headerShown: false, orientation, animation: "none", gestureEnabled: false }} />
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: lift }] }]}>
        <Image source={{ uri: imageUri(current.Id, 1920) }} contentFit="contain" style={StyleSheet.absoluteFill} transition={0} />
      </Animated.View>
      <BenchPlayerChrome
        mode={open ? browser.chrome : "full"}
        title={current.Name ?? ""}
        currentTime={position}
        duration={runtime}
        onEpisodes={() => setOpen(true)}
      />
      {open ? (
        <Browser
          seriesTitle={BENCH_SERIES.name}
          seasons={seasons}
          activeSeasonId={seasonId}
          onSelectSeason={setSeasonId}
          episodes={episodes}
          loading={params.loading === "1"}
          renderArtwork={renderArtwork}
          onPlay={play}
          onClose={close}
          video={video}
          onVideoLift={onVideoLift}
          backdropUri={imageUri(current.Id, 1280)}
        />
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
});
