import { Image, StyleSheet, View } from "react-native";
import type { MediaItem } from "@tentacle-tv/shared";
import { RESUME_COUNTDOWN_MS, SKIP_BACK_SECONDS, SKIP_FORWARD_SECONDS } from "@tentacle-tv/tv-core";
import { PlayerChromeView, type PlayerChromeViewProps } from "../../../src/redesign/screens/player/PlayerChromeView";
import { scrubCountdownLabel, seekFlashLabel, skipPillLabel } from "../../../src/redesign/screens/player/playerLabels";
import type { BenchData } from "../data/benchData";
import {
  byName, endScreenOf, episodeAt, imageList, mediaOf, neighbours, playerLabels, subtitleCue, t, timelineOf, transportOf,
  upNextOf, videoFrameOf,
} from "../data/playerModels";
import { episodesPanelOf, tracksOf } from "../data/playerPanelModels";
import { noticeOf, panelOf, RESUMED_NOTICE } from "../../../src/redesignWiring/player/playbackTroubleModel";
import type { BenchScene } from "./types";

/**
 * L'habillage du lecteur, état par état, sur les vraies données du compte :
 * « Interstellar » (film 4K HDR), « The Dark Knight » (pistes), One Piece
 * S1 · E3 (épisode, voisins, saisons), Bleach (15 saisons). La « vidéo » est
 * une image fixe sous l'habillage ; le moteur n'est jamais chargé.
 */

export interface Stage {
  frame?: string;
  props: PlayerChromeViewProps;
}
export type Build = (data: BenchData) => Stage | null;
export type Patch = (data: BenchData, stage: Stage) => Partial<PlayerChromeViewProps> & { frame?: string };

