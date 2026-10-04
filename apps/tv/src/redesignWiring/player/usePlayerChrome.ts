import { useCallback, useEffect, useMemo } from "react";
import { AccessibilityInfo } from "react-native";
import { useTranslation } from "react-i18next";
import { useJellyfinClient, useMediaItem, usePlaybackSegments, usePlaybackSettings } from "@tentacle-tv/api-client";
import type { PlayerChromeViewProps } from "../../redesign/screens/player/PlayerChromeView";
import { playerChromeLabels, seekFlashLabel, type Translate } from "../../redesign/screens/player/playerLabels";
import type { PlayerMedia, PlayerPanel, ScrubModel } from "../../redesign/screens/player/playerTypes";
import { useAutoCapNotice } from "../../hooks/useAutoCapNotice";
import { usePlaybackTroubleState } from "../../hooks/playbackTroubleStore";
import { playerChromeVisibility, SKIP_BACK_SECONDS, SKIP_FORWARD_SECONDS } from "@tentacle-tv/tv-core";
import type { FocusStore } from "../../platform/tvos/focus/focusStore";
import { backdropUriOf, logoUriOf, paletteOf, type ImageUrl } from "./playerArt";
import {
  buildEndScreen, buildPhase, buildPlayerMedia, buildScrubCountdown, buildSkipPill, buildUpNext, parseSpeedLabel,
  timelineSegments, trickplayFrame,
} from "./playerChromeModels";
import type { PlayerRedesignStageProps } from "./playerStageTypes";
import { usePlayerChromeActions } from "./usePlayerChromeActions";
import { usePlayerEpisodesPanel } from "./usePlayerEpisodesPanel";
import { usePlaybackTrouble } from "./usePlaybackTrouble";
import { usePlayerSheet } from "./usePlayerSheet";

const EMPTY_MEDIA: PlayerMedia = { title: "" };

export interface PlayerChrome {
  view: PlayerChromeViewProps;
  /** Ce que la vue montre — la même règle qu'elle, pour le focus. */
  loading: boolean;
  /** Le panneau du message-outil, activé, tient le focus : le fond se retire. */
  troubleCovers: boolean;
  /** L'habillage est À L'ÉCRAN (la règle de la vue) : Retour le masque. */
  osdShown: boolean;
  pillShown: boolean;
  upNextShown: boolean;
  endShown: boolean;
  /** L'option de la feuille (Pistes, Réglages) qui prend le focus à l'ouverture, ou null (fermée). */
  sheetEntryKey: string | null;
  /** La pilule qui a ouvert la feuille : le focus y revient à la fermeture. */
  sheetOpener: string;
  activeSeasonIndex: number;
}

/**
 * L'état complet de l'habillage refondu, lu dans ce que l'écran du lecteur
 * donne déjà à l'habillage actuel (`PlayerRedesignStageProps`) : modèles,
 * visibilités, panneaux, gestes. Aucune décision de lecture ici — l'arbitre
 * partagé, les contrôles et le pipeline de flux décident ; on traduit.
 */
