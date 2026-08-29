import { useCallback, useEffect, useMemo, useRef } from "react";
import type { PlayerControlsProps } from "@/components/PlayerControls";
import { enterPanel, exitPanel } from "./focusOsd";
import { accumulate, type SkipTotal } from "./cumulativeSkips";
import { createScrubMachine, enterScrub, updateScrub, showOsd, setPanel, exitScrub, type ScrubMachine, useTvPlayerState } from "@tentacle-tv/tv-core";
import { usePlayerCycleTv } from "./playerCycleTv";
import { ProgressBarTv } from "./ProgressBarTv";
import { HeaderTv } from "./HeaderTv";
import { TransportRowTv } from "./TransportRowTv";
import { ScrubOverlayTv } from "./ScrubOverlayTv";
import { TracksPanelTv, EpisodesPanelTv } from "./PanelsTv";

/**
 * Les commandes du lecteur, dessinées pour trois mètres.
 *
 * Substitué à `apps/web/src/components/PlayerControls.tsx`, dont le contrat est
 * repris **à l'identique et annoté explicitement** : la substitution est un
 * greffon Vite, `tsc` ne la connaît pas, et sans cette annotation une propriété
 * renommée dans `apps/web` casserait le lecteur du téléviseur à l'exécution,
 * en silence, sur une dalle. C'est la leçon de la jauge de bannière.
 *
 * Ce qui est remplacé est du DESSIN, pas de la logique. Le seek reste celui de
 * `useSmartSeek`, câblé sur `onSeek` — le seul chemin qui sache suivre un
 * transcodage HLS plutôt que de le couper. Les pistes, les épisodes, la
 * lecture, l'enchaînement : tout arrive déjà par les propriétés.
 *
 * Trois rendus exclusifs selon le mode. Au repos, rien — et le masquage
 * automatique, qui lit le même magasin, met l'enveloppe à `opacity-0` en même
 * temps. En déplacement, la surcouche du curseur fantôme, VISIBLE parce que
 * cette même enveloppe reste opaque tant que le mode n'est pas `repos` : c'est
 * ce qui permet de dessiner le déplacement sans portail et sans substituer
 * `VideoPlayer`.
 */

