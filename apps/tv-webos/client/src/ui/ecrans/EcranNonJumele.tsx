import { useCallback } from "react";
import { useTranslation } from "react-i18next";

/**
 * L'écran qu'on voit quand l'appareil n'est plus jumelé.
 *
 * Il remplace la connexion et l'inscription : sur un téléviseur, il n'y a pas
 * de mot de passe à saisir. L'authentification vient du jumelage, qui se fait
 * dans la coquille — celle-ci parle au relais sans connaître l'adresse du
 * serveur, ce que le client ne peut pas faire puisqu'il en est servi.
 *
 * On y arrive dans un seul cas : le jeton a été révoqué ou le stockage vidé.
 * Le retour se fait par l'historique, seul chemin possible vers la coquille —
 * une page servie en HTTP ne peut pas naviguer vers `file://`.
 */
export function EcranNonJumele() {
  const { t } = useTranslation("pairing");

  const revenirAuJumelage = useCallback(() => {
    try {
      localStorage.removeItem("tentacle_token");
      localStorage.removeItem("tentacle_user");
    } catch {
      // Stockage indisponible : la coquille regénérera un code de toute façon.
    }
    window.history.back();
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-16 text-center">
      <h1 className="text-4xl font-semibold text-content-primary">{t("tvNonJumeleTitre")}</h1>
      <p className="max-w-3xl text-xl leading-relaxed text-content-secondary">
        {t("tvNonJumeleTexte")}
      </p>
      <button
        type="button"
        onClick={revenirAuJumelage}
        className="rounded-full bg-cta-primary-bg px-12 py-5 text-xl font-bold text-cta-primary-text"
      >
        {t("tvNonJumeleAction")}
      </button>
    </div>
  );
}

export default EcranNonJumele;