export function base(data: BenchData, item: MediaItem | undefined, fraction: number): Stage | null {
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

export const film: Build = (data) => base(data, byName(data, "Interstellar"), 0.42);
const darkKnight: Build = (data) => base(data, byName(data, "The Dark Knight : Le Chevalier noir"), 0.18);
export const hailMary: Build = (data) => base(data, byName(data, "Projet Dernière Chance"), 0.3);
const onePieceE3 = (data: BenchData) => episodeAt(data, "One Piece", 1, 2);
export const episode: Build = (data) => base(data, onePieceE3(data), 0.3);
const next = (data: BenchData) => {
  const current = onePieceE3(data);
  return current ? neighbours(data, current).next : undefined;
};

export const patch = (build: Build, change: Patch): Build => (data) => {
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

/** Un défilement de `offset` secondes depuis la position, et son décompte —
 *  `remaining` secondes sur le décompte entier ; `null` : aucun (en pause). */
export const aimedWith = (
  remaining: number | null, offset: number, paused = false, withFrame = true,
): Patch => (_data, stage) => ({
  paused,
  scrub: {
    target: stage.props.timeline.position + offset,
    frame: withFrame && stage.frame ? { uri: stage.frame } : null,
    countdown: remaining === null ? null : {
      label: scrubCountdownLabel(t, remaining),
      countdown: { remaining, total: RESUME_COUNTDOWN_MS / 1000 },
    },
  },
});

/**
 * Des passages posés À LA MAIN — l'instantané n'a pas les segments du serveur :
 * résumé et intro en ouverture, générique en fin, en fractions de la durée.
 */
const PASSAGES: Array<[number, number]> = [[0, 0.03], [0.03, 0.075], [0.92, 0.985]];
const passages: Patch = (_data, stage) => {
  const { duration } = stage.props.timeline;
  return {
    timeline: {
      ...stage.props.timeline,
      segments: PASSAGES.map(([from, to]) => ({ start: from * duration, end: to * duration })),
    },
  };
};

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

export const scene = (id: string, label: string, build: Build, focusKeys?: string[], settleMs = 1100): BenchScene => ({
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
  scene("osd-passages", "Habillage · passages marqués (posés à la main)", patch(episode, passages), ["player:playpause"]),
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
  scene("defilement-passages", "Défilement · passages marqués (posés à la main)", patch(patch(episode, passages), (_data, stage) => ({
    scrub: { target: stage.props.timeline.duration * 0.06, speed: { factor: 2, backward: true }, frame: stage.frame ? { uri: stage.frame } : null },
  }))),
  scene("defilement-glisser", "Défilement · glisser du pavé (sans vitesse)", patch(film, (_data, stage) => ({
    scrub: { target: stage.props.timeline.position + 212, frame: stage.frame ? { uri: stage.frame } : null },
  }))),
  scene("defilement-sans-vignette", "Défilement · serveur sans vignettes", patch(film, (_data, stage) => ({
    scrub: { target: stage.props.timeline.position + 1800, speed: { factor: 8, backward: false }, frame: null },
  }))),
  // La bulle reste dans la zone sûre aux deux bouts de la frise.
  scene("defilement-debut", "Défilement · tout au début", patch(episode, (_data, stage) => ({
    scrub: { target: 4, frame: stage.frame ? { uri: stage.frame } : null },
  }))),
  scene("defilement-fin", "Défilement · tout à la fin", patch(film, (_data, stage) => ({
    scrub: { target: stage.props.timeline.duration - 6, speed: { factor: 4, backward: false }, frame: stage.frame ? { uri: stage.frame } : null },
  }))),
  // Le décompte, figé (la barre ne glisse pas au banc) — une règle pour toutes
  // les entrées : en lecture, la lecture repart à la cible ; en pause, rien.
  scene("decompte-lecture", "Défilement · lecture dans 5 s", patch(film, aimedWith(5, 212))),
  scene("decompte-lecture-1s", "Défilement · lecture dans 1 s", patch(film, aimedWith(1, 212))),
  scene("decompte-saut", "Avance rapide · un appui → pousse la cible, lecture dans 5 s", patch(film, aimedWith(5, SKIP_FORWARD_SECONDS))),
  scene("decompte-recul", "Avance rapide · un appui ← recule la cible, lecture dans 5 s", patch(episode, aimedWith(5, -SKIP_BACK_SECONDS))),
  scene("decompte-pause", "Défilement en pause · aucun décompte", patch(film, aimedWith(null, 1800, true))),
  scene("decompte-sans-vignette", "Défilement · sans vignettes, lecture dans 5 s", patch(film, aimedWith(5, 212, false, false))),
  scene("decompte-fin", "Défilement · tout à la fin, lecture dans 1 s", patch(film, (data, stage) =>
    aimedWith(1, stage.props.timeline.duration - 6 - stage.props.timeline.position)(data, stage))),
  scene("saut-avant", `Saut +${SKIP_FORWARD_SECONDS} s (un appui →, habillage caché)`, patch(film, () => ({ osdVisible: false, seekFlash: { forward: true, label: seekFlashLabel(t, SKIP_FORWARD_SECONDS) } }))),
  scene("saut-arriere", `Saut −${2 * SKIP_BACK_SECONDS} s cumulé (deux appuis ←)`, patch(film, () => ({ osdVisible: false, seekFlash: { forward: false, label: seekFlashLabel(t, -2 * SKIP_BACK_SECONDS) } }))),
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
  scene("pistes", "Pistes · audio, sous-titres", patch(darkKnight, (data) => {
    const item = byName(data, "The Dark Knight : Le Chevalier noir");
    return { panel: item ? { kind: "tracks", tracks: tracksOf(item, { subtitle: 4 }) } : null };
  }), ["tracks:audio:2", "tracks:subtitle:5", "tracks:close"], 1400),
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
  scene("panne-bandeau", "Jellyfin coupé · la lecture continue", patch(film, () => ({
    osdVisible: false, trouble: noticeOf(t, { kind: "degraded", cause: "media", ahead: 34, since: 0, streamAffected: true }),
  }))),
  scene("panne-tentacle", "Tentacle coupé · flux direct, rien d'arrêté", patch(film, () => ({
    trouble: noticeOf(t, { kind: "degraded", cause: "tentacle", ahead: 30, since: 0, streamAffected: false }),
  })), ["player:playpause"]),
  scene("panne-panneau", "Jellyfin coupé · lecture arrêtée (avant tout geste)", patch(episode, (_data, stage) => ({
    osdVisible: false, trouble: troublePanel({ kind: "waiting", cause: "media", since: 0 }, stage, { nextIn: 4 }),
  }))),
  scene("panne-active", "Jellyfin coupé · panneau activé (focus)", patch(film, (_data, stage) => ({
    osdVisible: false, troubleCovers: true,
    trouble: troublePanel({ kind: "waiting", cause: "media", since: 0 }, stage, { nextIn: 2, stillDown: true, active: true }),
  })), ["trouble:retry", "trouble:back"]),
  scene("panne-debit", "Serveur joignable, lecture qui ne suit pas", patch(film, (_data, stage) => ({
    osdVisible: false, troubleCovers: true,
    trouble: troublePanel({ kind: "stuck", cause: "stall", since: 0 }, stage, { active: true, lower: true }),
  })), ["trouble:retry", "trouble:quality", "trouble:back"]),
  scene("panne-reprise", "Le serveur revient · reprise en cours", patch(episode, (_data, stage) => ({
    osdVisible: false, trouble: troublePanel({ kind: "recovering", cause: "media", since: 0 }, stage, {}),
  }))),
  scene("panne-repris", "La lecture a repris", patch(film, () => ({ osdVisible: false, trouble: RESUMED_NOTICE(t) }))),
  scene("panne-ouverture", "Ouverture ratée · Jellyfin coupé", patch(episode, () => ({
    phase: { kind: "failed", message: t("player:troubleStartMedia") },
  })), ["loading:retry"]),
];

/** Le panneau du message-outil sur une scène : la position est celle de la frise. */
export function troublePanel(
  phase: Parameters<typeof panelOf>[0]["phase"],
  stage: Stage,
  o: { nextIn?: number; stillDown?: boolean; active?: boolean; lower?: boolean },
) {
  return panelOf({
    t, phase, now: 0, position: stage.props.timeline.position,
    nextCheckAt: o.nextIn !== undefined ? o.nextIn * 1000 : null, checking: false, stillDown: !!o.stillDown,
    canLowerQuality: !!o.lower, active: !!o.active,
  });
}

const styles = StyleSheet.create({
  stage: { flex: 1, backgroundColor: "#000" },
});
