/**
 * Ce qu'une ligne de transfert dit d'elle-même : son débit, le temps qu'il
 * reste, et le décompte avant une relance automatique.
 *
 * Le bureau n'affichait rien de tout cela — une barre et deux tailles. Le
 * moteur mesure pourtant le débit et l'échéance depuis toujours
 * (`progressStore`), et l'échéance de relance vit en base : il n'y avait qu'à
 * les lire. Miroir de `offline/formatTransfer.ts` du téléphone, avec les clés
 * du bureau.
 */

import { useEffect, useState } from "react";
import type { TFunction } from "i18next";
import { formatBytes } from "./presets";

/** Le débit, en unités de taille par seconde — « 4,20 Gio/s » n'arrivera pas. */
export function formatRate(t: TFunction, bytesPerSecond: number | null): string | null {
  if (bytesPerSecond === null || bytesPerSecond <= 0) return null;
  return t("downloads:transferRate", { rate: formatBytes(bytesPerSecond) });
}

/**
 * Le temps restant, arrondi à ce qu'on peut honnêtement promettre : une
 * estimation à la seconde près sur un transfert d'une heure serait fausse dès
 * la seconde suivante.
 */
export function formatTimeLeft(t: TFunction, etaMs: number | null): string | null {
  if (etaMs === null || !Number.isFinite(etaMs) || etaMs <= 0) return null;
  const totalMinutes = Math.round(etaMs / 60_000);
  if (totalMinutes < 1) return t("downloads:timeLeftSeconds");
  if (totalMinutes < 60) return t("downloads:timeLeftMinutes", { minutes: totalMinutes });
  return t("downloads:timeLeftHours", {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  });
}

function remaining(nextRetryAt: number | null): number | null {
  if (nextRetryAt === null) return null;
  return Math.max(0, Math.ceil((nextRetryAt - Date.now()) / 1_000));
}

/**
 * Secondes avant la relance automatique, `null` s'il n'y en a pas.
 *
 * Le minuteur ne tourne QUE pendant qu'une échéance court : une ligne prête ou
 * en attente ne fait pas battre l'écran une fois par seconde.
 */
export function useRetryCountdown(nextRetryAt: number | null): number | null {
  const [seconds, setSeconds] = useState<number | null>(() => remaining(nextRetryAt));

  useEffect(() => {
    setSeconds(remaining(nextRetryAt));
    if (nextRetryAt === null) return;
    const timer = setInterval(() => setSeconds(remaining(nextRetryAt)), 1_000);
    return () => clearInterval(timer);
  }, [nextRetryAt]);

  return seconds;
}
