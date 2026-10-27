import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { TrackSelector } from "../../TrackSelector";
import { EpisodeSelectorPanel } from "../EpisodeSelectorPanel";
import { LocalEpisodeSelectorPanel } from "../LocalEpisodeSelectorPanel";
import { GlassChromeVisibleContext } from "./GlassSurface";
import { GlassScrim } from "./GlassScrim";
import { GlassTopBar } from "./GlassTopBar";
import { GlassSeekbar } from "./GlassSeekbar";
import { GlassControlsRow } from "./GlassControlsRow";
import { GlassDockContext } from "./glassDock";
import { useCollapsePivots } from "./useCollapsePivots";
import type { DesktopPlayerControlsProps } from "../desktopPlayerControls.types";
import "./playerGlassBar.css";
import "./playerGlassTrickplay.css";
import "./playerGlassCapsules.css";

/**
 * L'habillage du lecteur en VERRE — même contrat que l'habillage d'avant
 * (`DesktopPlayerControls`), autre dessin : celui du lecteur de tvOS 26 (lot lg8).
 *
 *  - un VOILE dégradé en haut et en bas (`GlassScrim`), peint par la page, qui
 *    naît et part avec les contrôles — percé autour de chaque forme de verre ;
 *  - en haut à gauche, le rond de la sortie et le titre en TEXTE sur le voile ;
 *  - en bas, la barre de progression NUE (un trait blanc, le temps en texte),
 *    puis des RONDS de verre clair : le son à gauche, le transport au centre,
 *    les réglages à droite (`GlassControlsRow`).
 *
 * Les ronds paraissent et s'effacent en se repliant vers leur pivot (la lecture,
 * la sortie : `collapse`, `useCollapsePivots`) ; ce qui est nu, en fondu.
 *
 * Les panneaux (pistes, épisodes, vitesse) s'ouvrent AU-DESSUS des ronds,
 * calés sur le bord droit — des popovers de verre, pas des cartes opaques.
 * Tous sont rendus DANS le dock : celui de la vitesse y est porté depuis son
 * rond (`glassDock.ts`).
 *
 * # Toujours monté
 *
 * L'habillage n'est jamais démonté quand les contrôles s'effacent : la vitesse
 * de lecture vit dans `PlaybackRateControl`, qui se remet à 1× à son montage.
 * Ce qui part, c'est la MATIÈRE : chaque région native est retirée
 * (`GlassChromeVisibleContext`) à la fin du repli de son rond, le contenu
 * s'efface d'abord, et la page n'a plus rien qui se compose au-dessus de la
 * vidéo.
 */
export function GlassPlayerChrome({
  visible, state, title, subtitle, isDirectPlay, isEpisode, useLocalEpisodes, item, itemId,
  displayAudio, displaySubs, curAudio, curSub, currentQuality, sourceQuality, qualityPresets, autoQualityActive, qualityDrop,
  hasSettings, hasNextEpisode, hasPreviousEpisode,
  dur, actualPos, displayProgress, bufProg, seekbar,
  showSettings, showEpisodes, setShowSettings, setShowEpisodes, closePanels,
  goBack, onReduce, togglePause, skipBy, toggleMute, setVolume, setSpeed, toggleFullscreen,
  handleAudioChange, handleSubtitleChange, onQualityChange, applyToSeries,
  onNextEpisode, onPreviousEpisode, speed,
}: DesktopPlayerControlsProps) {
  const [dock, setDock] = useState<HTMLDivElement | null>(null);
  useCollapsePivots(dock);
  return (
    <GlassChromeVisibleContext.Provider value={visible}>
      <GlassDockContext.Provider value={dock}>
        <div className="lgp-chrome">
          {/* Le voile d'abord : dessous tout le reste, percé autour du verre. */}
          <GlassScrim edge="top" visible={visible} />
          <GlassScrim edge="bottom" visible={visible} />
          <GlassTopBar visible={visible} title={title} subtitle={subtitle} isDirectPlay={isDirectPlay} goBack={goBack} />

          <div ref={setDock} className="lgp-dock" onClick={(e) => e.stopPropagation()}>
            {/* La barre NUE sur le voile, puis les ronds de verre : même groupe natif,
                SÉPARÉS au repos (12 px, au-delà de la fusion), fondus en se repliant
                vers le rond de lecture. */}
            <div className="lgp-timeline lgp-nude" data-lgp-present={visible}>
              <GlassSeekbar seekbar={seekbar} displayProgress={displayProgress} bufProg={bufProg} position={actualPos} duration={dur} />
            </div>
            <GlassControlsRow
              state={state} itemId={itemId} isEpisode={isEpisode} hasSettings={hasSettings}
              hasNextEpisode={hasNextEpisode} hasPreviousEpisode={hasPreviousEpisode}
              showSettings={showSettings} showEpisodes={showEpisodes}
              setShowSettings={setShowSettings} setShowEpisodes={setShowEpisodes}
              onReduce={onReduce} togglePause={togglePause} skipBy={skipBy} toggleMute={toggleMute}
              setVolume={setVolume} setSpeed={setSpeed} toggleFullscreen={toggleFullscreen}
              onNextEpisode={onNextEpisode} onPreviousEpisode={onPreviousEpisode} speed={speed}
              visible={visible}
            />

            {/* Les panneaux se calent sur le DOCK (bord droit, au-dessus des capsules). */}
            <AnimatePresence>
              {showSettings && hasSettings && (
                <TrackSelector
                  key="tracks"
                  audioTracks={displayAudio} subtitleTracks={displaySubs}
                  currentAudio={curAudio} currentSubtitle={curSub}
                  currentQuality={currentQuality} sourceQuality={sourceQuality} qualityPresets={qualityPresets}
                  autoQualityActive={autoQualityActive} qualityDrop={qualityDrop}
                  onAudioChange={handleAudioChange} onSubtitleChange={handleSubtitleChange}
                  onQualityChange={onQualityChange}
                  applyToSeries={applyToSeries}
                  onClose={closePanels.settings}
                />
              )}
              {showEpisodes && isEpisode && item?.SeriesId && (
                useLocalEpisodes ? (
                  <LocalEpisodeSelectorPanel key="episodes" currentEpisodeId={item.Id} onClose={closePanels.episodes} />
                ) : (
                  <EpisodeSelectorPanel
                    key="episodes"
                    seriesId={item.SeriesId}
                    currentEpisodeId={item.Id}
                    currentSeasonId={item.SeasonId}
                    onClose={closePanels.episodes}
                  />
                )
              )}
            </AnimatePresence>
          </div>
        </div>
      </GlassDockContext.Provider>
    </GlassChromeVisibleContext.Provider>
  );
}
