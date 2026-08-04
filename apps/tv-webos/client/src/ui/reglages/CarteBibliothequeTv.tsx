import { useTranslation } from "react-i18next";
import type { ChoixTv } from "./PanneauChoixTv";

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
 * `PanneauChoixTv` qui porte la liste, et le confinement du focus qui va avec.
 */

export interface ReglageTv {
  cle: "audio" | "mode" | "sousTitres";
  intitule: string;
  valeur: string;
  choix: ChoixTv[];
  selection: string | null;
}

interface ProprietesCarteBibliothequeTv {
  nom: string;
  reglages: ReglageTv[];
  /** Vrai dès qu'une préférence existe : rien à réinitialiser sinon. */
  personnalisee: boolean;
  onOuvrir: (reglage: ReglageTv) => void;
  onReinitialiser: () => void;
}

export function CarteBibliothequeTv({
  nom,
  reglages,
  personnalisee,
  onOuvrir,
  onReinitialiser,
}: ProprietesCarteBibliothequeTv) {
  const { t } = useTranslation("preferences");

  return (
    <div className="carte-reglage-tv">
      <p className="text-xl font-semibold text-content-primary">{nom}</p>

      <div className="mt-5 flex flex-wrap gap-4">
        {reglages.map((reglage) => (
          <button
            key={reglage.cle}
            type="button"
            className="bouton-reglage-tv"
            onClick={() => onOuvrir(reglage)}
          >
            <span className="bouton-reglage-tv-intitule">{reglage.intitule}</span>
            <span className="bouton-reglage-tv-valeur">{reglage.valeur}</span>
          </button>
        ))}
      </div>

      {personnalisee && (
        <button
          type="button"
          className="mt-5 rounded-full border border-line-strong bg-fill-subtle px-6 py-3 text-base font-semibold text-content-primary"
          onClick={onReinitialiser}
        >
          {t("reset")}
        </button>
      )}
    </div>
  );
}
