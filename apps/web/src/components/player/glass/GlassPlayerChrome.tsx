import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { TrackSelector } from "../../TrackSelector";
import { EpisodeSelectorPanel } from "../EpisodeSelectorPanel";
import { LocalEpisodeSelectorPanel } from "../LocalEpisodeSelectorPanel";
import { GlassChromeVisibleContext, GlassSurface } from "./GlassSurface";
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
 * (`DesktopPlayerControls`), autre dessin : de PETITES formes de verre clair qui
 * flottent sur l'image, séparées, au lieu de deux bandeaux assombris.
 *
 *  - en haut à gauche, la pastille de la sortie et la capsule du titre ;
 *  - en bas, au centre : la capsule du temps (écoulé · piste · restant), puis
 *    trois capsules — le son, le transport, les réglages.
 *
 * Elles paraissent et s'effacent en se MÉTAMORPHOSANT : repliées vers leur pivot
 * (le transport, la sortie), elles s'y fondent en une goutte qui se sépare en
 * capsules (`collapse`, `useCollapsePivots`).
 *
 * Les panneaux (pistes, épisodes, vitesse) s'ouvrent AU-DESSUS de la capsule,
 * calés sur son bord droit — des popovers de verre, pas des cartes opaques.
 * Tous sont rendus DANS le dock : celui de la vitesse y est porté depuis sa
 * capsule (`glassDock.ts`).
 *
 * # Toujours monté
 *
 * L'habillage n'est jamais démonté quand les contrôles s'effacent : la vitesse
 * de lecture vit dans `PlaybackRateControl`, qui se remet à 1× à son montage.
 * Ce qui part, c'est la MATIÈRE : chaque région native est retirée
 * (`GlassChromeVisibleContext`) à la fin du repli de sa capsule, le contenu
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
          <GlassTopBar visible={visible} title={title} subtitle={subtitle} isDirectPlay={isDirectPlay} goBack={goBack} />

          <div ref={setDock} className="lgp-dock" onClick={(e) => e.stopPropagation()}>
            {/* La capsule du temps, puis les trois capsules de boutons : même groupe
                natif, SÉPARÉES au repos (10 px, au-delà de la fusion), fondues en
                se repliant vers le transport. */}
            <GlassSurface className="lgp-timecap" present={visible} collapse adaptiveTone>
              <div className="lgp-content lgp-timecap__inner">
                <GlassSeekbar seekbar={seekbar} displayProgress={displayProgress} bufProg={bufProg} position={actualPos} duration={dur} />
              </div>
            </GlassSurface>
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
