/**
 * Octave — le lecteur dit D'OÙ il lit : « Sur cet appareil » quand la source en
 * cours est la copie gardée (`fromDevice` de l'instantané), rien quand il lit en
 * flux. À côté du format, qu'il complète : un titre hors bibliothèque gardé est
 * bien de l'Opus (le son d'origine, gardé tel quel) — la marque dit seulement
 * qu'il vient du disque.
 *
 * Le glyphe hors ligne de Tentacle au ton de réussite, comme la marque d'une
 * rangée gardée (`KeptMark`) : en ICÔNE dans le dock (le mot en infobulle et pour
 * les lecteurs d'écran), en PASTILLE avec le mot dans le lecteur « en cours ».
 * Jamais la couleur seule. Hors de la portée du hors ligne (web, session de
 * profil) : rien.
 */

import { memo } from "react";
import { useTranslation } from "react-i18next";
import { DownloadGlyph } from "../../../downloads/DownloadGlyph";
import { usePlayerSelector } from "../player/OctavePlayerProvider";
import { useOfflineSurface } from "./offlineSurfaceContext";

export const FromDeviceMark = memo(function FromDeviceMark({ variant }: { variant: "icon" | "chip" }) {
  const { t } = useTranslation("musicOffline");
  const fromDevice = usePlayerSelector((s) => s.fromDevice);
  const surface = useOfflineSurface();
  if (!fromDevice || !surface.visible) return null;
  const hint = t("player.fromDeviceHint");
  if (variant === "icon") {
    return (
      <span className="inline-flex shrink-0 items-center text-status-success-fg" title={hint} data-octave-from-device>
        <DownloadGlyph done className="h-3.5 w-3.5" />
        <span className="sr-only">{t("player.fromDevice")}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-fill-subtle px-2 py-0.5 text-[11px] font-medium text-status-success-fg" title={hint} data-octave-from-device>
      <DownloadGlyph done className="h-3 w-3" />
      {t("player.fromDevice")}
    </span>
  );
});
