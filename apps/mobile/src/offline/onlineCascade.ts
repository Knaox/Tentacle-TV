import type { QueryClient } from "@tanstack/react-query";

/** Ce que l'écran d'accueil montre en premier : rafraîchi tout de suite. */
const FIRST_WAVE = ["resume-items", "next-up", "featured"] as const;
/** Le reste de l'accueil et les compteurs : une seconde vague, le serveur ayant repris son souffle. */
const SECOND_WAVE = [
  "latest-items", "watchlist", "notifications", "libraries", "home-layout", "reco-page", "offline-capabilities",
] as const;
const SECOND_WAVE_DELAY_MS = 2_000;
/** Un lien qui bat (Wi-Fi qui hésite) ne doit pas relancer la cascade à chaque battement. */
const DEBOUNCE_MS = 5_000;

let lastRunAt = 0;
let pending: ReturnType<typeof setTimeout> | null = null;

/**
 * La cascade de retour en ligne, APRÈS la resynchronisation des lectures
 * faites hors ligne : ce que l'accueil montre en premier se rafraîchit tout de
 * suite, le reste deux secondes plus tard — jamais tout en rafale, et jamais
 * deux fois en cinq secondes. Les requêtes locales (`LOCAL_QUERY`) ne sont pas
 * concernées : elles ne dépendent pas du serveur.
 */
export function runOnlineCascade(queryClient: QueryClient, now = Date.now()): boolean {
  if (now - lastRunAt < DEBOUNCE_MS) return false;
  lastRunAt = now;
  for (const key of FIRST_WAVE) void queryClient.invalidateQueries({ queryKey: [key] });
  if (pending !== null) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    for (const key of SECOND_WAVE) void queryClient.invalidateQueries({ queryKey: [key] });
  }, SECOND_WAVE_DELAY_MS);
  return true;
}

/** Tests et remise à zéro. */
export function resetOnlineCascade(): void {
  lastRunAt = 0;
  if (pending !== null) clearTimeout(pending);
  pending = null;
}
