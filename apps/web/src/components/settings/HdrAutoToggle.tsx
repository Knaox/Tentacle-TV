import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsSection } from "@tentacle-tv/ui";
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
  const [active, setActive] = useState(hdrAutoActive);
  /** `null` tant que le natif n'a pas répondu — on n'affiche rien entre-temps. */
  const [supporte, setSupported] = useState<boolean | null>(null);

  const available = desktopPlatform() === "windows" && supportsMpv();

  // Le natif interroge la configuration d'affichage de Windows, seule source
  // qui dise si un écran SAIT faire du HDR — indépendamment du fait qu'il soit
  // allumé en HDR à cet instant.
  useEffect(() => {
    if (!available) return;
    let cancelled = false;
    void invoke<{ supporte: boolean }>("display_hdr_state")
      .then((e) => {
        if (!cancelled) setSupported(e.supporte);
      })
      .catch(() => {
        if (!cancelled) setSupported(false);
      });
    return () => {
      cancelled = true;
    };
  }, [available]);

  if (!available || supporte === null) return null;

  const changer = (next: boolean): void => {
    setHdrAuto(next);
    setActive(next);
  };

  return (
    <SettingsSection title={t("preferences:hdrAutoTitle")}>
      <div className="flex items-start justify-between gap-4 p-5">
        <p className="text-xs leading-relaxed text-content-tertiary">
          {supporte ? t("preferences:hdrAutoHint") : t("preferences:hdrAutoUnsupported")}
        </p>
        {/* Désactivé plutôt que masqué quand aucun écran ne sait faire du HDR :
            l'utilisateur voit que la fonction existe, et pourquoi elle ne lui
            est pas offerte — un réglage qui disparaît sans explication
            inquiète. */}
        <ToggleSwitch
          checked={supporte && active}
          onChange={changer}
          disabled={!supporte}
          label={t("preferences:hdrAutoTitle")}
        />
      </div>
    </SettingsSection>
  );
}