export function usePlayerChrome(p: PlayerRedesignStageProps, store: FocusStore, osdPinned: boolean): PlayerChrome {
  const { t, i18n } = useTranslation();
  const translate = useCallback<Translate>((key, options) => t(key, options) as string, [t]);
  const client = useJellyfinClient();
  const image = useCallback<ImageUrl>((id, type, options) => client.getImageUrl(id, type, options), [client]);
  const item = p.item ?? undefined;
  const isEpisode = item?.Type === "Episode";
  // La série d'un épisode : son logo et sa lumière (en cache le plus souvent).
  const { data: series } = useMediaItem(isEpisode ? item?.SeriesId : undefined);
  // Lecture LOCALE du réglage : l'arbitre resynchronise déjà.
  const autoPlayOn = usePlaybackSettings({ resync: false }).next.nextAutoPlay;
  const labels = useMemo(
    () => playerChromeLabels(translate, { back: SKIP_BACK_SECONDS, forward: SKIP_FORWARD_SECONDS }),
    [translate],
  );
  const { controls, overlay, autoPlay } = p;

  // Les pastilles de la source ne se montrent que si c'est ELLE qui joue.
  const sourcePlaying = !!p.streamUrl && p.isDirectPlay;
  const media = useMemo(() => (item ? buildPlayerMedia(
    item,
    { logoUri: logoUriOf(image, isEpisode ? series : item), backdropUri: backdropUriOf(image, item) },
    sourcePlaying,
  ) : EMPTY_MEDIA), [item, isEpisode, series, image, sourcePlaying]);

  const step = p.prismStep;
  // L'ouverture ratée pendant une panne dit qui manque (cf. usePlaybackRecovery) ;
  // celle d'un transcodage qui se fait attendre le dit, puis son échec (useStartupWait).
  const { startCulprit, startWait, phase: recovery } = usePlaybackTroubleState();
  const failedMessage = startCulprit
    ? translate(startCulprit === "media" ? "player:troubleStartMedia" : "player:troubleStartTentacle")
    : startWait?.kind === "gaveUp" ? translate("player:troubleTranscodeDetail") : null;
  const startHint = startWait?.kind === "transcoding" ? translate("player:transcodeSlowHint")
    : startWait?.kind === "slowNetwork" ? translate("player:networkSlowHint") : null;
  const phase = useMemo(() => buildPhase({
    streamUrl: p.streamUrl, failed: p.failed, hasStarted: p.hasStarted, videoError: p.videoError, step, t: translate,
    failedMessage, startHint,
  }), [p.streamUrl, p.failed, p.hasStarted, p.videoError, step, translate, failedMessage, startHint]);
  const playing = phase.kind === "playing";

  // Les passages de la frise : le contrat que l'arbitre a déjà demandé (même cache).
  const resolved = usePlaybackSegments(item?.Id).segments;
  const segments = useMemo(() => timelineSegments(resolved), [resolved]);
  const timeline = useMemo(
    () => ({ position: p.displayTime, duration: p.displayDuration, buffered: p.bufferedTime, segments }),
    [p.displayTime, p.displayDuration, p.bufferedTime, segments],
  );
  const transport = useMemo(() => ({
    hasPrevious: p.hasPreviousEpisode,
    hasNext: !!autoPlay.nextEpisode,
    hasEpisodes: isEpisode && !!item?.SeriesId,
    seekBackSeconds: SKIP_BACK_SECONDS,
    seekForwardSeconds: SKIP_FORWARD_SECONDS,
  }), [p.hasPreviousEpisode, autoPlay.nextEpisode, isEpisode, item?.SeriesId]);

  // Le défilement : l'image visée en haute définition quand le serveur en a.
  const tp = p.trickplay?.hiRes ?? p.trickplay;
  const scrubbing = controls.scrubbing;
  const aim = scrubbing && tp ? tp.getFrameAt(controls.scrubPosition * 1000) : null;
  const aimTile = aim?.tileIndex;
  useEffect(() => {
    if (aimTile !== undefined && tp) tp.preloadNeighbors(aimTile, 2);
  }, [aimTile, tp]);
  const scrub: ScrubModel | null = scrubbing
    ? {
      target: controls.scrubPosition, speed: parseSpeedLabel(controls.speedLabel), frame: trickplayFrame(tp?.info, aim),
      countdown: buildScrubCountdown(controls.scrubCountdown, translate, p.displayTime),
    }
    : null;
  // Rechargement doux (piste, qualité) : la dernière image, figée.
  const reloadSec = p.reloadFrameSec != null && p.hasStarted ? p.reloadFrameSec : null;
  const reloadFrame = reloadSec !== null && p.trickplay
    ? trickplayFrame(p.trickplay.info, p.trickplay.getFrameAt(reloadSec * 1000))
    : null;

  const skip = useMemo(
    () => buildSkipPill(overlay, translate, p.countdownTotals.skipMs),
    [overlay, translate, p.countdownTotals.skipMs],
  );
  const next = autoPlay.nextEpisode;
  const card = overlay.kind === "nextCard" && next ? overlay : null;
  const upNext = useMemo(() => (card && next && !card.final ? buildUpNext({
    next, imageUri: image(next.Id, "Primary", { width: 640, quality: 85 }), countdownSeconds: card.countdownSeconds,
    autoPlay: autoPlayOn, nextTotalMs: p.countdownTotals.nextMs, t: translate,
  }) : null), [card, next, image, autoPlayOn, p.countdownTotals.nextMs, translate]);
  const endScreen = useMemo(() => (card && next && card.final ? buildEndScreen(buildUpNext({
    next, imageUri: image(next.Id, "Primary", { width: 1440, quality: 90 }), countdownSeconds: card.countdownSeconds,
    autoPlay: autoPlayOn, nextTotalMs: p.countdownTotals.nextMs, t: translate,
  }), {
    title: next.SeriesName ?? item?.SeriesName ?? "",
    logoUri: logoUriOf(image, series),
    backdropUri: backdropUriOf(image, next),
    palette: paletteOf(series, next),
  }) : null), [card, next, image, autoPlayOn, p.countdownTotals.nextMs, translate, item?.SeriesName, series]);

  const episodes = usePlayerEpisodesPanel({
    item, open: !!p.showEpisodes, store, image, t: translate, locale: i18n.language,
  });
  // La feuille : « Pistes » ou « Réglages », selon la pilule pressée.
  const sheet = usePlayerSheet(p, translate);
  const panel = useMemo<PlayerPanel | null>(() => {
    if (p.showEpisodes && episodes.model) return { kind: "episodes", episodes: episodes.model };
    return sheet.panel;
  }, [p.showEpisodes, episodes.model, sheet.panel]);

  const flash = controls.skipFlash;
  const seekFlash = useMemo(
    () => (flash ? { forward: flash.delta > 0, label: seekFlashLabel(translate, flash.delta) } : null),
    [flash, translate],
  );
  const notice = useAutoCapNotice(!!p.autoCapActive, p.hasStarted, p.autoCapReason);
  // Un transcodage qui se fait attendre en pleine lecture (changement de
  // qualité, serveur lent) : rien ne bloque, une ligne sous l'indicateur.
  const bufferingHint = recovery.kind === "transcoding" ? translate("player:transcodeSlowHint") : null;
  // VoiceOver la dit, comme celle de l'ouverture — sans prendre le focus.
  const waitHint = bufferingHint ?? startHint;
  useEffect(() => { if (waitHint) AccessibilityInfo.announceForAccessibility(waitHint); }, [waitHint]);
  const error = useMemo(
    () => (p.videoError ? { title: translate("player:playbackError"), message: p.videoError } : null),
    [p.videoError, translate],
  );

  const actions = usePlayerChromeActions({
    ...p, onSelectSeason: episodes.selectSeason, episodeById: episodes.episodeById, onOpenSheet: sheet.open,
  });

  // L'habillage : affiché, ou épinglé par la pause hors défilement (tant que
  // Retour ne l'a pas masqué, `useOsdPin`) ; il se tait devant une carte « à
  // suivre » (comme l'actuel), la vue devant le reste (tv-core
  // `playerChromeVisibility`, la même règle que `PlayerChromeView`).
  const shownBefore = playerChromeVisibility({
    playing, overlayVisible: controls.overlayVisible, pinned: osdPinned, scrubbing, autoPlayActive: p.autoPlayActive,
    panelShown: !!panel, endScreenShown: !!endScreen, troubleCovers: false, skipShown: skip !== null, upNextShown: upNext !== null,
  });
  const osdVisible = shownBefore.osdVisible;
  // Le message-outil quand un serveur ne répond plus (cf. usePlaybackTrouble).
  const trouble = usePlaybackTrouble({
    t: translate, store, position: p.displayTime, osdVisible, qualityKey: p.qualityKey,
    qualityPresets: p.qualityPresets, onSelectQuality: actions.onSelectQuality, onBack: actions.onBack,
  });
  const shown = playerChromeVisibility({
    playing, overlayVisible: controls.overlayVisible, pinned: osdPinned, scrubbing, autoPlayActive: p.autoPlayActive,
    panelShown: !!panel, endScreenShown: !!endScreen, troubleCovers: trouble.covers, skipShown: skip !== null,
    upNextShown: upNext !== null,
  });

  return {
    view: {
      ...actions,
      media, labels, phase, timeline, transport, paused: p.paused, osdVisible,
      buffering: p.isLoading && p.hasStarted, bufferingHint, scrub, seekFlash, skip, upNext, endScreen, panel, reloadFrame,
      notice, error, subtitle: p.subtitleCue ?? null,
      trouble: trouble.model, troubleCovers: trouble.covers, onTroubleAction: trouble.onAction,
    },
    troubleCovers: trouble.covers,
    osdShown: shown.osdShown,
    loading: !playing,
    pillShown: shown.pillShown,
    upNextShown: shown.upNextShown,
    endShown: endScreen !== null,
    sheetEntryKey: sheet.entryKey,
    sheetOpener: sheet.opener,
    activeSeasonIndex: episodes.activeSeasonIndex,
  };
}
