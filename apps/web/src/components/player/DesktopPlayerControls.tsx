import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import { TrackSelector } from "../TrackSelector";
import { EpisodeSelectorPanel } from "./EpisodeSelectorPanel";
import { LocalEpisodeSelectorPanel } from "./LocalEpisodeSelectorPanel";
import { DesktopSeekbar } from "./DesktopSeekbar";
import { formatDuration } from "../playerControls/utils";
import { PlaybackRateControl } from "../playerControls/PlaybackRateControl";
import { surfaceHasAlpha } from "../../lib/videoShadow";
import {
  VolumeIcon, MuteIcon, GearIcon,
  FullscreenIcon, ExitFullscreenIcon, PrevEpIcon, NextEpIcon, EpisodesIcon,
} from "../PlayerIcons";
import { PauseIcon, PlayIcon } from "../icons/transport";
import { rangeFill } from "../../lib/rangeFill";
import { ReduceIcon } from "../../pictureInPicture/pipIcons";
import { usePlayerGlassMode } from "./glass/PlayerGlassContext";
import { isGlassLayout } from "./glass/playerGlassMode";
import { GlassPlayerChrome } from "./glass/GlassPlayerChrome";
import { SkipBackGlyph, SkipForwardGlyph } from "./chrome/skipGlyphs";
import { usePlaybackRate } from "../playerControls/usePlaybackRate";
import { ChromeTop } from "./chrome/ChromeTop";
import { useChromePresence } from "./chrome/useChromePresence";
import type { DesktopPlayerControlsProps } from "./desktopPlayerControls.types";
import "./chrome/playerChrome.css";

/**
 * La surface de la page a-t-elle un alpha par pixel ?
 *
 * Elle décide de ce qu'on a le droit de poser derrière les barres : les deux
 * dégradés là où ils ne coûtent rien (Windows, web), et RIEN du tout là où toute
 * couche composée sur la fenêtre de mpv se paie — voir le commentaire du rendu.
 */
const WITHOUT_ALPHA = !surfaceHasAlpha();

/**
 * L'habillage du lecteur de bureau : le verre natif là où il se pose (macOS 26,
 * réglage allumé, vidéo sous la fenêtre — `glass/playerGlassMode.ts`), sinon
 * l'habillage de la refonte (nov. 2026) — les mêmes formes, peintes par la page :
 * la sortie et le titre en haut ; en bas la barre de lecture, puis deux CAPSULES
 * d'encre (transport à gauche, son et réglages à droite — `chrome/playerChrome.css`).
 *
 * Posé sur la vidéo : blanc et encre en dur, identiques dans les deux thèmes.
 * (TrackSelector / EpisodeSelectorPanel qu'il ouvre sont eux tokenisés : ce sont
 * des menus détachés, pas posés sur la vidéo.)
 */
export function DesktopPlayerControls(props: DesktopPlayerControlsProps) {
  const mode = usePlayerGlassMode();
  // Le taux de lecture vit ICI : couper le réglage en pleine lecture change
  // d'habillage, et un taux tenu par le bouton remettait mpv à 1×.
  const speed = usePlaybackRate(props.setSpeed, props.itemId);
  return isGlassLayout(mode)
    ? <GlassPlayerChrome {...props} speed={speed} />
    : <LegacyDesktopPlayerControls {...props} speed={speed} />;
}

