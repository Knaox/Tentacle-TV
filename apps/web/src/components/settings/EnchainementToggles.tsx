import { useTranslation } from "react-i18next";
import {
  magasinCarteASuivre,
  magasinDecompteEnchainement,
} from "../../lib/enchainementEpisode";
import { useCarteASuivre, useDecompteEnchainement } from "../../hooks/useEnchainementEpisode";
import { ToggleSwitch } from "./ToggleSwitch";

/**
 * Ce que le lecteur a le droit de faire à la fin d'un épisode.
 *
 * Deux bascules et non une, parce que ce sont deux gestes distincts : montrer
 * la suite, et la lancer. On peut vouloir de l'une sans l'autre — voir la
 * fiche sans jamais partir tout seul est même la combinaison la plus demandée.
 *
 * Réglages par appareil, comme le saut d'intro et la bascule HDR : on enchaîne
 * les épisodes devant le téléviseur du salon, pas forcément sur le portable.
 */

interface BasculeProps {
  titre: string;
  aide: string;
  actif: boolean;
  onChange: (actif: boolean) => void;
}

function Bascule({ titre, aide, actif, onChange }: BasculeProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-content-primary">{titre}</p>
        <p className="mt-1 text-xs leading-relaxed text-content-tertiary">{aide}</p>
      </div>
      <ToggleSwitch checked={actif} onChange={onChange} label={titre} />
    </div>
  );
}

/** La petite fiche « à suivre », proposée pendant le générique de fin. */
export function UpNextCardToggle() {
  const { t } = useTranslation("preferences");
  return (
    <Bascule
      titre={t("preferences:upNextCardTitle")}
      aide={t("preferences:upNextCardHint")}
      actif={useCarteASuivre()}
      onChange={(actif) => magasinCarteASuivre.definir(actif)}
    />
  );
}

/** L'enchaînement automatique, sur la fiche comme sur l'écran de fin. */
export function UpNextCountdownToggle() {
  const { t } = useTranslation("preferences");
  return (
    <Bascule
      titre={t("preferences:upNextCountdownTitle")}
      aide={t("preferences:upNextCountdownHint")}
      actif={useDecompteEnchainement()}
      onChange={(actif) => magasinDecompteEnchainement.definir(actif)}
    />
  );
}
