import { useState } from "react";
import type { QualityKey } from "@tentacle-tv/shared";
import { PlayerControls } from "../../components/PlayerControls";
import type { ApplyToSeriesControl } from "../../hooks/useApplyToSeries";
import type { TrackChoice } from "../../hooks/trackChoice";
import {
  LAB_AUDIO, LAB_EPISODE, LAB_MOVIE, LAB_QUALITY_PRESETS, LAB_SOURCE_QUALITY, LAB_SUBTITLES, labParam,
} from "./labFixtures";
import { LabStage } from "./labStage";

const noop = () => {};

/** Ce que les pistes du labo enregistreraient : des langues et un mode, comme `trackChoiceOf`. */
function labChoice(audio: number, subtitle: number | null): TrackChoice {
  const audioLang = audio === 2 ? "eng" : audio === 3 ? "spa" : "fre";
  if (subtitle === null) return { audioLang, subtitleLang: null, subtitleMode: "none" };
  return { audioLang, subtitleLang: subtitle === 5 ? "eng" : "fre", subtitleMode: subtitle === 6 ? "forced" : "always" };
}

/**
 * L'habillage du lecteur WEB (`PlayerControls`) sur une image fixe. `?etat=film` : un film (ni
 * épisodes, ni « toute la série ») ; `?serie=1` : « Garder pour toute la série » déjà allumé ;
 * `?masque=1` : contrôles masqués (plus rien dans le DOM).
 */
export function LabPlayerWeb() {
  const movie = labParam("etat") === "film";
  const [playing, setPlaying] = useState(true);
  const [time, setTime] = useState(88);
  const [volume, setVolume] = useState(0.7);
  const [audio, setAudio] = useState(1);
  const [subtitle, setSubtitle] = useState<number | null>(labParam("st") === "forces" ? 6 : null);
  const [quality, setQuality] = useState<QualityKey>("original");
  const [kept, setKept] = useState(labParam("serie") === "1");
  const [fullscreen, setFullscreen] = useState(false);
  const item = movie ? LAB_MOVIE : LAB_EPISODE;
  const duration = movie ? 888 : 190;
  const applyToSeries: ApplyToSeriesControl | undefined = movie
    ? undefined
    : { checked: kept, pending: false, toggle: setKept, choice: labChoice(audio, subtitle) };

  return (
    <LabStage>
      <div className="absolute inset-0 z-20">
        <PlayerControls
          visible={labParam("masque") !== "1"}
          playing={playing} currentTime={time} duration={duration} buffered={0.62} volume={volume} fullscreen={fullscreen}
          item={item} itemId={item.Id}
          title={movie ? "Sintel" : "Caminandes"} subtitle={movie ? undefined : "S1 · É2 — Gran Dillama"}
          audioTracks={LAB_AUDIO} subtitleTracks={LAB_SUBTITLES}
          currentAudio={audio} currentSubtitle={subtitle}
          currentQuality={quality} sourceQuality={LAB_SOURCE_QUALITY} qualityPresets={LAB_QUALITY_PRESETS}
          autoQualityActive={labParam("auto") === "1"}
          hasNextEpisode={!movie} hasPreviousEpisode={!movie}
          onTogglePlay={() => setPlaying((p) => !p)} onSeek={setTime} onSkip={(d) => setTime((v) => Math.max(0, Math.min(duration, v + d)))}
          onVolumeChange={setVolume} onToggleMute={() => setVolume((v) => (v === 0 ? 0.7 : 0))}
          onToggleFullscreen={() => setFullscreen((f) => !f)} onBack={noop}
          onAudioChange={setAudio} onSubtitleChange={setSubtitle} onQualityChange={setQuality}
          onNextEpisode={noop} onPreviousEpisode={noop}
          applyToSeries={applyToSeries} onPlaybackRateChange={noop}
        />
      </div>
    </LabStage>
  );
}
