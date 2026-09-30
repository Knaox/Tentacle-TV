import { Image, StyleSheet, View } from "react-native";
import type { MediaItem } from "@tentacle-tv/shared";
import { PlayerChromeView, type PlayerChromeViewProps } from "../../../src/redesign/screens/player/PlayerChromeView";
import { seekFlashLabel, skipPillLabel } from "../../../src/redesign/screens/player/playerLabels";
import type { BenchData } from "../data/benchData";
import {
  byName, endScreenOf, episodeAt, imageList, mediaOf, neighbours, playerLabels, subtitleCue, t, timelineOf, transportOf,
  upNextOf, videoFrameOf,
} from "../data/playerModels";
import { episodesPanelOf, tracksOf } from "../data/playerPanelModels";
import type { BenchScene } from "./types";

/**
 * L'habillage du lecteur, état par état, sur les vraies données du compte :
 * « Interstellar » (film 4K HDR), « The Dark Knight » (pistes), One Piece
 * S1 · E3 (épisode, voisins, saisons), Bleach (15 saisons). La « vidéo » est
 * une image fixe sous l'habillage ; le moteur n'est jamais chargé.
 */

interface Stage {
  frame?: string;
  props: PlayerChromeViewProps;
}
type Build = (data: BenchData) => Stage | null;
type Patch = (data: BenchData, stage: Stage) => Partial<PlayerChromeViewProps> & { frame?: string };

function base(data: BenchData, item: MediaItem | undefined, fraction: number): Stage | null {
  if (!item) return null;
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
    },
  };
}

const film: Build = (data) => base(data, byName(data, "Interstellar"), 0.42);
const darkKnight: Build = (data) => base(data, byName(data, "The Dark Knight : Le Chevalier noir"), 0.18);
const hailMary: Build = (data) => base(data, byName(data, "Projet Dernière Chance"), 0.3);
const onePieceE3 = (data: BenchData) => episodeAt(data, "One Piece", 1, 2);
const episode: Build = (data) => base(data, onePieceE3(data), 0.3);
const next = (data: BenchData) => {
  const current = onePieceE3(data);
  return current ? neighbours(data, current).next : undefined;
};

const patch = (build: Build, change: Patch): Build => (data) => {
  const stage = build(data);
  if (!stage) return null;
  const { frame, ...props } = change(data, stage);
  return { frame: frame ?? stage.frame, props: { ...stage.props, ...props } };
};

const skip = (labelKey: Parameters<typeof skipPillLabel>[1], kind: "segment" | "end" | "next", countdown: number | null, osd = false): Patch => () => ({
  osdVisible: osd,
  skip: {
    kind,
    label: skipPillLabel(t, labelKey, countdown),
    countdown: countdown !== null ? { remaining: countdown, total: 10 } : null,
    refusable: countdown !== null,
  },
});

function PlayerStage({ stage }: { stage: Stage | null }) {
  return (
    <View style={styles.stage}>
      {stage?.frame ? <Image source={{ uri: stage.frame }} style={StyleSheet.absoluteFill} resizeMode="cover" fadeDuration={0} /> : null}
      {stage ? <PlayerChromeView {...stage.props} /> : null}
    </View>
  );
}

function imagesOf(stage: Stage | null): string[] {
  if (!stage) return [];
  const { media, upNext, endScreen, panel, scrub, reloadFrame } = stage.props;
  return imageList(
    stage.frame, media.logoUri, media.backdropUri, upNext?.imageUri, endScreen?.imageUri, endScreen?.backdropUri,
    endScreen?.logoUri, scrub?.frame?.uri, reloadFrame?.uri,
    ...(panel?.kind === "episodes" ? panel.episodes.episodes.slice(0, 6).map((row) => row.imageUri) : []),
  );
}

