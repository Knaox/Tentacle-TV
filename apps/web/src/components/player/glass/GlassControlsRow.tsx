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
import { GlassMorphSeed } from "./GlassMorphSeed";
import { PLAYER_MORPH } from "./playerGlassFusion";
import { GlassOrb } from "./GlassOrb";
import type { CSSProperties } from "react";
import { useWatchTogether } from "../../../watchTogether/WatchTogetherProvider";
import type { DesktopPlayerControlsProps } from "../desktopPlayerControls.types";

type GlassControlsRowProps = Pick<DesktopPlayerControlsProps,
  "state" | "itemId" | "isEpisode" | "hasSettings" | "hasNextEpisode" | "hasPreviousEpisode"
  | "showSettings" | "showEpisodes" | "setShowSettings" | "setShowEpisodes"
  | "onReduce" | "togglePause" | "skipBy" | "toggleMute" | "setVolume" | "setSpeed" | "toggleFullscreen"
  | "onNextEpisode" | "onPreviousEpisode" | "speed" | "visible">;

/**
 * La rangée de boutons, façon tvOS 26 (lot lg8) : des RONDS de verre, chacun sa
 * forme native — le son à gauche (son rond, puis le curseur NU sur le voile), le
 * transport au centre (le rond de lecture, plus grand, est le pivot du bas : les
 * autres s'y replient), les réglages à droite. L'ordre de droite est celui de
 * l'habillage d'avant : vitesse, épisodes, pistes, PiP, plein écran.
 *
 * Aucun fond au survol : c'est le verre qui répond (son cœur atténué se resserre,
 * `playerGlassDim.css`) et le symbole (ressort de la lentille) — un voile blanc
 * translucide y rendrait gris.
 */
export function GlassControlsRow({
  state, itemId, isEpisode, hasSettings, hasNextEpisode, hasPreviousEpisode,
  showSettings, showEpisodes, setShowSettings, setShowEpisodes,
  onReduce, togglePause, skipBy, toggleMute, setVolume, setSpeed, toggleFullscreen,
  onNextEpisode, onPreviousEpisode, speed, visible,
}: GlassControlsRowProps) {
  const { t } = useTranslation("player");
  // En séance de groupe, la vitesse se retire (`PlaybackRateControl`) : pas de rond vide.
  const { isInGroup } = useWatchTogether();
  const muted = state.muted || state.volume === 0;

  return (
    <div className="lgp-groups">
      <div className="lgp-volume">
        <GlassOrb visible={visible} order={1}>
          <button type="button" onClick={() => toggleMute()} {...GLASS_LENS_PROPS} className="lgp-btn" aria-label={muted ? t("player:unmute") : t("player:mute")} title={muted ? t("player:unmute") : t("player:mute")}>
            {/* Quatre états, comme l'habillage d'avant : coupé, bas, moyen, fort. */}
            {muted ? <MuteIcon /> : <VolumeIcon bars={state.volume <= 33 ? 1 : state.volume <= 66 ? 2 : 3} />}
          </button>
        </GlassOrb>
        <input type="range" min={0} max={100} step={1} value={state.volume}
          aria-label={t("player:volume")}
          onChange={(e) => setVolume(Number(e.target.value))}
          data-lgp-present={visible}
          style={{ ...rangeFill(state.volume, 0, 100), "--lgp-order": 1 } as CSSProperties}
          className="lgp-range lgp-nude" />
      </div>

      <div className="lgp-cluster">
        {hasPreviousEpisode && (
          <GlassOrb visible={visible}>
            <button type="button" onClick={onPreviousEpisode} {...GLASS_LENS_PROPS} className="lgp-btn" aria-label={t("player:previousEpisodeLabel")} title={t("player:previousEpisode")}><PrevEpIcon /></button>
          </GlassOrb>
        )}
        <GlassOrb visible={visible}>
          <button type="button" onClick={() => skipBy(-10)} {...GLASS_LENS_PROPS} className="lgp-btn" aria-label={t("player:seekBackBy", { seconds: 10 })} title={t("player:seekBackBy", { seconds: 10 })}>
            <SkipBackGlyph seconds={10} />
          </button>
        </GlassOrb>
        <GlassOrb visible={visible} primary pivot>
          <button type="button" onClick={() => togglePause()} {...GLASS_LENS_PROPS} className="lgp-btn lgp-btn--primary" aria-label={state.paused ? t("player:play") : t("player:pause")}>
            {state.paused ? <PlayIcon /> : <PauseIcon />}
          </button>
        </GlassOrb>
        <GlassOrb visible={visible}>
          <button type="button" onClick={() => skipBy(30)} {...GLASS_LENS_PROPS} className="lgp-btn" aria-label={t("player:seekForwardBy", { seconds: 30 })} title={t("player:seekForwardBy", { seconds: 30 })}>
            <SkipForwardGlyph seconds={30} />
          </button>
        </GlassOrb>
        {hasNextEpisode && (
          <GlassOrb visible={visible}>
            <button type="button" onClick={onNextEpisode} {...GLASS_LENS_PROPS} className="lgp-btn" aria-label={t("player:nextEpisodeLabel")} title={t("player:nextEpisode")}><NextEpIcon /></button>
          </GlassOrb>
        )}
      </div>

      <div className="lgp-cluster lgp-cluster--end">
        {!isInGroup && (
          <GlassOrb visible={visible} order={1}>
            <PlaybackRateControl
              apply={setSpeed} resetKey={itemId} state={speed}
              otherPanelOpen={showSettings || showEpisodes}
              onOpen={() => { setShowSettings(() => false); setShowEpisodes(() => false); }}
            />
          </GlassOrb>
        )}
        {isEpisode && (
          <GlassOrb visible={visible} order={1}>
            <button type="button" onClick={() => { setShowEpisodes((p) => !p); setShowSettings(() => false); }}
              {...GLASS_LENS_PROPS} className="lgp-btn" aria-expanded={showEpisodes} aria-label={t("player:episodes")} title={t("player:episodes")}>
              <GlassMorphSeed id={PLAYER_MORPH.episodes} />
              <EpisodesIcon />
            </button>
          </GlassOrb>
        )}
        {hasSettings && (
          <GlassOrb visible={visible} order={1}>
            <button type="button" onClick={() => { setShowSettings((p) => !p); setShowEpisodes(() => false); }}
              {...GLASS_LENS_PROPS} className="lgp-btn" aria-expanded={showSettings} aria-label={t("player:settings")} title={t("player:settings")}>
              <GlassMorphSeed id={PLAYER_MORPH.tracks} />
              <GearIcon />
            </button>
          </GlassOrb>
        )}
        {onReduce && (
          <GlassOrb visible={visible} order={1}>
            <button type="button" onClick={() => onReduce()} {...GLASS_LENS_PROPS} className="lgp-btn" aria-label={t("player:pip.reduce")} title={`${t("player:pip.reduce")} (I)`}>
              <ReduceIcon />
            </button>
          </GlassOrb>
        )}
        <GlassOrb visible={visible} order={1}>
          <button type="button" onClick={() => toggleFullscreen()} {...GLASS_LENS_PROPS} className="lgp-btn"
            aria-label={state.fullscreen ? t("player:exitFullscreen") : t("player:fullscreen")} title={`${state.fullscreen ? t("player:exitFullscreen") : t("player:fullscreen")} (F)`}>
            {state.fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
          </button>
        </GlassOrb>
      </div>
    </div>
  );
}
