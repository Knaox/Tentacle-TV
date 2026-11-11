import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { PlaybackRateControl } from "../../playerControls/PlaybackRateControl";
import { formatDuration } from "../../playerControls/utils";
import {
  VolumeIcon, MuteIcon, GearIcon,
  FullscreenIcon, ExitFullscreenIcon, PrevEpIcon, NextEpIcon, EpisodesIcon,
} from "../../PlayerIcons";
import { PauseIcon, PlayIcon } from "../../icons/transport";
import { ReduceIcon } from "../../../pictureInPicture/pipIcons";
import { rangeFill } from "../../../lib/rangeFill";
import { SkipBackGlyph, SkipForwardGlyph } from "./glassIcons";
import { GLASS_LENS_PROPS } from "../../../theme/glass";
import { PLAYER_MORPH } from "./playerGlassFusion";
import { GlassCapsule } from "./GlassCapsule";
import { popoverAnchorProps } from "./popoverOrigin";
import { useVolumeReveal } from "./useVolumeReveal";
import type { DesktopPlayerControlsProps } from "../desktopPlayerControls.types";

type GlassControlsRowProps = Pick<DesktopPlayerControlsProps,
  "state" | "itemId" | "isEpisode" | "hasSettings" | "hasNextEpisode" | "hasPreviousEpisode"
  | "showSettings" | "showEpisodes" | "setShowSettings" | "setShowEpisodes"
  | "onReduce" | "togglePause" | "skipBy" | "toggleMute" | "setVolume" | "setSpeed" | "toggleFullscreen"
  | "onNextEpisode" | "onPreviousEpisode" | "speed" | "visible" | "curSub">
  & {
    /** Position affichée (secondes FILM, glissement compris) et durée. */
    position: number;
    duration: number;
  };

/**
 * La rangée de commandes du lecteur en verre — la MÊME que celle de l'habillage sans verre
 * (`DesktopPlayerControls`, lot rf2) : la capsule du transport à gauche, le temps en texte,
 * puis la capsule du son et des réglages à droite. Mêmes boutons, même ordre, mêmes tailles
 * (40 px dans une capsule de 50) ; les capsules sont du verre natif au lieu d'une encre.
 *
 * Le survol d'un bouton est le disque clair de l'habillage sans verre : posé sur l'atténuation
 * noire de la capsule, il se compose juste (un blanc translucide seul sur la vidéo rendrait
 * gris — `playerGlass.css`). Lire / pause reste le disque d'ivoire, le seul plein.
 */
