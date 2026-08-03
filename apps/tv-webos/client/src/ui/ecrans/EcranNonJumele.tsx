import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { oublierJumelage, revenirALaCoquille } from "../../auth/retourCoquille";

/**
 * L'écran qu'on voit quand l'appareil n'est plus jumelé.
 *
 * Il remplace la connexion et l'inscription : sur un téléviseur, il n'y a pas
 * de mot de passe à saisir. L'authentification vient du jumelage, qui se fait
 * dans la coquille — celle-ci parle au relais sans connaître l'adresse du
 * serveur, ce que le client ne peut pas faire puisqu'il en est servi.
 *
 * On y arrive dans un seul cas : le jeton a été révoqué ou le stockage vidé.
 * Le retour passe par `retourCoquille`, qui sait de combien de crans remonter —
 * un `history.back()` nu ne suffisait qu'au premier écran.
 */
export function EcranNonJumele() {
  const { t } = useTranslation("pairing");

  const revenirAuJumelage = useCallback(() => {
    oublierJumelage();
    revenirALaCoquille();
  }, []);

  // Même composition que la coquille, à laquelle ce bouton ramène : sur-titre
  // discret en haut, sujet à hauteur de regard, action en pilule. Les deux
  // écrans se suivent — ils ne doivent pas donner l'impression de changer
  // d'application au passage.
  // Cet écran vit hors de la disposition — la garde de routes le monte à la
  // place de la connexion. Il n'hérite donc d'aucun des fonds de l'application,
  // et c'est ce qui le faisait ressembler à une page d'erreur : un rectangle
  // noir avec trois éléments posés dessus. On remonte ici les motifs que le
  // reste du produit emploie, sans en inventer un seul — le dégradé ambiant de
  // la disposition, la barre d'accent des en-têtes de bibliothèque, et le
  // bouton principal blanc de la fiche média.
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
        <button type="button" onClick={revenirAuJumelage} className="ecran-jumelage-action">
          {t("tvNonJumeleAction")}
        </button>
      </div>
    </div>
  );
}

export default EcranNonJumele;
