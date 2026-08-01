import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { desktopPlatform, invoke, supportsMpv } from "../../desktop/bridge";
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
  /** `null` tant que le natif n'a pas répondu — on n'affiche rien entre-temps. */
  const [supporte, setSupporte] = useState<boolean | null>(null);

  const disponible = desktopPlatform() === "windows" && supportsMpv();

  // Le natif interroge la configuration d'affichage de Windows, seule source
  // qui dise si un écran SAIT faire du HDR — indépendamment du fait qu'il soit
  // allumé en HDR à cet instant.
  useEffect(() => {
    if (!disponible) return;
    let annule = false;
    void invoke<{ supporte: boolean }>("display_hdr_state")
      .then((e) => {
        if (!annule) setSupporte(e.supporte);
      })
      .catch(() => {
        if (!annule) setSupporte(false);
      });
    return () => {
      annule = true;
    };
  }, [disponible]);

  if (!disponible || supporte === null) return null;

  const changer = (suivant: boolean): void => {
    setHdrAuto(suivant);
    setActif(suivant);
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-content-primary">{t("preferences:hdrAutoTitle")}</p>
        <p className="mt-1 text-xs leading-relaxed text-content-tertiary">
          {supporte ? t("preferences:hdrAutoHint") : t("preferences:hdrAutoUnsupported")}
        </p>
      </div>
      {/* Désactivé plutôt que masqué quand aucun écran ne sait faire du HDR :
          l'utilisateur voit que la fonction existe, et pourquoi elle ne lui est
          pas offerte — un réglage qui disparaît sans explication inquiète. */}
      <ToggleSwitch
        checked={supporte && actif}
        onChange={changer}
        disabled={!supporte}
        label={t("preferences:hdrAutoTitle")}
      />
    </div>
  );
}
