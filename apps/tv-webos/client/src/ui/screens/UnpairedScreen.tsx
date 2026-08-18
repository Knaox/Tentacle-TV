import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { RelayStatusResponse } from "@tentacle-tv/api-client";
import { TentacleLogo } from "@/components/ui/TentacleLogo";
import { rangerJumelage } from "../../bootstrap/fragmentToken";
import { useJumelageRelais } from "../../auth/usePairingRelay";
import { BasculeLangueTv } from "./LanguageToggleTv";

/**
 * L'écran de jumelage du client.
 *
 * Il remplace la connexion : sur un téléviseur il n'y a pas de mot de passe à
 * saisir, l'authentification vient du jumelage.
 *
 * **Il jumelle pour de bon, il ne renvoie plus ailleurs.** Il expliquait de
 * quitter l'application et de la relancer pour retrouver l'écran de code de la
 * coquille — et le bouton fermait donc l'application juste après qu'on lui ait
 * demandé de revenir quelque part. Deux raisons de ne plus faire ça. La
 * première est mesurée : depuis une page servie en HTTP, aucun retour arrière
 * n'atteint la coquille, la garde de session les ravale tous et repose sur cet
 * écran-ci avec un `replace`. La seconde est plus simple — à ce moment précis
 * le SERVEUR EST CONNU, c'est celui qui sert la page. Le détour par la coquille
 * n'avait de raison d'être que tant qu'on ignorait où il était.
 *
 * Le dessin est celui de `RelayCodeDisplay` d'Android TV, valeur pour valeur,
 * via `.carte-jumelage` — même carte, mêmes cases de code, même jauge. Un
 * utilisateur qui jumelle une LG après une Android TV doit reconnaître l'écran.
 *
 * Cet écran vit hors de la disposition — la garde de routes le monte à la place
 * de la connexion — donc il n'hérite d'aucun des fonds de l'application. Le
 * dégradé ambiant est remonté ici.
 */
export function EcranNonJumele() {
  const { t } = useTranslation("pairing");

  /**
   * Le serveur confirmé n'est pas forcément celui qui sert cette page.
   *
   * Jumeler depuis un appareil branché sur un AUTRE serveur est légitime — on
   * change de serveur sans repasser par la coquille. Dans ce cas on navigue
   * vers lui en portant le jeton dans le FRAGMENT, exactement comme la
   * coquille : un JWT sans expiration n'a rien à faire dans une chaîne de
   * requête, qui finit dans les journaux d'accès et les en-têtes `Referer`.
   *
   * Même serveur : on range et on recharge. Le rechargement n'est pas un
   * raccourci — la garde de session, le client Jellyfin et les requêtes en
   * cache lisent le jeton au démarrage, et un simple changement de route les
   * laisserait sur l'ancien.
   */
  const surConfirmation = useCallback((donnees: RelayStatusResponse) => {
    if (!donnees.token || !donnees.user) return;
    const utilisateur = { Id: donnees.user.id, Name: donnees.user.name };
    const cible = (donnees.serverUrl ?? "").replace(/\/+$/, "");

    if (cible && cible !== window.location.origin) {
      window.location.href =
        `${cible}/tv/#jeton=${encodeURIComponent(donnees.token)}` +
        `&u=${encodeURIComponent(utilisateur.Id)}` +
        `&n=${encodeURIComponent(utilisateur.Name)}`;
      return;
    }

    rangerJumelage(donnees.token, utilisateur);
    window.location.href = `${window.location.origin}/tv/`;
  }, []);

  const jumelage = useJumelageRelais(surConfirmation);

  const minutes = Math.floor(jumelage.restant / 60);
  const secondes = jumelage.restant % 60;
  const part = jumelage.duree > 0 ? jumelage.restant / jumelage.duree : 0;

  return (
    <div className="ecran-jumelage">
      <div className="brand-ambient" aria-hidden />
      <BasculeLangueTv />

      <div className="carte-jumelage">
        <TentacleLogo size="xl" variant="bare" />

        {jumelage.etat === "code" && jumelage.code && (
          <>
            <div className="code-cases">
              {jumelage.code.split("").map((caractere, rang) => (
                <span className="code-case" key={`${caractere}-${rang}`}>
                  {caractere}
                </span>
              ))}
            </div>
            <p className="legende">{t("tvPairInstructions")}</p>
            <p className="rebours">
              {t("expiresIn", {
                time: `${minutes}:${secondes < 10 ? "0" : ""}${secondes}`,
              })}
            </p>
            <div className="jauge">
              <div className="jauge-remplissage" style={{ width: `${part * 100}%` }} />
            </div>
          </>
        )}

        {jumelage.etat === "chargement" && <p className="legende">{t("tvPreparingCode")}</p>}

        {jumelage.etat === "expire" && (
          <>
            <p className="titre-etape">{t("codeExpired")}</p>
            <button type="button" className="bouton" onClick={jumelage.regenerer}>
              {t("generateNewCode")}
            </button>
          </>
        )}

        {jumelage.etat === "erreur" && (
          <>
            <p className="titre-etape">{t("relayError")}</p>
            <button type="button" className="bouton" onClick={jumelage.regenerer}>
              {t("tvRetry")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default EcranNonJumele;