export function PlayerControls(props: PlayerControlsProps) {
  const {
    // `buffered` du web est une FRACTION de 0 à 1, pas des secondes. La barre du
    // téléviseur le redivisait par la durée et n'a donc jamais rien affiché ;
    // c'est exactement la casse « en silence, sur une dalle » annoncée plus
    // haut, et elle a duré parce que les deux unités sont des `number`. La
    // propriété d'en face porte désormais son unité dans son nom.
    playing, currentTime, duration, buffered,
    item, itemId, mediaSourceId, title, subtitle,
    audioTracks, subtitleTracks, currentAudio, currentSubtitle,
    currentQuality, sourceQuality, qualityPresets,
    hasNextEpisode, hasPreviousEpisode,
    onTogglePlay, onSeek, onSkip, onBack,
    onAudioChange, onSubtitleChange, onQualityChange,
    onNextEpisode, onPreviousEpisode, applyToSeries,
  } = props;

  const state = useTvPlayerState();

  // Les valeurs vivantes passent par des refs : la machine à scrub est créée
  // une fois pour toutes et lit l'état au moment où elle en a besoin, plutôt
  // que de se reconstruire à chaque image du compteur de temps.
  const position = useRef(currentTime);
  const total = useRef(duration);
  const playingRef = useRef(playing);
  position.current = currentTime;
  total.current = duration;
  playingRef.current = playing;

  const scrub = useMemo<ScrubMachine>(
    () =>
      createScrubMachine({
        readPosition: () => position.current,
        readDuration: () => total.current,
        onEnter: (pos, step) => enterScrub(pos, step),
        onChange: (pos, step) => updateScrub(pos, step),
        onPause: (pause) => {
          // La bascule du lecteur est la seule qu'on connaisse : on ne s'en
          // sert que si l'état courant ne correspond pas à ce qu'on veut.
          if (pause === !playingRef.current) return;
          onTogglePlay();
        },
        onSeek: (seconds) => onSeek(seconds),
        onExit: () => exitScrub(),
      }),
    [onSeek, onTogglePlay],
  );

  useEffect(() => () => scrub.destroy(), [scrub]);

  const exit = useCallback(() => onBack(), [onBack]);

  /** Ce que les sauts enchaînés ont demandé jusqu'ici, et quand. */
  const skipTotal = useRef<SkipTotal | null>(null);

  /**
   * Le saut nu, sans rien allumer.
   *
   * C'est la forme qu'appellent les FLÈCHES, habillage éteint : y répondre en
   * rallumant les commandes ferait d'un geste anodin un changement d'écran, et
   * masquerait l'image au moment précis où l'on cherche à s'y retrouver. Le
   * badge suffit à dire ce qui se passe — c'est son emploi.
   *
   * **Pourquoi on passe le CUMUL et non le pas.** `skipBy` du client web
   * calcule sa cible depuis la position RÉELLE de la vidéo. Or celle-ci ne
   * bouge pas entre deux appuis enchaînés — le déplacement est différé, et sur
   * un flux transcodé il l'est franchement. Trois « +30 » d'affilée
   * demandaient donc trois fois la même chose : trente secondes, une seule
   * fois, pendant que le badge en annonçait quatre-vingt-dix. On additionne
   * ici, et l'on demande la somme.
   *
   * C'est aussi ce qui rend le badge juste sans qu'il ait à compter : il reçoit
   * le total, il l'affiche.
   */
  const skipRaw = useCallback(
    (delta: number) => {
      const next = accumulate(skipTotal.current, delta, Date.now());
      skipTotal.current = next;
      if (onSkip) onSkip(next.total);
      else onSeek(Math.max(0, position.current + next.total));
    },
    [onSeek, onSkip],
  );

  usePlayerCycleTv({
    mode: state.mode,
    actions: { togglePlayback: onTogglePlay, skip: skipRaw, exit, scrub },
    scrub,
  });

  const osd = useRef<HTMLDivElement>(null);

  /** Ce qui a ouvert le panneau, pour lui rendre le focus en le refermant. */
  const panelTrigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (state.mode !== "osd") return;

    if (state.panel !== "none") {
      // Un panneau s'ouvre. On note d'où l'on vient, puis on entre dedans : le
      // focus restait sinon sur le bouton qui l'a ouvert, hors du panneau, et
      // le confinement calculait ses déplacements depuis un point extérieur.
      const active = document.activeElement;
      if (active instanceof HTMLElement && !active.closest(".panneau-tv")) {
        panelTrigger.current = active;
      }
      enterPanel();
      return;
    }

    // Aucun panneau : soit on vient d'en refermer un — le focus revient alors à
    // ce qui l'a ouvert, et non au centre de l'habillage —, soit l'habillage
    // vient de paraître.
    const trigger = panelTrigger.current;
    panelTrigger.current = null;
    exitPanel(trigger, osd.current);
  }, [state.mode, state.panel]);

  /** La forme des BOUTONS : le même saut, mais l'habillage reste à l'écran. */
  const skip = useCallback(
    (delta: number) => {
      showOsd();
      skipRaw(delta);
    },
    [skipRaw],
  );

  if (state.mode === "idle") return null;

  if (state.mode === "scrub" && state.scrub) {
    return (
      <ScrubOverlayTv
        title={title}
        position={state.scrub.position}
        step={state.scrub.tier}
        currentTime={currentTime}
        duration={duration}
        bufferedFraction={buffered}
        item={item}
        mediaSourceId={mediaSourceId}
      />
    );
  }

  const hasTracks = audioTracks.length > 0 || subtitleTracks.length > 0;
  const hasEpisodes = item?.Type === "Episode" && !!item.SeriesId;

  return (
    /**
     * Le clic s'arrête ici, et c'est vital.
     *
     * Le conteneur du `VideoPlayer` bascule la lecture à tout clic qui lui
     * parvient (`VideoPlayer.tsx`, `onClick={togglePlay}`) — un geste de souris
     * qui a du sens sur un écran d'ordinateur, aucun ici. Or `preventDefault`
     * ayant tué l'activation native d'Entrée, `enableFocusedElement()` rejoue
     * un VRAI `.click()`, qui remonte comme tel.
     *
     * Sans cette barrière, chaque appui sur OK agissait deux fois : le bouton
     * faisait son travail, puis le conteneur basculait la lecture par-dessus.
     * Sur Lecture/Pause les deux bascules s'annulaient — « OK ne fait rien » —,
     * et partout ailleurs le symptôme était invisible : ouvrir les pistes
     * mettait la vidéo en pause, +30 sautait ET mettait en pause. Le
     * `PlayerControls` du web pose la même barrière sur chacune de ses deux
     * barres ; le portage ne l'avait pas reprise.
     */
    <div
      className="osd-tv"
      ref={osd}
      data-panneau={state.panel}
      onClick={(event) => event.stopPropagation()}
    >
      <HeaderTv title={title} subtitle={subtitle} onExit={exit} />

      <div className="osd-tv-bas">
        {state.panel === "tracks" && (
          <TracksPanelTv
            audioTracks={audioTracks}
            subtitleTracks={subtitleTracks}
            currentAudio={currentAudio}
            currentSubtitle={currentSubtitle}
            currentQuality={currentQuality}
            sourceQuality={sourceQuality}
            qualityPresets={qualityPresets}
            onAudioChange={onAudioChange}
            onSubtitleChange={onSubtitleChange}
            onQualityChange={onQualityChange}
            applyToSeries={applyToSeries}
            onClose={() => setPanel("none")}
          />
        )}
        {state.panel === "episodes" && item && (
          <EpisodesPanelTv item={item} onClose={() => setPanel("none")} />
        )}

        <ProgressBarTv
          currentTime={currentTime}
          duration={duration}
          bufferedFraction={buffered}
        />

        <TransportRowTv
          playing={playing}
          hasPrevious={!!hasPreviousEpisode}
          hasNext={!!hasNextEpisode}
          hasEpisodes={hasEpisodes}
          hasTracks={hasTracks}
          onToggle={() => {
            showOsd();
            onTogglePlay();
          }}
          onSkip={skip}
          // Le curseur fantôme se pose où l'on en est, sans avancer : on a
          // demandé à se déplacer, pas encore où.
          onMove={() => scrub.enter()}
          onPrevious={() => onPreviousEpisode?.()}
          onNext={() => onNextEpisode?.()}
          onEpisodes={() => setPanel(state.panel === "episodes" ? "none" : "episodes")}
          onTracks={() => setPanel(state.panel === "tracks" ? "none" : "tracks")}
        />
      </div>
      {/* `itemId` reste dans le contrat sans emploi ici : le client web s'en
          sert pour l'aperçu au survol, que la surcouche de déplacement rend
          autrement. `mediaSourceId`, lui, y sert — c'est la clé du manifeste
          de vignettes. */}
      <span hidden data-item={itemId} />
    </div>
  );
}
