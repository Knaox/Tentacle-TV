import type { QueryClient } from "@tanstack/react-query";
import { notifyUserChange } from "@tentacle-tv/api-client";
import { jetonDAppareil } from "../amorce/jetonFragment";

/**
 * Vitalité de session, version appareil jumelé.
 *
 * Le garde du client web poste sur `/api/auth/refresh` avec `credentials:
 * "include"` et **sans corps**. Or le backend lit `body.token` ou le cookie,
 * jamais l'en-tête `Authorization` — et un appareil jumelé n'a pas de cookie.
 * Le résultat serait un 401, donc un verdict « session expirée », donc une
 * purge : **un téléviseur correctement jumelé se déconnecterait tout seul**.
 *
 * Le défaut est retardé, ce qui le rend d'autant plus coûteux : il n'apparaît
 * qu'au premier 401 de Jellyfin ou au rafraîchissement proactif de douze
 * heures. Aucun essai court ne le verrait.
 *
 * Le backend, lui, sait parfaitement traiter un jeton d'appareil — il vérifie
 * la signature puis la non-révocation en base. Il suffit de le lui passer là
 * où il le lit.
 *
 * Reste le cas symétrique, celui d'un client sans jeton : au navigateur de
 * développement, ou pour un compte déjà connecté par cookie. Le garde y reprend
 * le chemin web — `credentials: "include"`, pas de corps. Refuser d'emblée
 * revenait à purger une session parfaitement valide avant le premier écran.
 *
 * Le reste de la logique est celle du client web, et pour la même raison : le
 * client ne décide jamais seul qu'une session est morte. Un refus explicite
 * est le seul motif de déconnexion ; une panne réseau n'en est pas un.
 */

export type VerdictSession = "ok" | "expiree" | "injoignable";

const TENTATIVES = 2;
const DELAI_ENTRE_TENTATIVES_MS = 5000;
const INTERVALLE_PROACTIF_MS = 12 * 60 * 60 * 1000;

interface ClientSession {
  setAccessToken(jeton: string | null): void;
  setOnAuthExpired(rappel: () => void): void;
}

interface StockageSession {
  removeItem(cle: string): void;
}

export async function revaliderSession(): Promise<VerdictSession> {
  // `jetonDAppareil` et non `jetonAppareil` : la même clé de stockage porte un
  // JWT d'appareil après un jumelage, et un jeton Jellyfin après une connexion
  // web. Le second, envoyé ici, se fait refuser — et ce refus était pris pour
  // une expiration.
  const jeton = jetonDAppareil();

  try {
    const reponse = await fetch("/api/auth/refresh", {
      method: "POST",
      // Deux chemins pour une seule question : y a-t-il un jeton d'appareil ?
      //
      // Avec, le backend le lit dans le corps — jamais dans l'en-tête. Sans,
      // il lit son cookie, et c'est le seul cas où le client tourne hors d'un
      // téléviseur, pour un compte déjà connecté. Poster `{ token: null }`
      // revenait à lui demander de refuser, puis à prendre ce refus pour une
      // expiration : la session était purgée avant même le premier écran.
      ...(jeton
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: jeton }),
          }
        : { credentials: "include" as const }),
    });

    if (reponse.status === 401) return "expiree";
    if (!reponse.ok) return "injoignable";

    // Double ceinture, reprise du garde web : un repli monopage renvoie
    // `index.html` avec un statut 200. Une réponse qui ne parle pas de jeton
    // n'est pas une réponse d'authentification.
    const corps = await reponse.text();
    return corps.includes("AccessToken") || corps.includes("token") ? "ok" : "injoignable";
  } catch {
    return "injoignable";
  }
}

export function installerGardeSessionTv(deps: {
  client: ClientSession;
  storage: StockageSession;
  queryClient: QueryClient;
}): void {
  const terminerSession = () => {
    deps.client.setAccessToken(null);
    deps.storage.removeItem("tentacle_token");
    deps.storage.removeItem("tentacle_user");
    localStorage.removeItem("tentacle_token");
    localStorage.removeItem("tentacle_user");
    deps.queryClient.clear();
    // Pas de navigation impérative : la garde de routes redirige d'elle-même
    // dès que l'utilisateur mémorisé disparaît.
    notifyUserChange();
  };

  deps.client.setOnAuthExpired(() => {
    void (async () => {
      for (let tentative = 0; tentative < TENTATIVES; tentative++) {
        const verdict = await revaliderSession();
        if (verdict === "ok") return;
        if (verdict === "injoignable") {
          // Le serveur ne répond pas : on garde la session. Un téléviseur
          // rallumé avant sa box passerait sinon par un rejumelage complet.
          await attendre(DELAI_ENTRE_TENTATIVES_MS);
          continue;
        }
        terminerSession();
        return;
      }
    })();
  });

  setInterval(() => {
    void revaliderSession().then((verdict) => {
      if (verdict === "expiree") terminerSession();
    });
  }, INTERVALLE_PROACTIF_MS);
}

function attendre(millisecondes: number): Promise<void> {
  return new Promise((resoudre) => setTimeout(resoudre, millisecondes));
}
