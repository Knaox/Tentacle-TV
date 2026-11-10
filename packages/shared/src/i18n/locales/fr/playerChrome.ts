/**
 * La suite de l'espace `player` — l'habillage du lecteur de la refonte de nov. 2026 (web et
 * bureau). Fusionnée dans `player.ts` : aucune clé d'avant n'y est renommée, celles-ci s'AJOUTENT.
 */
export default {
  // « Garder pour toute la série » (refonte de nov. 2026) : la ligne du menu des pistes dit EN
  // TOUTES LETTRES ce qui est gardé — l'audio, les sous-titres et leur mode.
  keepForSeries: {
    title: "Garder pour toute la série",
    aria: "Garder l'audio et les sous-titres pour toute la série",
    line: "{{audio}}, {{subtitles}} — à chaque épisode de {{series}}, en ligne comme hors ligne.",
    thisSeries: "cette série",
    fallback: "L'audio et les sous-titres choisis ici, à chaque épisode, en ligne comme hors ligne.",
    audio: "Audio {{language}}",
    audioDefault: "Audio par défaut",
    subtitlesOff: "sous-titres désactivés",
    subtitlesAlways: "sous-titres {{language}}",
    subtitlesForced: "sous-titres {{language}}, forcés seulement",
    subtitlesSigns: "sous-titres {{language}}, panneaux et chansons seulement",
    subtitlesOn: "sous-titres activés",
  },
  // L'habillage du lecteur (refonte de nov. 2026).
  chrome: {
    tracksTitle: "Audio, sous-titres et qualité",
  },
} as const;
