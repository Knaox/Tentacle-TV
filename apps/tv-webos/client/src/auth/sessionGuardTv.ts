import type { QueryClient } from "@tanstack/react-query";
import { acquireSocket, notifyUserChange, subscribeSocket } from "@tentacle-tv/api-client";
import { deviceToken2 } from "../bootstrap/fragmentToken";

/**
 * Vitalité de session, version appareil jumelé.
 *
 * Le garde du client web poste sur `/api/auth/refresh` avec `credentials:
 * "include"` et **sans corps**. Or le backend lit `body.token` ou le cookie,
 * jamais l'en-tête `Authorization` — et un appareil jumelé n'a pas de cookie.
 * Le résultat serait un 401, donc un verdict « session expirée », donc une
 * purge : **un téléviseur correctement jumelé se déconnecterait tout seul**.
 * Le backend, lui, sait parfaitement traiter un jeton d'appareil — il vérifie
 * la signature puis la non-révocation en base. Il suffit de le lui passer là
 * où il le lit.
 *
 * Contrat de déconnexion — un téléviseur ne rend JAMAIS sa session de
 * lui-même. Le seul motif de purge est la révocation explicite de l'appareil,
 * reconnaissable à `revoked: true` dans le 401 du refresh (la ligne
 * paired_devices a été supprimée : verdict de base de données, pas un aléa).
 * Et encore : deux verdicts espacés sont exigés, ceinture contre un proxy
 * farceur. Un 401 nu — Jellyfin qui refuse, secret en avarie, serveur à
 * moitié démarré — comme une panne réseau CONSERVENT la session : les écrans
 * d'état informent, et le téléviseur retrouvera ses esprits avec le serveur.
 *
 * Reste le cas d'un client sans jeton : au navigateur de développement, ou
 * pour un compte déjà connecté par cookie. Le garde y reprend le chemin web —
 * `credentials: "include"`, pas de corps. Refuser d'emblée revenait à purger
 * une session parfaitement valide avant le premier écran.
 */

export type VerdictSession = "ok" | "expiree" | "revoquee" | "injoignable";

const REVOCATION_CONFIRMATIONS = 2;
const RETRY_DELAY_MS = 5000;
const PROACTIVE_INTERVAL_MS = 12 * 60 * 60 * 1000;

interface ClientSession {
  setAccessToken(token: string | null): void;
  setOnAuthExpired(rappel: () => void): void;
}

interface SessionStorage {
  removeItem(key: string): void;
}

export async function revalidateSession(): Promise<VerdictSession> {
  // `deviceToken2` et non `deviceToken` : la même clé de stockage porte un
  // JWT d'appareil après un jumelage, et un jeton Jellyfin après une connexion
  // web. Le second, envoyé ici, se fait refuser — et ce refus était pris pour
  // une expiration.
  const token = deviceToken2();

  try {
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      // Deux chemins pour une seule question : y a-t-il un jeton d'appareil ?
      //
      // Avec, le backend le lit dans le corps — jamais dans l'en-tête. Sans,
      // il lit son cookie, et c'est le seul cas où le client tourne hors d'un
      // téléviseur, pour un compte déjà connecté. Poster `{ token: null }`
      // revenait à lui demander de refuser, puis à prendre ce refus pour une
      // expiration : la session était purgée avant même le premier écran.
      ...(token
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: token }),
          }
        : { credentials: "include" as const }),
    });

    if (response.status === 401) {
      // Seul `revoked: true` transforme un refus en verdict de révocation.
      const corps = (await response.json().catch(() => null)) as { revoked?: boolean } | null;
      return corps?.revoked === true ? "revoquee" : "expiree";
    }
    if (!response.ok) return "injoignable";

    // Double ceinture, reprise du garde web : un repli monopage renvoie
    // `index.html` avec un statut 200. Une réponse qui ne parle pas de jeton
    // n'est pas une réponse d'authentification.
    const corps = await response.text();
    return corps.includes("AccessToken") || corps.includes("token") ? "ok" : "injoignable";
  } catch {
    return "injoignable";
  }
}

export function installTvSessionGuard(deps: {
  client: ClientSession;
  storage: SessionStorage;
  queryClient: QueryClient;
}): void {
  const endSession = () => {
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

  // Routine unique des deux déclencheurs (401 accumulés, contrôle proactif) :
  // ne purge qu'après CONFIRMATIONS_REVOCATION verdicts « revoquee » espacés.
  // Tout autre verdict — 401 nu compris — laisse la session en place ; au
  // moindre doute (injoignable au second tour), on s'abstient aussi.
  let checkInProgress = false;
  const purgeIfRevocationConfirmed = async () => {
    if (checkInProgress) return;
    checkInProgress = true;
    try {
      let confirmations = 0;
      for (let tour = 0; tour < REVOCATION_CONFIRMATIONS; tour++) {
        const verdict = await revalidateSession();
        if (verdict === "ok") return;
        if (verdict === "expiree") {
          console.warn("[Tentacle:TV] refresh refusé sans révocation — session conservée");
          return;
        }
        if (verdict === "revoquee") {
          confirmations++;
          if (confirmations >= REVOCATION_CONFIRMATIONS) {
            endSession();
            return;
          }
        }
        // « injoignable » ou première révocation : temporiser puis re-vérifier.
        await waitFor(RETRY_DELAY_MS);
      }
    } finally {
      checkInProgress = false;
    }
  };

  deps.client.setOnAuthExpired(() => {
    void purgeIfRevocationConfirmed();
  });

  setInterval(() => {
    void purgeIfRevocationConfirmed();
  }, PROACTIVE_INTERVAL_MS);

  // Révocation IMMÉDIATE, même en pleine lecture : le serveur pousse
  // `session:revoked` par WebSocket à l'appareil supprimé. Le socket de
  // l'accueil ne suffit pas — il est refcompté et meurt dès qu'on quitte la
  // page (le lecteur n'en tient aucun). La garde prend donc SA référence,
  // jamais relâchée : elle vit aussi longtemps que l'app du téléviseur.
  const token = deviceToken2();
  if (token) {
    acquireSocket(token);
    subscribeSocket((message) => {
      if (message.type === "session:revoked") endSession();
    });
  }
}

function waitFor(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
