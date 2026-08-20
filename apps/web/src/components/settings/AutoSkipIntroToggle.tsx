import { useTranslation } from "react-i18next";
import { setAutoSkipIntro } from "../../lib/autoSkipIntro";
import { useAutoSkipIntro } from "../../hooks/useAutoSkipIntro";
import { ToggleSwitch } from "./ToggleSwitch";

/**
 * Sauter l'intro sans avoir à le demander à chaque épisode.
 *
 * Allumé par défaut : on enchaîne les épisodes le soir, et chaque saut reste
 * réfutable — la pilule compte trois secondes et porte une croix. Le refus,
 * lui, est mémorisé (cf. `lib/autoSkipIntro`).
 *
 * Réglage par appareil, comme la bascule HDR : on enchaîne les épisodes devant
 * le téléviseur du salon, pas forcément sur le portable.
 */
export function AutoSkipIntroToggle() {
  const { t } = useTranslation("preferences");
  const actif = useAutoSkipIntro();

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-content-primary">
          {t("preferences:autoSkipIntroTitle")}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-content-tertiary">
          {t("preferences:autoSkipIntroHint")}
        </p>
      </div>
      <ToggleSwitch
        checked={actif}
        onChange={setAutoSkipIntro}
        label={t("preferences:autoSkipIntroTitle")}
      />
    </div>
  );
}
