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
  return (
    <div className="ecran-jumelage">
      <p className="ecran-jumelage-sur-titre">Tentacle TV</p>
      <div className="ecran-jumelage-bloc">
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
