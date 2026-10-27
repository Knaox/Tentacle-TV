import { useTranslation } from "react-i18next";
import { PlaybackRateControl } from "../../playerControls/PlaybackRateControl";
import {
  PlayIcon, PauseIcon, VolumeIcon, MuteIcon, GearIcon,
  FullscreenIcon, ExitFullscreenIcon, PrevEpIcon, NextEpIcon, EpisodesIcon,
} from "../../PlayerIcons";
import { ReduceIcon } from "../../../pictureInPicture/pipIcons";
import { rangeFill } from "../../../lib/rangeFill";
import { SkipBackGlyph, SkipForwardGlyph } from "./glassIcons";
import { GLASS_LENS_PROPS } from "../../../theme/glass";
import { PLAYER_MORPH } from "./playerGlassFusion";
import { popoverAnchorProps } from "./popoverOrigin";
import { GlassSurface } from "./GlassSurface";
import type { ReactNode } from "react";
import type { DesktopPlayerControlsProps } from "../desktopPlayerControls.types";

type GlassControlsRowProps = Pick<DesktopPlayerControlsProps,
  "state" | "itemId" | "isEpisode" | "hasSettings" | "hasNextEpisode" | "hasPreviousEpisode"
  | "showSettings" | "showEpisodes" | "setShowSettings" | "setShowEpisodes"
  | "onReduce" | "togglePause" | "skipBy" | "toggleMute" | "setVolume" | "setSpeed" | "toggleFullscreen"
  | "onNextEpisode" | "onPreviousEpisode" | "speed" | "visible">;

/**
 * La rangée de boutons : TROIS capsules séparées — le son à gauche, le
 * transport au centre (la première à paraître), les réglages à droite. L'ordre de droite est celui de l'habillage d'avant :
 * vitesse, épisodes, pistes, PiP, plein écran.
 *
 * Aucun fond au survol : sur le verre, c'est le symbole qui répond (ressort,
 * `playerGlass.css`) — un voile blanc translucide y rendrait gris.
 */
export function GlassControlsRow({
  state, itemId, isEpisode, hasSettings, hasNextEpisode, hasPreviousEpisode,
  showSettings, showEpisodes, setShowSettings, setShowEpisodes,
  onReduce, togglePause, skipBy, toggleMute, setVolume, setSpeed, toggleFullscreen,
  onNextEpisode, onPreviousEpisode, speed, visible,
}: GlassControlsRowProps) {
  const { t } = useTranslation("player");
  const muted = state.muted || state.volume === 0;

  return (
    <div className="lgp-groups">
      <Part visible={visible} className="lgp-row__side" order={2}>
        <button type="button" onClick={() => toggleMute()} {...GLASS_LENS_PROPS} className="lgp-btn" aria-label={muted ? t("player:unmute") : t("player:mute")} title={muted ? t("player:unmute") : t("player:mute")}>
          {/* Quatre états, comme l'habillage d'avant : coupé, bas, moyen, fort. */}
          {muted ? <MuteIcon /> : <VolumeIcon bars={state.volume <= 33 ? 1 : state.volume <= 66 ? 2 : 3} />}
        </button>
        <input type="range" min={0} max={100} step={1} value={state.volume}
          aria-label={t("player:volume")}
          onChange={(e) => setVolume(Number(e.target.value))}
          style={rangeFill(state.volume, 0, 100)}
          className="lgp-range" />
      </Part>

      <Part visible={visible} className="lgp-row__center" order={0}>
        {hasPreviousEpisode && (
          <button type="button" onClick={onPreviousEpisode} {...GLASS_LENS_PROPS} className="lgp-btn" aria-label={t("player:previousEpisodeLabel")} title={t("player:previousEpisode")}><PrevEpIcon /></button>
        )}
        <button type="button" onClick={() => skipBy(-10)} {...GLASS_LENS_PROPS} className="lgp-btn" aria-label={t("player:seekBackBy", { seconds: 10 })} title={t("player:seekBackBy", { seconds: 10 })}>
          <SkipBackGlyph seconds={10} />
        </button>
        <button type="button" onClick={() => togglePause()} {...GLASS_LENS_PROPS} className="lgp-btn lgp-btn--primary" aria-label={state.paused ? t("player:play") : t("player:pause")}>
          {state.paused ? <PlayIcon /> : <PauseIcon />}
        </button>
        <button type="button" onClick={() => skipBy(30)} {...GLASS_LENS_PROPS} className="lgp-btn" aria-label={t("player:seekForwardBy", { seconds: 30 })} title={t("player:seekForwardBy", { seconds: 30 })}>
          <SkipForwardGlyph seconds={30} />
        </button>
        {hasNextEpisode && (
          <button type="button" onClick={onNextEpisode} {...GLASS_LENS_PROPS} className="lgp-btn" aria-label={t("player:nextEpisodeLabel")} title={t("player:nextEpisode")}><NextEpIcon /></button>
        )}
      </Part>

      <Part visible={visible} className="lgp-row__side lgp-row__side--end" order={2}>
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
      </Part>
    </div>
  );
}

/**
 * Une partie de la rangée : sa PROPRE capsule de verre, qui se matérialise à
 * son rang (`order` : le transport d'abord, puis les côtés). Au niveau du
 * module : défini dans le rendu, il changerait d'identité à chaque battement de
 * position et remonterait toute la rangée.
 */
function Part({ visible, className, order, children }: { visible: boolean; className: string; order: number; children: ReactNode }) {
  return (
    <GlassSurface className={`lgp-group ${className}`} present={visible} materialize={order} adaptiveTone>
      <div className="lgp-content lgp-group__inner">{children}</div>
    </GlassSurface>
  );
}
