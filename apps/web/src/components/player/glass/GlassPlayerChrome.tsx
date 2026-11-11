import { useState, type CSSProperties } from "react";
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
import type { DesktopPlayerControlsProps } from "../desktopPlayerControls.types";
import "./playerGlassBar.css";
import "./playerGlassTrickplay.css";
import "./playerGlassCapsules.css";

/**
 * L'habillage du lecteur en VERRE — même contrat ET même disposition que
 * l'habillage sans verre (`DesktopPlayerControls`, lot rf2 : « la même
 * disposition, avec des composants Liquid Glass ») :
 *
 *  - un VOILE dégradé en haut et en bas (`GlassScrim`), peint par la page, qui
 *    naît et part avec les contrôles — percé autour de chaque forme de verre ;
 *  - en haut à gauche, le rond de la sortie et le titre en TEXTE sur le voile ;
 *  - en bas, la barre de lecture d'une marge à l'autre, puis la rangée : la
 *    CAPSULE du transport à gauche, le temps en texte, la CAPSULE du son et des
 *    réglages à droite (`GlassControlsRow`). Trois formes de verre en tout.
 *
 * `apps/desktop-cef/bench/glass/disposition.mjs` (banc CDP) compare, rectangle par rectangle, cet
 * habillage à celui d'avant : mêmes emplacements, mêmes groupes, même ordre.
 *
 * Les formes paraissent en se MATÉRIALISANT (lot lg8) : chacune monte de quelques
 * points pendant que son verre s'allume, le transport d'abord, le haut en dernier ;
 * elles partent ensemble, plus vite (`materialize`, `playerGlassMaterialize.ts`).
 * Ce qui est nu (titre, barre, temps, voile) suit le même rythme, en fondu.
 *
 * Les panneaux (pistes, épisodes, vitesse) s'ouvrent AU-DESSUS de la capsule de
 * droite, calés sur le bord droit — des popovers de verre, à la place des menus
 * opaques. Tous sont rendus DANS le dock : celui de la vitesse y est porté
 * depuis son bouton (`glassDock.ts`).
 *
 * # Toujours monté
 *
 * L'habillage n'est jamais démonté quand les contrôles s'effacent : la vitesse
 * de lecture vit dans `PlaybackRateControl`, qui se remet à 1× à son montage.
 * Ce qui part, c'est la MATIÈRE : chaque région native est retirée
 * (`GlassChromeVisibleContext`) à la fin du repli de sa forme, le contenu
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
  return (
    <GlassChromeVisibleContext.Provider value={visible}>
      <GlassDockContext.Provider value={dock}>
        <div className="lgp-chrome">
          {/* Le voile d'abord : dessous tout le reste, percé autour du verre. */}
          <GlassScrim edge="top" visible={visible} />
          <GlassScrim edge="bottom" visible={visible} />
          <GlassTopBar visible={visible} title={title} subtitle={subtitle} isDirectPlay={isDirectPlay} goBack={goBack} />

          <div ref={setDock} className="lgp-dock" onClick={(e) => e.stopPropagation()}>
            {/* La barre NUE sur le voile, puis la rangée des deux capsules de verre. */}
            <div className="lgp-timeline lgp-nude" data-lgp-present={visible} style={{ "--lgp-order": 1 } as CSSProperties}>
              <GlassSeekbar seekbar={seekbar} displayProgress={displayProgress} bufProg={bufProg} />
            </div>
            <GlassControlsRow
              state={state} itemId={itemId} isEpisode={isEpisode} hasSettings={hasSettings}
              hasNextEpisode={hasNextEpisode} hasPreviousEpisode={hasPreviousEpisode}
              showSettings={showSettings} showEpisodes={showEpisodes}
              setShowSettings={setShowSettings} setShowEpisodes={setShowEpisodes}
              onReduce={onReduce} togglePause={togglePause} skipBy={skipBy} toggleMute={toggleMute}
              setVolume={setVolume} setSpeed={setSpeed} toggleFullscreen={toggleFullscreen}
              onNextEpisode={onNextEpisode} onPreviousEpisode={onPreviousEpisode} speed={speed}
              visible={visible} curSub={curSub}
              position={seekbar.dragProgress != null ? seekbar.dragProgress * dur : actualPos} duration={dur}
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
