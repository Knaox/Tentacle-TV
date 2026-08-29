import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { RelayStatusResponse } from "@tentacle-tv/api-client";
import { TentacleLogo } from "@/components/ui/TentacleLogo";
import { storePairing } from "../../bootstrap/fragmentToken";
import { usePairingRelay } from "../../auth/usePairingRelay";
import { LanguageToggleTv } from "./LanguageToggleTv";

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
 * via `.carte-pairing` — même carte, mêmes cases de code, même jauge. Un
 * utilisateur qui jumelle une LG après une Android TV doit reconnaître l'écran.
 *
 * Cet écran vit hors de la disposition — la garde de routes le monte à la place
 * de la connexion — donc il n'hérite d'aucun des fonds de l'application. Le
 * dégradé ambiant est remonté ici.
 */
export function UnpairedScreen() {
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
  const onConfirmed = useCallback((data: RelayStatusResponse) => {
    if (!data.token || !data.user) return;
    const user = { Id: data.user.id, Name: data.user.name };
    const target = (data.serverUrl ?? "").replace(/\/+$/, "");

    if (target && target !== window.location.origin) {
      window.location.href =
        `${target}/tv/#jeton=${encodeURIComponent(data.token)}` +
        `&u=${encodeURIComponent(user.Id)}` +
        `&n=${encodeURIComponent(user.Name)}`;
      return;
    }

    storePairing(data.token, user);
    window.location.href = `${window.location.origin}/tv/`;
  }, []);

  const pairing = usePairingRelay(onConfirmed);

  const minutes = Math.floor(pairing.remaining / 60);
  const seconds = pairing.remaining % 60;
  const part = pairing.duration > 0 ? pairing.remaining / pairing.duration : 0;

  return (
    <div className="ecran-jumelage">
      <div className="brand-ambient" aria-hidden />
      <LanguageToggleTv />

      <div className="carte-jumelage">
        <TentacleLogo size="xl" variant="bare" />

        {pairing.state === "code" && pairing.code && (
          <>
            <div className="code-cases">
              {pairing.code.split("").map((character, index) => (
                <span className="code-case" key={`${character}-${index}`}>
                  {character}
                </span>
              ))}
            </div>
            <p className="legende">{t("tvPairInstructions")}</p>
            <p className="rebours">
              {t("expiresIn", {
                time: `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`,
              })}
            </p>
            <div className="jauge">
              <div className="jauge-remplissage" style={{ width: `${part * 100}%` }} />
            </div>
          </>
        )}

        {pairing.state === "chargement" && <p className="legende">{t("tvPreparingCode")}</p>}

        {pairing.state === "expire" && (
          <>
            <p className="titre-etape">{t("codeExpired")}</p>
            <button type="button" className="bouton" onClick={pairing.regenerate}>
              {t("generateNewCode")}
            </button>
          </>
        )}

        {pairing.state === "erreur" && (
          <>
            <p className="titre-etape">{t("relayError")}</p>
            <button type="button" className="bouton" onClick={pairing.regenerate}>
              {t("tvRetry")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default UnpairedScreen;
