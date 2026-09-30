import { useMemo, useRef } from "react";
import type { MediaItem, PlayerOverlay, QualityKey } from "@tentacle-tv/shared";
import type { PlayerChromeViewProps } from "../../redesign/screens/player/PlayerChromeView";
import type { AutoPlayCtx } from "../../components/player/TVAutoPlaySwitch";

/** Ce que les gestes de l'habillage appellent — les mêmes que l'habillage actuel. */
export interface PlayerActionSources {
  controls: {
    guardScrub: <T extends unknown[]>(fn: (...args: T) => void) => (...args: T) => void;
    showOverlay: () => void;
    handleSkipBack: () => void;
    handleSkipForward: () => void;
    enterScrub: () => void;
  };
  overlay: PlayerOverlay;
  autoPlay: AutoPlayCtx;
  showEpisodes?: boolean;
  onBack: () => void;
  onRetry: () => void;
  onPlayPause: () => void;
  onPrevEpisode: () => void;
  onNextEpisode: () => void;
  onToggleEpisodes?: () => void;
  onToggleSettings: () => void;
  onCloseEpisodes?: () => void;
  onCloseSettings: () => void;
  onSkipSegment: () => void;
  onDismissSegment: () => void;
  onPlayNextNow: () => void;
  onEofDismiss?: () => void;
  onSelectAudio: (index: number) => void;
  onSelectSubtitle: (index: number) => void;
  onSelectQuality: (key: QualityKey) => void;
  onSelectEpisode?: (episode: MediaItem) => void;
  onSelectSeason: (seasonId: string) => void;
  episodeById: (id: string) => MediaItem | undefined;
}

type Actions = Pick<
  PlayerChromeViewProps,
  | "onBack" | "onRetry" | "onPlayPause" | "onSeekBack" | "onSeekForward" | "onScrub" | "onPrevious" | "onNext"
  | "onOpenEpisodes" | "onOpenTracks" | "onSkip" | "onDismissSkip" | "onPlayNext" | "onDismissNext" | "onLeaveEnd"
  | "onSelectSeason" | "onSelectEpisode" | "onSelectAudio" | "onSelectSubtitle" | "onSelectQuality" | "onClosePanel"
>;

/**
 * Les gestes de l'habillage refondu, câblés comme ceux de l'actuel
 * (`TVPlayerView`) : chaque commande passe par `guardScrub` — pendant un
 * défilement, OK VALIDE le défilement, jamais l'action du bouton focalisé,
 * et le jumeau de l'OK qui vient de le terminer est avalé.
 *
 * STABLES : lus au moment du geste (dernières sources), jamais recréés. Sans
 * cela, chaque tic de lecture redessinerait toutes les commandes.
 */
export function usePlayerChromeActions(sources: PlayerActionSources): Actions {
  const latest = useRef(sources);
  latest.current = sources;
  return useMemo<Actions>(() => {
    const now = () => latest.current;
    // Le garde se prend au moment du geste : il lit l'état du défilement.
    const guarded = (fn: () => void) => () => now().controls.guardScrub(fn)();
    const interacted = () => now().controls.showOverlay();
    return {
      onBack: guarded(() => now().onBack()),
      onRetry: () => now().onRetry(),
      onPlayPause: guarded(() => { now().onPlayPause(); interacted(); }),
      onSeekBack: guarded(() => { now().controls.handleSkipBack(); interacted(); }),
      onSeekForward: guarded(() => { now().controls.handleSkipForward(); interacted(); }),
      // Appui simple → mode défilement ; déjà en défilement, le garde en fait
      // une CONFIRMATION.
      onScrub: guarded(() => now().controls.enterScrub()),
      onPrevious: guarded(() => now().onPrevEpisode()),
      onNext: guarded(() => now().onNextEpisode()),
      onOpenEpisodes: guarded(() => now().onToggleEpisodes?.()),
      onOpenTracks: guarded(() => now().onToggleSettings()),
      // Un seul bouton pour deux objets : sauter le passage, ou rejoindre la
      // suite (`nextButton`).
      onSkip: guarded(() => (now().overlay.kind === "nextButton" ? now().onPlayNextNow() : now().onSkipSegment())),
      onDismissSkip: () => now().onDismissSegment(),
      onPlayNext: () => now().autoPlay.navigateToNextEpisode(),
      onDismissNext: () => now().autoPlay.cancelAutoPlay(),
      onLeaveEnd: () => (now().onEofDismiss ?? now().autoPlay.cancelAutoPlay)(),
      onSelectSeason: (seasonId) => now().onSelectSeason(seasonId),
      onSelectEpisode: (id) => {
        const episode = now().episodeById(id);
        if (episode) now().onSelectEpisode?.(episode);
      },
      onSelectAudio: (key) => { now().onSelectAudio(Number(key)); interacted(); },
      onSelectSubtitle: (key) => { now().onSelectSubtitle(Number(key)); interacted(); },
      onSelectQuality: (key) => { now().onSelectQuality(key as QualityKey); interacted(); },
      onClosePanel: () => (now().showEpisodes ? now().onCloseEpisodes?.() : now().onCloseSettings()),
    };
  }, []);
}
