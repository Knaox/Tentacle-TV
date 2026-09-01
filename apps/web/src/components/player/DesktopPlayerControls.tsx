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
  BackIcon, PlayIcon, PauseIcon, VolumeIcon, MuteIcon, GearIcon,
  FullscreenIcon, ExitFullscreenIcon, PrevEpIcon, NextEpIcon, EpisodesIcon,
} from "../PlayerIcons";
import type { AudioTrack, SubtitleTrack } from "./videoPlayer.types";
import type { ApplyToSeriesControl } from "../../hooks/useApplyToSeries";
import type { MediaItem, QualityKey, QualityPreset, SourceQuality } from "@tentacle-tv/shared";
import type { MpvState } from "../../hooks/useDesktopPlayer";
import type { useDesktopSeekbar } from "../../hooks/useDesktopSeekbar";
import { rangeFill } from "../../lib/rangeFill";

interface DesktopPlayerControlsProps {
  visible: boolean;
  state: MpvState;
  title: string;
  subtitle?: string;
  isDirectPlay: boolean;
  isEpisode: boolean;
  /** Hors ligne (auto OU manuel — les requêtes serveur sont alors
   *  court-circuitées) : panneau d'épisodes servi par les téléchargements.
   *  En ligne, panneau serveur COMPLET même en lecture locale : ouvrir le
   *  sélecteur est une action utilisateur, une requête est assumée — le
   *  « zéro réseau » ne vaut que pour la lecture passive. */
  useLocalEpisodes: boolean;
  item?: MediaItem;
  itemId?: string;
  displayAudio: AudioTrack[];
  displaySubs: SubtitleTrack[];
  curAudio: number;
  curSub: number | null;
  currentQuality: QualityKey;
  sourceQuality?: SourceQuality;
  qualityPresets?: readonly QualityPreset[];
  /** Badge « Auto » sur le palier actif du sélecteur. */
  autoQualityActive?: boolean;
  hasSettings: boolean;
  hasNextEpisode?: boolean;
  hasPreviousEpisode?: boolean;
  dur: number;
  actualPos: number;
  displayProgress: number;
  bufProg: number;
  seekbar: ReturnType<typeof useDesktopSeekbar>;
  showSettings: boolean;
  showEpisodes: boolean;
  setShowSettings: (fn: (p: boolean) => boolean) => void;
  setShowEpisodes: (fn: (p: boolean) => boolean) => void;
  closePanels: { settings: () => void; episodes: () => void };
  goBack: () => void;
  togglePause: () => void;
  skipBy: (delta: number) => void;
  toggleMute: () => void;
  setVolume: (v: number) => void;
  /** Vitesse de lecture mpv (propriété `speed`). */
  setSpeed: (v: number) => void;
  toggleFullscreen: () => void;
  handleAudioChange: (index: number) => void;
  handleSubtitleChange: (index: number | null) => void;
  onQualityChange?: (key: QualityKey) => void;
  applyToSeries?: ApplyToSeriesControl;
  onNextEpisode?: () => void;
  onPreviousEpisode?: () => void;
}

/**
 * La surface de la page a-t-elle un alpha par pixel ?
 *
 * Elle décide de ce qu'on a le droit de poser derrière les barres : les deux
 * dégradés là où ils ne coûtent rien (Windows, web), et RIEN du tout là où toute
 * couche composée sur la fenêtre de mpv se paie — voir le commentaire du rendu.
 */
const WITHOUT_ALPHA = !surfaceHasAlpha();

/**
 * Barres de contrôle du player desktop : top bar (retour, titre, badge mpv dev)
 * et bottom bar (seekbar, transport, volume mpv 0-100, sélecteurs de pistes et
 * d'épisodes, fullscreen). Extraction mécanique de DesktopPlayer.
 *
 * Barres superposées à la vidéo (gradient bg-black/70 → transparent) →
 * text-white/bg-white volontairement en dur, identiques dans les deux thèmes.
 * (TrackSelector / EpisodeSelectorPanel qu'elles ouvrent sont eux tokenisés :
 * ce sont des panneaux détachés, pas posés sur la vidéo.)
 */
