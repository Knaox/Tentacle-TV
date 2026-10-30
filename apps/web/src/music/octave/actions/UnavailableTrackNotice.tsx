/**
 * Octave (web, bureau) — l'AVIS d'un titre indisponible touché (`unavailableTrack.ts`, lot « fl ») : une rangée
 * grisée cliquée, une entrée de la file d'attente. Rien ne se lance, la lecture en cours continue ; deux clics
 * rapprochés ne disent la chose qu'une fois.
 */

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { onUnavailableTrack } from "@tentacle-tv/shared/octave";
import { useToast } from "../../../contexts/ToastContext";

/** Un même avis n'est pas redit avant ce délai (double clic, Entrée maintenue). */
const REPEAT_MS = 2_000;

export function UnavailableTrackNoticeHost(): null {
  const { t } = useTranslation("music");
  const toast = useToast();
  useEffect(() => {
    let last = 0;
    return onUnavailableTrack(() => {
      const now = Date.now();
      if (now - last < REPEAT_MS) return;
      last = now;
      toast.show("info", t("track.unavailableNotice"));
    });
  }, [t, toast]);
  return null;
}