function LegacyDesktopPlayerControls({
  visible, state, title, subtitle, isDirectPlay, isEpisode, useLocalEpisodes, item, itemId,
  displayAudio, displaySubs, curAudio, curSub, currentQuality, sourceQuality, qualityPresets, autoQualityActive, qualityDrop,
  hasSettings, hasNextEpisode, hasPreviousEpisode,
  dur, actualPos, displayProgress, bufProg, seekbar,
  showSettings, showEpisodes, setShowSettings, setShowEpisodes, closePanels,
  goBack, onReduce, togglePause, skipBy, toggleMute, setVolume, setSpeed, toggleFullscreen,
  handleAudioChange, handleSubtitleChange, onQualityChange, applyToSeries,
  onNextEpisode, onPreviousEpisode, speed,
}: DesktopPlayerControlsProps) {
  const { t } = useTranslation("player");
  const { dragProgress } = seekbar;
  // Masqué, l'habillage quitte le DOM une fois son fondu joué : sa barre et ses boutons
  // n'étaient rendus pour personne à chaque battement de position. Son état (panneaux,
  // vitesse, glissement) vit dans `DesktopPlayer` et `DesktopPlayerControls`, au-dessus.
  const { mounted, shown } = useChromePresence(visible);
  if (!mounted) return null;
  const muted = state.muted || state.volume === 0;

  return (
    // ⚠️ Ce qui peut se poser sur l'image de la surface à alpha (macOS, Linux) est ÉTROIT,
    // et chaque frontière a été mesurée :
    //
    //  - un voile plein cadre assombrissait 8 % de l'image ENTIÈRE, et une bande de 631 lignes
    //    changeait de 10,2 niveaux à l'instant où il s'en allait — un tiers de l'écran qui saute ;
    //  - une ombre de TEXTE dessinait un contour visible autour du minutage et de la barre.
    //
    // Ce qui a survécu (essai du 30.08) : le dégradé NOIR, ALLÉGÉ sur la surface à alpha
    // (`data-alpha` : 45 % en haut, 52 % en bas, contre 62 et 78 ailleurs) et cantonné aux zones
    // des barres. Le noir est invariant par prémultiplication : c'est LA couleur que cette
    // surface compose juste — et c'est aussi celle des capsules. Le blanc partiel, lui, s'y
    // délave vers le gris : les survols y rendent un peu plus sombres qu'ailleurs, assumé.
    // Un contour de texte à copies pleines a été essayé et JUGÉ LAID (`videoShadow.ts`) : ne
    // pas le remettre.
    <div className="pl-chrome" data-shown={shown} data-alpha={WITHOUT_ALPHA ? undefined : "true"}>
      <ChromeTop title={title} subtitle={subtitle} onBack={() => goBack()}>
        {import.meta.env.DEV && <span className="pl-devbadge">mpv{isDirectPlay ? "" : " (transcode)"}</span>}
      </ChromeTop>

      <div className="pl-bar pl-bar--bottom" onClick={(e) => e.stopPropagation()}>
        <AnimatePresence>
          {showSettings && hasSettings && (
            <TrackSelector
              audioTracks={displayAudio} subtitleTracks={displaySubs}
              currentAudio={curAudio} currentSubtitle={curSub}
              currentQuality={currentQuality} sourceQuality={sourceQuality} qualityPresets={qualityPresets}
              autoQualityActive={autoQualityActive} qualityDrop={qualityDrop}
              onAudioChange={handleAudioChange} onSubtitleChange={handleSubtitleChange}
              onQualityChange={onQualityChange}
              applyToSeries={applyToSeries} seriesName={item?.SeriesName ?? undefined}
              onClose={closePanels.settings}
            />
          )}
          {showEpisodes && isEpisode && item?.SeriesId && (
            useLocalEpisodes ? (
              <LocalEpisodeSelectorPanel
                currentEpisodeId={item.Id}
                onClose={closePanels.episodes}
              />
            ) : (
              <EpisodeSelectorPanel
                seriesId={item.SeriesId}
                currentEpisodeId={item.Id}
                currentSeasonId={item.SeasonId}
                onClose={closePanels.episodes}
              />
            )
          )}
        </AnimatePresence>

        {/* La barre de lecture : tampon, position, glissement, vignette. */}
        <DesktopSeekbar seekbar={seekbar} displayProgress={displayProgress} bufProg={bufProg} />

        <div className="pl-row">
          <div className="pl-caps">
            {hasPreviousEpisode && (
              <button type="button" onClick={onPreviousEpisode} className="pl-btn" title={`${t("player:previousEpisodeLabel")} (P)`} aria-label={t("player:previousEpisodeLabel")}><PrevEpIcon /></button>
            )}
            <button type="button" onClick={() => skipBy(-10)} className="pl-btn" title={t("player:seekBackBy", { seconds: 10 })} aria-label={t("player:seekBackBy", { seconds: 10 })}>
              <SkipBackGlyph seconds={10} />
            </button>
            <button type="button" onClick={() => togglePause()} className="pl-btn pl-btn--main" aria-label={state.paused ? t("player:play") : t("player:pause")}>
              {state.paused ? <PlayIcon size={20} aria-hidden /> : <PauseIcon size={20} aria-hidden />}
            </button>
            <button type="button" onClick={() => skipBy(30)} className="pl-btn" title={t("player:seekForwardBy", { seconds: 30 })} aria-label={t("player:seekForwardBy", { seconds: 30 })}>
              <SkipForwardGlyph seconds={30} />
            </button>
            {hasNextEpisode && (
              <button type="button" onClick={onNextEpisode} className="pl-btn" title={`${t("player:nextEpisodeLabel")} (N)`} aria-label={t("player:nextEpisodeLabel")}><NextEpIcon /></button>
            )}
          </div>
          <span className="pl-time">{formatDuration(dragProgress != null ? dragProgress * dur : actualPos)} / {formatDuration(dur)}</span>
          <span className="pl-grow" />
          <div className="pl-caps">
            <div className="pl-volume">
              <button type="button" onClick={() => toggleMute()} className="pl-btn" aria-label={muted ? t("player:unmute") : t("player:mute")} title={muted ? t("player:unmute") : t("player:mute")}>
                {/* Quatre états qui suivent le volume : coupé, bas (≤33), moyen (≤66),
                    fort — comme un OSD système. */}
                {muted ? <MuteIcon /> : <VolumeIcon bars={state.volume <= 33 ? 1 : state.volume <= 66 ? 2 : 3} />}
              </button>
              {/* Le curseur MESURE : il porte le dégradé de jauge (`.ctl-range`). */}
              <input type="range" min={0} max={100} step={1} value={state.volume}
                aria-label={t("player:volume")}
                onChange={(e) => setVolume(Number(e.target.value))}
                style={rangeFill(state.volume, 0, 100)}
                className="ctl-range pl-volume__range" />
            </div>
            <PlaybackRateControl
              apply={setSpeed} resetKey={itemId} state={speed}
              // Un seul panneau à la fois : pistes et épisodes se fermaient
              // déjà l'un l'autre, la vitesse s'ouvrait par-dessus les deux.
              otherPanelOpen={showSettings || showEpisodes}
              onOpen={() => { setShowSettings(() => false); setShowEpisodes(() => false); }}
            />
            {isEpisode && (
              <button type="button"
                onClick={() => { setShowEpisodes((p) => !p); setShowSettings(() => false); }}
                className="pl-btn" aria-expanded={showEpisodes}
                title={t("player:episodes")} aria-label={t("player:episodes")}
              >
                <EpisodesIcon />
              </button>
            )}
            {hasSettings && (
              <button type="button" onClick={() => { setShowSettings((p) => !p); setShowEpisodes(() => false); }} className="pl-btn" aria-expanded={showSettings} aria-label={t("player:settings")} title={t("player:settings")}>
                <GearIcon />
                {curSub !== null && <span className="pl-dot" aria-hidden />}
              </button>
            )}
            {/* Le PiP juste avant le plein écran — la place qu'il a chez YouTube,
                Netflix, Apple TV ou IINA (retour de Damien : plus de second
                bouton en haut à gauche, qui ne garde que « Quitter »). */}
            {onReduce && (
              <button type="button" onClick={() => onReduce()} className="pl-btn" title={`${t("player:pip.reduce")} (I)`} aria-label={t("player:pip.reduce")}>
                <ReduceIcon />
              </button>
            )}
            <button type="button" onClick={() => toggleFullscreen()} className="pl-btn" title={`${state.fullscreen ? t("player:exitFullscreen") : t("player:fullscreen")} (F)`} aria-label={state.fullscreen ? t("player:exitFullscreen") : t("player:fullscreen")}>
              {state.fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
