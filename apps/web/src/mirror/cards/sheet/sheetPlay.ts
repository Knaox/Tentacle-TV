import { formatEpisodeCode, resumeState, type MediaItem, type NextEpisodeResult } from "@tentacle-tv/shared";

/**
 * Le bouton Lecture de la feuille d'appui long — en pur, testé à part.
 *
 * Même règle que le survol du bureau (`PosterTile`) : un film et un épisode
 * se lancent tels quels ; une SÉRIE lance l'épisode que son état de
 * visionnage désigne (`continue` : l'épisode entamé, `start` / `next` : le
 * suivant). Série terminée, ou état pas encore arrivé : la fiche plutôt
 * qu'un épisode au hasard.
 */

/** Ce qui se lance depuis une carte. Collection, saison, dossier : rien. */
const PLAYABLE_TYPES: ReadonlySet<string> = new Set(["Movie", "Episode", "Series", "Video"]);

export function isPlayableCard(item: Pick<MediaItem, "Type">): boolean {
  return PLAYABLE_TYPES.has(item.Type);
}

export interface SheetPlayPlan {
  /** L'item à lancer ; `null` : la fiche s'ouvre à la place. */
  targetId: string | null;
  /** « Reprendre » plutôt que « Lire ». */
  resume: boolean;
  /** « S2 · E5 » de l'épisode visé — `null` pour un film. */
  episodeCode: string | null;
  /** Avancement 0 → 1 de ce qui se lance, `null` s'il n'est pas entamé. */
  progress: number | null;
  /** Minutes restantes, `null` sans reprise mesurable. */
  remainingMinutes: number | null;
}

function codeOf(episode: MediaItem | null): string | null {
  if (!episode || episode.IndexNumber == null) return null;
  return formatEpisodeCode(episode.ParentIndexNumber, episode.IndexNumber);
}

export function sheetPlayPlan(item: MediaItem, watchState: NextEpisodeResult | undefined): SheetPlayPlan | null {
  if (!isPlayableCard(item)) return null;
  if (item.Type === "Series") {
    const episode = watchState && watchState.type !== "completed" ? watchState.episode : null;
    const state = episode ? resumeState(episode) : null;
    return {
      targetId: episode?.Id ?? null,
      resume: watchState?.type === "continue",
      episodeCode: codeOf(episode),
      progress: state?.progress ?? null,
      remainingMinutes: state?.remainingMinutes ?? null,
    };
  }
  const state = resumeState(item);
  return {
    targetId: item.Id,
    resume: state !== null,
    episodeCode: item.Type === "Episode" ? codeOf(item) : null,
    progress: state?.progress ?? null,
    remainingMinutes: state?.remainingMinutes ?? null,
  };
}

/**
 * Le libellé : le verbe du modèle (espace `cards`), puis l'épisode visé —
 * « Reprendre S2 · E5 », « Lire ». Le même format que la lecture d'une
 * recommandation, au survol du bureau comme ici.
 */
export function sheetPlayLabel(
  plan: Pick<SheetPlayPlan, "resume" | "episodeCode">,
  t: (key: "play" | "resume") => string,
): string {
  return [t(plan.resume ? "resume" : "play"), plan.episodeCode].filter(Boolean).join(" ");
}