const scene = (id: string, label: string, build: Build, focusKeys?: string[], settleMs = 1100): BenchScene => ({
  id: `lecteur/${id}`,
  group: "Lecteur",
  label,
  focusKeys,
  settleMs,
  images: (data) => imagesOf(build(data)),
  render: (data) => <PlayerStage stage={build(data)} />,
});

const TRANSPORT = ["player:playpause", "player:back", "player:seekback", "player:seekforward", "player:scrub", "player:tracks"];

export const PLAYER_SCENES: BenchScene[] = [
  scene("resolution", "Ouverture · étape PrismCore", patch(film, () => ({
    phase: { kind: "resolving", step: { label: t("player:prismIndexing"), index: 2, count: 4 } },
  })), ["loading:back"]),
  scene("resolution-episode", "Ouverture · épisode", patch(episode, () => ({
    phase: { kind: "resolving", step: { label: t("player:prismOpening"), index: 0, count: 4 } },
  })), ["loading:back"]),
  scene("demarrage", "Démarrage", patch(film, () => ({ phase: { kind: "starting" } })), ["loading:back"]),
  scene("echec", "Échec de l'ouverture", patch(episode, () => ({
    phase: { kind: "failed", message: t("player:loadFailed") },
  })), ["loading:retry", "loading:back"]),
  scene("osd-film", "Habillage · film", film, TRANSPORT),
  scene("osd-episode", "Habillage · épisode", episode, ["player:playpause", "player:prev", "player:next", "player:episodes", "player:tracks"]),
  scene("pause", "En pause", patch(film, () => ({ paused: true })), ["player:playpause", "player:seekforward"]),
  scene("tampon", "Mémoire tampon", patch(episode, () => ({ osdVisible: false, buffering: true }))),
  scene("sous-titres", "Sous-titres, habillage caché", patch(film, () => ({ osdVisible: false, subtitle: subtitleCue() }))),
  scene("sous-titres-osd", "Sous-titres relevés", patch(film, () => ({ subtitle: subtitleCue() })), ["player:playpause"]),
  scene("defilement", "Défilement ×4", patch(film, (_data, stage) => ({
    scrub: { target: stage.props.timeline.position + 750, speed: { factor: 4, backward: false }, frame: stage.frame ? { uri: stage.frame } : null },
  }))),
  scene("defilement-recul", "Défilement arrière ×2", patch(episode, (_data, stage) => ({
    scrub: { target: stage.props.timeline.position - 95, speed: { factor: 2, backward: true }, frame: stage.frame ? { uri: stage.frame } : null },
  }))),
  scene("saut-avant", "Saut +30 s (habillage caché)", patch(film, () => ({ osdVisible: false, seekFlash: { forward: true, label: seekFlashLabel(t, 30) } }))),
  scene("saut-arriere", "Saut −20 s cumulé", patch(film, () => ({ osdVisible: false, seekFlash: { forward: false, label: seekFlashLabel(t, -20) } }))),
  scene("intro-manuelle", "Passer l'intro · manuel", patch(episode, skip("skipIntro", "segment", null)), ["player:skip"]),
  scene("intro-auto", "Passer l'intro · auto, décompte", patch(episode, skip("skipIntro", "segment", 5)), ["player:skip-dismiss", "player:skip"]),
  scene("intro-sourdine", "Passer l'intro · en sourdine (habillage)", patch(episode, skip("skipIntro", "segment", null, true)), ["player:playpause", "player:skip"]),
  scene("resume", "Passer le résumé", patch(episode, skip("skipRecap", "segment", null)), ["player:skip"]),
  scene("apercu", "Passer l'aperçu · auto", patch(episode, skip("skipPreview", "segment", 3)), ["player:skip-dismiss"]),
  scene("post-generique", "Scène post-générique · auto", patch(film, skip("skipToPostCredits", "segment", 8)), ["player:skip"]),
  scene("fin-film", "Terminer la lecture (film)", patch(film, skip("endPlayback", "end", null)), ["player:skip"]),
  scene("suite-pilule", "Aller à l'épisode suivant (pilule)", patch(episode, skip("goToNextEpisode", "next", null)), ["player:skip"]),
  scene("a-suivre", "À suivre · générique, décompte", patch(episode, (data) => {
    const upcoming = next(data);
    return { osdVisible: false, upNext: upcoming ? upNextOf(data, upcoming, 8) : null };
  }), ["upnext:play", "upnext:dismiss"]),
  scene("a-suivre-proposition", "À suivre · sans lecture auto", patch(episode, (data) => {
    const upcoming = next(data);
    return { osdVisible: false, upNext: upcoming ? upNextOf(data, upcoming, null) : null };
  }), ["upnext:play"]),
  scene("fin", "Fin d'épisode · décompte", patch(episode, (data) => {
    const upcoming = next(data);
    return { endScreen: upcoming ? endScreenOf(data, upcoming, 7) : null };
  }), ["end:play", "end:leave"]),
  scene("fin-proposition", "Fin d'épisode · sans lecture auto", patch(episode, (data) => {
    const upcoming = next(data);
    return { endScreen: upcoming ? endScreenOf(data, upcoming, null) : null };
  }), ["end:play"]),
  scene("episodes", "Panneau des épisodes", patch(episode, (data) => {
    const current = onePieceE3(data);
    const series = byName(data, "One Piece");
    return { panel: series && current ? { kind: "episodes", episodes: episodesPanelOf(data, series, 1, { currentId: current.Id }) } : null };
  }), ["episodes:episode:2", "episodes:episode:3", "episodes:season:1", "episodes:close"], 1600),
  scene("episodes-saison-vue", "Épisodes · saison vue (état forcé)", patch(episode, (data) => {
    const series = byName(data, "One Piece");
    return { panel: series ? { kind: "episodes", episodes: episodesPanelOf(data, series, 1, { forceWatchedSeason: true }) } : null };
  }), ["episodes:episode:0"], 1600),
  scene("episodes-bleach", "Épisodes · 15 saisons (Bleach S14)", patch(episode, (data) => {
    const series = byName(data, "Bleach");
    return { panel: series ? { kind: "episodes", episodes: episodesPanelOf(data, series, 13) } : null };
  }), ["episodes:season:13", "episodes:episode:0"], 1600),
  scene("episodes-chargement", "Épisodes · chargement", patch(episode, (data) => {
    const series = byName(data, "One Piece");
    return { panel: series ? { kind: "episodes", episodes: { ...episodesPanelOf(data, series, 1), loading: true } } : null };
  }), ["episodes:close"]),
  scene("pistes", "Pistes · audio, sous-titres, qualité", patch(darkKnight, (data) => {
    const item = byName(data, "The Dark Knight : Le Chevalier noir");
    return { panel: item ? { kind: "tracks", tracks: tracksOf(item, { subtitle: 4 }) } : null };
  }), ["tracks:audio:2", "tracks:subtitle:5", "tracks:quality:original", "tracks:close"], 1400),
  scene("pistes-auto", "Pistes · qualité réduite (Auto)", patch(hailMary, (data) => {
    const item = byName(data, "Projet Dernière Chance");
    return { panel: item ? { kind: "tracks", tracks: tracksOf(item, { quality: "quality1080p", auto: true }) } : null };
  }), ["tracks:quality:quality1080p"], 1400),
  scene("rechargement", "Rechargement doux (image figée)", patch(film, (_data, stage) => ({
    osdVisible: false,
    reloadFrame: stage.frame ? { uri: stage.frame } : null,
  }))),
  scene("qualite-reduite", "Badge « qualité réduite »", patch(film, () => ({
    osdVisible: false,
    notice: t("player:qualityReducedDetail", { measured: "6.2", source: "13" }),
  }))),
  scene("erreur", "Bandeau d'erreur", patch(episode, () => ({
    osdVisible: false,
    error: { title: t("player:playbackError"), message: t("player:streamStartFailed") },
  }))),
];

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: "#000" },
});
