import { useState } from "react";
import { useTranslation } from "react-i18next";
import { desktopPlatform, supportsMpv } from "../../desktop/bridge";
import { hdrAutoActive, setHdrAuto } from "../../lib/hdrPreference";
import { ToggleSwitch } from "./ToggleSwitch";

/**
 * Bascule automatique de l'écran en HDR pendant la lecture.
 *
 * # Pourquoi c'est une option, et pourquoi elle est éteinte par défaut
 *
 * Changer le mode d'un écran coûte une à deux secondes de noir, le temps que
 * la liaison se resynchronise. Tous les lecteurs qui le proposent — madVR,
 * Kodi, Plex — en font une option, et Plex la laisse éteinte pour cette
 * raison. L'écueil symétrique compte autant : un écran laissé en HDR fait
 * paraître délavé TOUT le contenu SDR de Windows.
 *
 * Sans bascule, mpv retombe sur le tone-mapping, qui donne une image correcte
 * sur un écran SDR. On ne perd donc rien d'essentiel à laisser éteint.
 *
 * N'apparaît que là où la bascule a un sens : un bureau Windows doté du lecteur
 * natif.
 */
export function HdrAutoToggle() {
  const { t } = useTranslation("preferences");
  const [actif, setActif] = useState(hdrAutoActive);

  if (desktopPlatform() !== "windows" || !supportsMpv()) return null;

  const changer = (suivant: boolean): void => {
    setHdrAuto(suivant);
    setActif(suivant);
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-content-primary">{t("preferences:hdrAutoTitle")}</p>
        <p className="mt-1 text-xs leading-relaxed text-content-tertiary">
          {t("preferences:hdrAutoHint")}
        </p>
      </div>
      <ToggleSwitch checked={actif} onChange={changer} label={t("preferences:hdrAutoTitle")} />
    </div>
  );
}
