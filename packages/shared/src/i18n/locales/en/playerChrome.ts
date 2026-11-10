/**
 * The rest of the `player` namespace — the Nov. 2026 player chrome (web and desktop). Merged
 * into `player.ts`: no earlier key is renamed, these are ADDED.
 */
export default {
  // "Keep for the whole series" (Nov. 2026 redesign): the tracks menu line says in plain words
  // what is kept — audio, subtitles and their mode.
  keepForSeries: {
    title: "Keep for the whole series",
    aria: "Keep audio and subtitles for the whole series",
    line: "{{audio}}, {{subtitles}} — on every episode of {{series}}, online and offline.",
    thisSeries: "this series",
    fallback: "The audio and subtitles chosen here, on every episode, online and offline.",
    audio: "{{language}} audio",
    audioDefault: "Default audio",
    subtitlesOff: "subtitles off",
    subtitlesAlways: "{{language}} subtitles",
    subtitlesForced: "{{language}} subtitles, forced only",
    subtitlesSigns: "{{language}} subtitles, signs and songs only",
    subtitlesOn: "subtitles on",
  },
  // The player chrome (Nov. 2026 redesign).
  chrome: {
    tracksTitle: "Audio, subtitles and quality",
  },
} as const;
