import { useState } from "react";
import type { QualityKey } from "@tentacle-tv/shared";
import { DesktopPlayerControls } from "../../components/player/DesktopPlayerControls";
import type { MpvState } from "../../hooks/useDesktopPlayer";
import { useDesktopSeekbar } from "../../hooks/useDesktopSeekbar";
import {
  LAB_AUDIO, LAB_EPISODE, LAB_QUALITY_PRESETS, LAB_SOURCE_QUALITY, LAB_SUBTITLES, labParam,
} from "./labFixtures";
import { LabStage } from "./labStage";

const noop = () => {};
const DURATION = 190;

/**
 * L'habillage du lecteur de BUREAU (`DesktopPlayerControls`, hors verre natif) sur une image
 * fixe : mêmes capsules que le web, le volume de mpv (0–100), le PiP, les raccourcis en infobulle.
 */
export function LabPlayerDesktop() {
  const [paused, setPaused] = useState(false);
  const [position, setPosition] = useState(88);
  const [volume, setVolume] = useState(70);
  const [muted, setMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [quality, setQuality] = useState<QualityKey>("original");
  const [audio, setAudio] = useState(1);
  const [subtitle, setSubtitle] = useState<number | null>(4);
  const [kept, setKept] = useState(true);
  const state = { paused, muted, volume, fullscreen: false, position, duration: DURATION } as unknown as MpvState;
  const seekbar = useDesktopSeekbar({
    dur: DURATION, paused, isDirectPlay: true, item: LAB_EPISODE, mediaSourceId: undefined,
    effectiveMpvOffset: { current: 0 }, seek: (s: number) => { setPosition(s); return Promise.resolve(); },
    setPause: (p: boolean) => { setPaused(p); return Promise.resolve(); },
  } as unknown as Parameters<typeof useDesktopSeekbar>[0]);

  return (
    <LabStage>
      <DesktopPlayerControls
        visible={labParam("masque") !== "1"} state={state}
        title="Caminandes" subtitle="S1 · É2 — Gran Dillama"
        isDirectPlay isEpisode useLocalEpisodes={false} item={LAB_EPISODE} itemId={LAB_EPISODE.Id}
        displayAudio={LAB_AUDIO} displaySubs={LAB_SUBTITLES.map((track) => ({ ...track, url: "" }))} curAudio={audio} curSub={subtitle}
        currentQuality={quality} sourceQuality={LAB_SOURCE_QUALITY} qualityPresets={LAB_QUALITY_PRESETS}
        hasSettings hasNextEpisode hasPreviousEpisode
        dur={DURATION} actualPos={position} displayProgress={seekbar.dragProgress ?? position / DURATION} bufProg={0.62}
        seekbar={seekbar}
        showSettings={showSettings} showEpisodes={showEpisodes}
        setShowSettings={(fn) => setShowSettings(fn)} setShowEpisodes={(fn) => setShowEpisodes(fn)}
        closePanels={{ settings: () => setShowSettings(false), episodes: () => setShowEpisodes(false) }}
        goBack={noop} onReduce={noop} togglePause={() => setPaused((p) => !p)}
        skipBy={(d) => setPosition((v) => Math.max(0, Math.min(DURATION, v + d)))}
        toggleMute={() => setMuted((m) => !m)} setVolume={setVolume} setSpeed={noop} toggleFullscreen={noop}
        handleAudioChange={setAudio} handleSubtitleChange={setSubtitle} onQualityChange={setQuality}
        applyToSeries={{
          checked: kept, pending: false, toggle: setKept,
          choice: { audioLang: "fre", subtitleLang: subtitle === null ? null : "fre", subtitleMode: subtitle === null ? "none" : subtitle === 6 ? "forced" : "always" },
        }}
        onNextEpisode={noop} onPreviousEpisode={noop}
      />
    </LabStage>
  );
}