export function DesktopPlayerControls({
  visible, state, title, subtitle, isDirectPlay, isEpisode, useLocalEpisodes, item, itemId,
  displayAudio, displaySubs, curAudio, curSub, currentQuality, sourceQuality, qualityPresets, autoQualityActive,
  hasSettings, hasNextEpisode, hasPreviousEpisode,
  dur, actualPos, displayProgress, bufProg, seekbar,
  showSettings, showEpisodes, setShowSettings, setShowEpisodes, closePanels,
  goBack, togglePause, skipBy, toggleMute, setVolume, setSpeed, toggleFullscreen,
  handleAudioChange, handleSubtitleChange, onQualityChange, applyToSeries,
  onNextEpisode, onPreviousEpisode,
}: DesktopPlayerControlsProps) {
  const { t } = useTranslation("player");
  const { dragProgress } = seekbar;

  return (
    <div className={`pointer-events-none absolute inset-0 z-10 flex flex-col justify-between transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}>
      {/* ⚠️ Ce qui peut se poser sur l'image de la surface à alpha est ÉTROIT,
          et chaque frontière a été mesurée :

           - le voile plein cadre assombrissait 8 % de l'image ENTIÈRE. Sur une
             image strictement fixe, une bande de 631 lignes changeait de 10,2
             niveaux en moyenne à l'instant où il s'en allait — un tiers de
             l'écran qui saute ;
           - l'estomper au lieu de le démonter ne réglait rien : l'opacité du
             conteneur multiplie son alpha, qui passait sous le seuil où Chromium
             rogne la couche, et le trait net que ce voile devait supprimer
             revenait à chaque extinction des contrôles ;
           - une ombre de TEXTE, elle, dessinait un contour visible autour du
             minutage et de la barre de progression, et le même artefact à
             l'apparition comme à l'extinction.

          Ce qui a survécu à l'essai du 30.08, et pourquoi : le dégradé NOIR
          revient sur la surface à alpha, ALLÉGÉ (45 % contre 70 % ailleurs) et
          cantonné aux zones des barres — c'est lui qui détache texte et
          icônes. Il n'est ni le voile plein cadre ni une ombre floutée : le
          noir est invariant par prémultiplication (noir × alpha reste noir),
          c'est LA couleur que cette surface compose juste. Le blanc partiel,
          lui, s'y délave vers le gris — les `text-white/50-70` rendent un peu
          plus gris qu'ailleurs, et posés sur le voile sombre, c'est assumé.

          Un contour de texte à copies pleines (façon sous-titres) a aussi été
          essayé ce jour-là : composition irréprochable, mais JUGÉ LAID —
          l'utilisateur a tranché, le voile seul suffit. Sa pierre tombale est
          dans `videoShadow.ts` ; ne pas le remettre.

          Windows et le web gardent leurs deux dégradés pleins, au pixel près :
          leur surface n'a pas d'alpha par pixel, rien de ceci n'y est jamais
          apparu. */}
      {/* Top bar */}
      <div className="pointer-events-auto" onClick={(e) => e.stopPropagation()}>
        <div className={`bg-gradient-to-b ${WITHOUT_ALPHA ? "from-black/70" : "from-black/45"} to-transparent px-6 pb-10 pt-5`}>
          <div className="flex items-center gap-4">
            <button onClick={() => goBack()} className="rounded-full p-2 hover:bg-white/10"><BackIcon /></button>
            <div>
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              {subtitle && <p className="text-sm text-white/50">{subtitle}</p>}
            </div>
            {import.meta.env.DEV && (
              <div className="ml-auto flex items-center gap-2 rounded-full bg-[rgba(var(--brand-rgb),0.3)] px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-[var(--brand)]" />
                <span className="text-xs text-[var(--brand-light)]">mpv{isDirectPlay ? "" : " (transcode)"}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="pointer-events-auto" onClick={(e) => e.stopPropagation()}>
        <div className={`relative bg-gradient-to-t ${WITHOUT_ALPHA ? "from-black/70" : "from-black/45"} to-transparent px-6 pb-5 pt-10`}>
          <AnimatePresence>
            {showSettings && hasSettings && (
              <TrackSelector
                audioTracks={displayAudio} subtitleTracks={displaySubs}
                currentAudio={curAudio} currentSubtitle={curSub}
                currentQuality={currentQuality} sourceQuality={sourceQuality} qualityPresets={qualityPresets}
                autoQualityActive={autoQualityActive}
                onAudioChange={handleAudioChange} onSubtitleChange={handleSubtitleChange}
                onQualityChange={onQualityChange}
                applyToSeries={applyToSeries}
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

          {/* Progress bar with buffer + drag scrub */}
          <DesktopSeekbar seekbar={seekbar} displayProgress={displayProgress} bufProg={bufProg} />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {hasPreviousEpisode && (
                <button onClick={onPreviousEpisode} className="rounded-full p-2 hover:bg-white/10" title="(P)"><PrevEpIcon /></button>
              )}
              <button onClick={() => skipBy(-10)} className="rounded-full p-1.5 hover:bg-white/10" title="-10s">
                <span className="text-xs font-bold text-white/70">-10</span>
              </button>
              <button onClick={() => togglePause()} className="rounded-full p-2 hover:bg-white/10">
                {state.paused ? <PlayIcon /> : <PauseIcon />}
              </button>
              <button onClick={() => skipBy(30)} className="rounded-full p-1.5 hover:bg-white/10" title="+30s">
                <span className="text-xs font-bold text-white/70">+30</span>
              </button>
              {hasNextEpisode && (
                <button onClick={onNextEpisode} className="rounded-full p-2 hover:bg-white/10" title="(N)"><NextEpIcon /></button>
              )}
              <div className="group/vol flex items-center gap-2">
                <button onClick={() => toggleMute()} className="rounded-full p-2 hover:bg-white/10">
                  {/* Quatre états qui suivent le volume : coupé, bas (≤33),
                      moyen (≤66), fort — comme un OSD système. */}
                  {state.muted || state.volume === 0
                    ? <MuteIcon />
                    : <VolumeIcon bars={state.volume <= 33 ? 1 : state.volume <= 66 ? 2 : 3} />}
                </button>
                {/* Le curseur porte enfin le DÉGRADÉ, comme la barre de
                    progression — `accent-color` ne savait prendre qu'une
                    couleur unie, et l'agent utilisateur peignait la piste en
                    gris clair sur fond noir. Tout est dans `.ctl-range`. */}
                <input type="range" min={0} max={100} step={1} value={state.volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  style={rangeFill(state.volume, 0, 100)}
                  className="ctl-range hidden w-20 group-hover/vol:block" />
              </div>
              <span className="text-sm text-white/60">{formatDuration(dragProgress != null ? dragProgress * dur : actualPos)} / {formatDuration(dur)}</span>
            </div>
            <div className="flex items-center gap-2">
              <PlaybackRateControl
                apply={setSpeed} resetKey={itemId} buttonClass="p-2"
                // Un seul panneau à la fois : pistes et épisodes se fermaient
                // déjà l'un l'autre, la vitesse s'ouvrait par-dessus les deux.
                otherPanelOpen={showSettings || showEpisodes}
                onOpen={() => { setShowSettings(() => false); setShowEpisodes(() => false); }}
              />
              {isEpisode && (
                <button
                  onClick={() => { setShowEpisodes((p) => !p); setShowSettings(() => false); }}
                  className={`rounded-full p-2 hover:bg-white/10 ${showEpisodes ? "bg-white/10" : ""}`}
                  title={t("player:episodes")}
                  aria-label={t("player:episodes")}
                >
                  <EpisodesIcon />
                </button>
              )}
              {hasSettings && (
                <button onClick={() => { setShowSettings((p) => !p); setShowEpisodes(() => false); }} className="rounded-full p-2 hover:bg-white/10"><GearIcon /></button>
              )}
              <button onClick={() => toggleFullscreen()} className="rounded-full p-2 hover:bg-white/10" title="(F)">
                {state.fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
