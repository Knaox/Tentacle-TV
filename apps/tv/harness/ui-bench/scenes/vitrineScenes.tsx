import { useCallback, useMemo, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { i18n, type MediaItem } from "@tentacle-tv/shared";
import type { CardModel } from "../../../src/redesign/cards/cardTypes";
import { NEUTRAL_PALETTE, type ArtworkPalette } from "../../../src/redesign/color/artworkPalette";
import { DetailView, type DetailViewProps } from "../../../src/redesign/screens/detail/DetailView";
import { PlayerChromeView, type PlayerChromeViewProps } from "../../../src/redesign/screens/player/PlayerChromeView";
import { SearchView } from "../../../src/redesign/screens/search/SearchView";
import type { SearchContentModel } from "../../../src/redesign/screens/search/searchViewModel";
import type { BenchData } from "../data/benchData";
import { tracksOf } from "../data/playerPanelModels";
import { imageList, mediaOf, playerLabels, timelineOf, transportOf, videoFrameOf } from "../data/playerModels";
import { searchResponse } from "../data/searchResponses";
import { inputLabels, noticeOf, paletteOfResponse, sectionsOf, suggestionsOf } from "../data/searchModels";
import { navOf } from "../data/screenModels";
import { detailOf, imagesOf } from "./detailScenes";
import type { BenchScene } from "./types";

/**
 * La VITRINE : les écrans de la fiche App Store et du site, sur l'instantané
 * vitrine (contenu libre — films Blender, `harness/vitrine`) servi par le
 * relais (`BENCH_SNAPSHOT_DIR`). Les titres se trouvent par leur titre
 * ORIGINAL, le même dans les deux langues. Sur l'instantané du compte de
 * test, ces scènes disent seulement qu'il leur manque leurs titres.
 * Les autres écrans de la vitrine (accueil, Pour vous, bibliothèque,
 * Ma liste, grand panneau, navigation) sont les scènes ordinaires du banc.
 */

const HOLD = () => undefined;

function byOriginal(data: BenchData, title: string): MediaItem | undefined {
  return Object.values(data.snapshot.items).find((entry) => entry.item.OriginalTitle === title && entry.item.Type !== "Episode")?.item;
}

function Missing({ what }: { what: string }) {
  return <DetailView header={null} palette={NEUTRAL_PALETTE} error={{ title: `Vitrine : ${what} absent — instantané vitrine requis` }} />;
}

// ─── La fiche : un film, une série ──────────────────────────────────────────

type DetailBuild = (data: BenchData, seasonId?: string) => DetailViewProps | null;

const filmDetail = (title: string): DetailBuild => (data) => {
  const item = byOriginal(data, title);
  return item ? detailOf(data, item.Id) : null;
};

const seriesDetail = (title: string): DetailBuild => (data, seasonId) => {
  const series = byOriginal(data, title);
  return series ? detailOf(data, series.Id, { seasonId: seasonId ?? data.snapshot.seasons[series.Id]?.[0] }) : null;
};

function VitrineDetail({ data, build, what }: { data: BenchData; build: DetailBuild; what: string }) {
  const { i18n: live } = useTranslation();
  const [seasonId, setSeasonId] = useState<string | undefined>(undefined);
  const props = useMemo(() => build(data, seasonId), [build, data, seasonId, live.language]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!props) return <Missing what={what} />;
  return <DetailView {...props} onSelectSeason={setSeasonId} onLongPressEpisode={HOLD} />;
}

const detailScene = (id: string, label: string, title: string, build: DetailBuild, focusKeys: string[]): BenchScene => ({
  id: `vitrine/${id}`,
  group: "Vitrine",
  label,
  focusKeys,
  settleMs: 2000,
  images: (data) => {
    const props = build(data);
    return props ? imagesOf(props) : [];
  },
  render: (data) => <VitrineDetail data={data} build={build} what={title} />,
});

// ─── Le lecteur : l'habillage sur une image du film ─────────────────────────

interface Stage {
  frame?: string;
  props: PlayerChromeViewProps;
}

function playerStage(data: BenchData, title: string, fraction: number, withTracks: boolean): Stage | null {
  const item = byOriginal(data, title);
  if (!item) return null;
  // Les sous-titres dans la langue de la capture : ceux qu'on choisirait.
  const wanted = i18n.language?.startsWith("en") ? "eng" : "fre";
  const subtitle = item.MediaSources?.[0]?.MediaStreams?.find((stream) => stream.Type === "Subtitle" && stream.Language === wanted);
  return {
    frame: videoFrameOf(data, item),
    props: {
      media: mediaOf(data, item),
      labels: playerLabels(),
      phase: { kind: "playing" },
      timeline: timelineOf(item, fraction),
      transport: transportOf(data, item),
      paused: false,
      osdVisible: true,
      panel: withTracks ? { kind: "tracks", tracks: tracksOf(item, { subtitle: subtitle?.Index }) } : null,
    },
  };
}

function PlayerStage({ stage }: { stage: Stage | null }) {
  if (!stage) return <Missing what="film du lecteur" />;
  return (
    <View style={styles.stage}>
      {stage.frame ? <Image source={{ uri: stage.frame }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} /> : null}
      <PlayerChromeView {...stage.props} />
    </View>
  );
}

const playerScene = (id: string, label: string, title: string, fraction: number, withTracks: boolean, focusKeys: string[]): BenchScene => ({
  id: `vitrine/${id}`,
  group: "Vitrine",
  label,
  focusKeys,
  settleMs: withTracks ? 1600 : 1200,
  images: (data) => {
    const stage = playerStage(data, title, fraction, withTracks);
    return stage ? imageList(stage.frame, stage.props.media.backdropUri) : [];
  },
  render: (data) => <PlayerStage stage={playerStage(data, title, fraction, withTracks)} />,
});

// ─── La recherche : quelques lettres tapées, les résultats ──────────────────

function VitrineSearch({ data, query }: { data: BenchData; query: string }) {
  const { i18n: live } = useTranslation();
  const model = useMemo(() => {
    const response = searchResponse(data, query);
    const { completion, suggestions } = suggestionsOf(query, response);
    const sections = sectionsOf(data, response, []);
    const content: SearchContentModel = { kind: "results", notice: noticeOf(response), stale: false, sections };
    return { response, completion, suggestions, content, nav: navOf(data, "Search") };
  }, [data, query, live.language]); // eslint-disable-line react-hooks/exhaustive-deps
  const [focused, setFocused] = useState<ArtworkPalette | null>(null);
  const onFocusCard = useCallback((_section: string, card: CardModel) => card.palette && setFocused(card.palette), []);
  return (
    <SearchView
      nav={model.nav}
      query={query}
      completion={model.completion}
      suggestions={model.suggestions}
      content={model.content}
      labels={inputLabels()}
      dictation="system"
      listening={false}
      palette={focused ?? paletteOfResponse(data, model.response)}
      onFocusCard={onFocusCard}
    />
  );
}

const styles = StyleSheet.create({ stage: { flex: 1, backgroundColor: "#000" } });

export const VITRINE_SCENES: BenchScene[] = [
  detailScene("fiche-film", "Fiche d'un film (Sintel)", "Sintel", filmDetail("Sintel"), ["detail:primary", "detail:list", "similar:0"]),
  detailScene("fiche-reprise", "Fiche, reprise en cours (Sprite Fright)", "Sprite Fright", filmDetail("Sprite Fright"), ["detail:primary"]),
  detailScene("serie", "Série, saison et épisodes (Caminandes)", "Caminandes", seriesDetail("Caminandes"), ["episode:1", "detail:primary", "season:1"]),
  playerScene("lecteur", "Lecteur, habillage (Tears of Steel)", "Tears of Steel", 0.42, false, ["player:playpause", "player:tracks"]),
  playerScene("lecteur-pistes", "Lecteur, pistes et sous-titres (Tears of Steel)", "Tears of Steel", 0.42, true, ["tracks:close"]),
  {
    id: "vitrine/recherche",
    group: "Vitrine",
    label: "Recherche « spr »",
    focusKeys: ["top", "key:R", "movies:0"],
    settleMs: 1600,
    render: (data) => <VitrineSearch data={data} query="spr" />,
  },
];
