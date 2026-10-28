/**
 * Octave — « La suite arrive : le serveur prépare les titres à son rythme. Prêt dans ~2 h. » (bureau), sous
 * l'en-tête de « Sur cet appareil » : la file du hors ligne en masse de l'extension prépare un titre à la fois
 * et dit quand revenir ; le moteur relance à l'heure dite. Règle commune au mobile (`serverPacingOf`).
 */

import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { KeptMusicTrack } from "@tentacle-tv/offline-core";
import { readyInWords, serverPacingOf } from "@tentacle-tv/offline-core/music";

export function ServerPacingNotice({ tracks }: { tracks: readonly KeptMusicTrack[] | null }) {
  const { t } = useTranslation("musicOffline");
  const { pacing, readyInMs } = serverPacingOf(tracks, Date.now());
  if (!pacing) return null;
  const ready = readyInMs === null ? null : readyInWords(readyInMs);
  return (
    <p className="flex items-center gap-2 px-2 text-sm text-content-tertiary" aria-live="polite" data-server-pacing>
      <Clock className="h-4 w-4 shrink-0" aria-hidden />
      <span>
        {t("transfers.serverPacing")}
        {ready && ` ${t(ready.key, { count: ready.count })}.`}
      </span>
    </p>
  );
}
