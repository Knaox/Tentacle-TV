import { useTranslation } from "react-i18next";
import type { ChoiceTv } from "./ChoicePanelTv";

/**
 * Les trois réglages de piste d'une bibliothèque.
 *
 * Langue audio, mode de sous-titres, langue de sous-titres — exactement ceux du
 * client web et d'`apps/tv`, ni plus ni moins. Ce sont les seuls réglages de
 * lecture qui appartiennent à l'utilisateur : la qualité et le flux direct sont
 * décidés par l'administrateur du serveur, et le remux est automatique.
 *
 * Trois boutons plutôt que trois `<select>`. Chacun dit ce qu'il règle et où il
 * en est, et l'ouverture du choix est la seule chose qu'il fait — c'est
 * `ChoicePanelTv` qui porte la liste, et le confinement du focus qui va avec.
 */

export interface SettingTv {
  key: "audio" | "mode" | "sousTitres";
  label: string;
  value: string;
  choice: ChoiceTv[];
  selection: string | null;
}

interface LibraryCardTvProps {
  name: string;
  settings: SettingTv[];
  /** Vrai dès qu'une préférence existe : rien à réinitialiser sinon. */
  custom: boolean;
  onOpen: (setting: SettingTv) => void;
  onReset: () => void;
}

export function LibraryCardTv({
  name,
  settings,
  custom,
  onOpen,
  onReset,
}: LibraryCardTvProps) {
  const { t } = useTranslation("preferences");

  return (
    <div className="carte-reglage-tv">
      <p className="text-xl font-semibold text-content-primary">{name}</p>

      <div className="mt-5 flex flex-wrap gap-4">
        {settings.map((setting) => (
          <button
            key={setting.key}
            type="button"
            className="bouton-reglage-tv"
            onClick={() => onOpen(setting)}
          >
            <span className="bouton-reglage-tv-intitule">{setting.label}</span>
            <span className="bouton-reglage-tv-valeur">{setting.value}</span>
          </button>
        ))}
      </div>

      {custom && (
        <button
          type="button"
          className="mt-5 rounded-full border border-line-strong bg-fill-subtle px-6 py-3 text-base font-semibold text-content-primary"
          onClick={onReset}
        >
          {t("reset")}
        </button>
      )}
    </div>
  );
}
