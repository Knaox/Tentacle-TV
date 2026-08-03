import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { plateformePeutQuitter, quitterVersLaCoquille } from "../../auth/retourCoquille";

/**
 * L'écran qu'on voit quand l'appareil n'est plus jumelé.
 *
 * Il remplace la connexion et l'inscription : sur un téléviseur, il n'y a pas
 * de mot de passe à saisir. L'authentification vient du jumelage, qui se fait
 * dans la coquille — celle-ci parle au relais sans connaître l'adresse du
 * serveur, ce que le client ne peut pas faire puisqu'il en est servi.
 *
 * **Le bouton dit maintenant ce qu'il fait.** Il annonçait « Revenir au
 * jumelage » et tentait de remonter l'historique jusqu'à la coquille ; faute
 * d'y parvenir, il rendait la main à la plateforme — ce qui ferme
 * l'application. On voyait donc la page se fermer après avoir demandé à revenir
 * quelque part. Le client ne PEUT pas ramener à l'écran de code : seule une
 * relance y revient. Le bouton quitte donc, et l'écran explique la relance.
 *
 * Il n'est rendu que là où la plateforme sait quitter. Au navigateur de
 * développement il n'apparaît pas : un bouton sans effet est pire qu'un bouton
 * absent, on le vise, on appuie, et on conclut que rien ne répond.
 *
 * Cet écran vit hors de la disposition — la garde de routes le monte à la place
 * de la connexion — donc il n'hérite d'aucun des fonds de l'application. Les
 * motifs sont remontés ici : le dégradé ambiant de la disposition, la barre
 * d'accent des en-têtes de bibliothèque, et le bouton principal de la fiche.
 */
export function EcranNonJumele() {
  const { t } = useTranslation("pairing");
  const peutQuitter = plateformePeutQuitter();

  const quitter = useCallback(() => {
    quitterVersLaCoquille();
  }, []);

  return (
    <div className="ecran-jumelage">
      <div className="brand-ambient" aria-hidden />
      <div className="ecran-jumelage-bloc">
        <p className="ecran-jumelage-sur-titre">
          <span className="ecran-jumelage-barre" aria-hidden />
          Tentacle TV
        </p>
        <h1 className="ecran-jumelage-titre">{t("tvNonJumeleTitre")}</h1>
        <p className="ecran-jumelage-texte">{t("tvNonJumeleTexte")}</p>
        <p className="ecran-jumelage-texte">{t("tvNonJumeleRelance")}</p>
        {peutQuitter && (
          <button type="button" onClick={quitter} className="ecran-jumelage-action">
            {t("tvQuitter")}
          </button>
        )}
      </div>
    </div>
  );
}

export default EcranNonJumele;