export function GlassControlsRow({
  state, itemId, isEpisode, hasSettings, hasNextEpisode, hasPreviousEpisode,
  showSettings, showEpisodes, setShowSettings, setShowEpisodes,
  onReduce, togglePause, skipBy, toggleMute, setVolume, setSpeed, toggleFullscreen,
  onNextEpisode, onPreviousEpisode, speed, visible, curSub, position, duration,
}: GlassControlsRowProps) {
  const { t } = useTranslation("player");
  const muted = state.muted || state.volume === 0;
  // Le curseur du volume ne paraît qu'au survol ou au focus de son groupe, comme sans verre ;
  // ici la page le SAIT (pas un `:hover` de feuille) : la capsule s'élargit, et sa région
  // native doit sauter avec elle au lieu de la rejoindre au ressort.
  const volume = useVolumeReveal();

  return (
    <div className="lgp-row">
      <GlassCapsule visible={visible} order={0}>
        {hasPreviousEpisode && (
          <button type="button" onClick={onPreviousEpisode} {...GLASS_LENS_PROPS} className="lgp-btn" title={`${t("player:previousEpisodeLabel")} (P)`} aria-label={t("player:previousEpisodeLabel")}><PrevEpIcon /></button>
        )}
        <button type="button" onClick={() => skipBy(-10)} {...GLASS_LENS_PROPS} className="lgp-btn" title={t("player:seekBackBy", { seconds: 10 })} aria-label={t("player:seekBackBy", { seconds: 10 })}>
          <SkipBackGlyph seconds={10} />
        </button>
        <button type="button" onClick={() => togglePause()} {...GLASS_LENS_PROPS} className="lgp-btn lgp-btn--main" aria-label={state.paused ? t("player:play") : t("player:pause")}>
          {state.paused ? <PlayIcon size={20} aria-hidden /> : <PauseIcon size={20} aria-hidden />}
        </button>
        <button type="button" onClick={() => skipBy(30)} {...GLASS_LENS_PROPS} className="lgp-btn" title={t("player:seekForwardBy", { seconds: 30 })} aria-label={t("player:seekForwardBy", { seconds: 30 })}>
          <SkipForwardGlyph seconds={30} />
        </button>
        {hasNextEpisode && (
          <button type="button" onClick={onNextEpisode} {...GLASS_LENS_PROPS} className="lgp-btn" title={`${t("player:nextEpisodeLabel")} (N)`} aria-label={t("player:nextEpisodeLabel")}><NextEpIcon /></button>
        )}
      </GlassCapsule>

      {/* Le temps : du TEXTE sur le voile, à la place qu'il a sans verre. */}
      <span className="lgp-time lgp-time--row lgp-nude" data-lgp-present={visible} style={{ "--lgp-order": 0 } as CSSProperties}>
        {formatDuration(position)} / {formatDuration(duration)}
      </span>
      <span className="lgp-grow" />

      <GlassCapsule visible={visible} order={1} instant={volume.reshaping}>
        <div className="lgp-volume" data-open={volume.open ? "true" : undefined} {...volume.handlers}>
          <button type="button" onClick={() => toggleMute()} {...GLASS_LENS_PROPS} className="lgp-btn" aria-label={muted ? t("player:unmute") : t("player:mute")} title={muted ? t("player:unmute") : t("player:mute")}>
            {/* Quatre états, comme sans verre : coupé, bas (≤33), moyen (≤66), fort. */}
            {muted ? <MuteIcon /> : <VolumeIcon bars={state.volume <= 33 ? 1 : state.volume <= 66 ? 2 : 3} />}
          </button>
          <input type="range" min={0} max={100} step={1} value={state.volume}
            aria-label={t("player:volume")}
            onChange={(e) => setVolume(Number(e.target.value))}
            style={rangeFill(state.volume, 0, 100)}
            className="lgp-range" />
        </div>
        <PlaybackRateControl
          apply={setSpeed} resetKey={itemId} state={speed}
          otherPanelOpen={showSettings || showEpisodes}
          onOpen={() => { setShowSettings(() => false); setShowEpisodes(() => false); }}
        />
        {isEpisode && (
          <button type="button" onClick={() => { setShowEpisodes((p) => !p); setShowSettings(() => false); }}
            {...GLASS_LENS_PROPS} {...popoverAnchorProps(PLAYER_MORPH.episodes)} className="lgp-btn" aria-expanded={showEpisodes} aria-label={t("player:episodes")} title={t("player:episodes")}>
            <EpisodesIcon />
          </button>
        )}
        {hasSettings && (
          <button type="button" onClick={() => { setShowSettings((p) => !p); setShowEpisodes(() => false); }}
            {...GLASS_LENS_PROPS} {...popoverAnchorProps(PLAYER_MORPH.tracks)} className="lgp-btn" aria-expanded={showSettings} aria-label={t("player:settings")} title={t("player:settings")}>
            <GearIcon />
            {curSub !== null && <span className="lgp-dot" aria-hidden />}
          </button>
        )}
        {onReduce && (
          <button type="button" onClick={() => onReduce()} {...GLASS_LENS_PROPS} className="lgp-btn" aria-label={t("player:pip.reduce")} title={`${t("player:pip.reduce")} (I)`}>
            <ReduceIcon />
          </button>
        )}
        <button type="button" onClick={() => toggleFullscreen()} {...GLASS_LENS_PROPS} className="lgp-btn"
          aria-label={state.fullscreen ? t("player:exitFullscreen") : t("player:fullscreen")} title={`${state.fullscreen ? t("player:exitFullscreen") : t("player:fullscreen")} (F)`}>
          {state.fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
        </button>
      </GlassCapsule>
    </div>
  );
}
