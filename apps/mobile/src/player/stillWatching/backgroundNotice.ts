/**
 * « Vous regardez encore ? » quand l'ÉCRAN n'est pas vu — app en arrière-plan,
 * image dans l'image d'iOS, lecture vers AirPlay le téléphone posé. Décision de
 * Damien (20/10) : le compteur CONTINUE (comme au bureau, la question tombe au
 * bout de la durée choisie, puis la pause), et une notification le dit, puisque
 * l'encart ne se voit pas. Module PUR, testé sous vitest.
 *
 * - `ask` : la question est posée, l'app n'est pas au premier plan ;
 * - `paused` : la pause est tombée sans réponse, l'app n'est pas au premier plan ;
 * - null : rien à notifier (l'encart se voit, ou rien n'est en cours) — une
 *   notification déjà posée se retire.
 */
export type StillWatchingNotice = "ask" | "paused" | null;

export function stillWatchingNotice(phase: "none" | "asking" | "paused", appState: string): StillWatchingNotice {
  if (appState === "active") return null;
  if (phase === "asking") return "ask";
  if (phase === "paused") return "paused";
  return null;
}

/** Le `type` de la notification locale : le toucher ne fait que ramener l'app (le lecteur y est). */
export const STILL_WATCHING_NOTICE_TYPE = "still_watching";
