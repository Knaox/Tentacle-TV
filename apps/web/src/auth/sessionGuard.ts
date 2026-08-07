import type { QueryClient } from "@tanstack/react-query";
import type { JellyfinClient, StorageAdapter } from "@tentacle-tv/api-client";
import { notifyUserChange } from "@tentacle-tv/api-client";
import { getBackendBase } from "../lib/backendBase";
import { setSessionExpired } from "./sessionState";

/**
 * Vitalité de la session web. Extrait de `main.tsx`.
 *
 * Principe : le client ne décide JAMAIS seul qu'une session est morte. Il
 * demande un verdict à /api/auth/refresh, qui tranche en interrogeant Jellyfin.
 * Un refus explicite (401) est le seul motif de déconnexion ; tout le reste —
 * Jellyfin en redémarrage, réseau coupé, backend injoignable — conserve la
 * session. C'est ce qui distingue « expirée » de « momentanément indisponible ».
 */

export type SessionVerdict = "ok" | "expired" | "unreachable";

/** Deux tentatives espacées de 5 s : un 401 isolé pendant un redémarrage de
 *  Jellyfin ne doit pas suffire à purger la session (symétrique du retry TV). */
const CONFIRM_ATTEMPTS = 2;
const CONFIRM_DELAY_MS = 5000;

/** Refresh proactif pour les onglets laissés ouverts : refait glisser le cookie
 *  bien avant son échéance. */
const PROACTIVE_INTERVAL_MS = 12 * 60 * 60 * 1000;

/** Anti-rafale sur la revalidation au retour de focus (alt-tab répétés). */
const FOCUS_THROTTLE_MS = 60 * 1000;

/**
 * Demande un verdict au backend et refait glisser le cookie au passage.
 *
 * L'URL est ABSOLUE, et c'est essentiel : en relatif, l'application de bureau
 * résout `/api/...` contre son origine applicative, dont le repli monopage
 * répond `index.html` en HTTP 200. Le verdict était alors « ok » quoi qu'il
 * arrive, et une session morte ne mourait jamais — l'utilisateur restait
 * « connecté » devant des pages qui ne chargeaient pas. Le contrôle du corps
 * de la réponse ci-dessous est la seconde ceinture contre ce même piège.
 */
export async function revalidateSession(token?: string | null): Promise<SessionVerdict> {
  try {
    // `token` : les clients SANS cookie — desktop, mobile, TV, où
    // `useCredentials` vaut faux — doivent le soumettre eux-mêmes. Sans lui, la
    // requête n'apporte AUCUNE preuve d'identité, et `/api/auth/refresh` répond
    // 401 « Token manquant » dès sa première ligne, avant même d'interroger
    // Jellyfin. Le verdict était donc « expirée » à tous les coups : le
    // desktop se déconnectait à chaque démarrage, dès que sa fenêtre prenait le
    // focus. Le navigateur, lui, n'a rien à joindre — son cookie httpOnly
    // voyage seul.
    const res = await fetch(`${getBackendBase()}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      ...(token
        ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }
        : {}),
    });
    if (res.status === 401) return "expired";
    if (!res.ok) return "unreachable";

    const body = await res.json().catch(() => null);
    return body && typeof body === "object" && "AccessToken" in body ? "ok" : "unreachable";
  } catch {
    return "unreachable";
  }
}

export interface SessionGuardDeps {
  client: JellyfinClient;
  storage: StorageAdapter;
  queryClient: QueryClient;
}

export function installSessionGuard({ client, storage, queryClient }: SessionGuardDeps): void {
  /** Purge locale. Pas de navigation impérative : le garde de routes d'App.tsx
   *  redirige de lui-même dès que `tentacle_user` disparaît. */
  const endSession = () => {
    client.setAccessToken(null);
    storage.removeItem("tentacle_token");
    storage.removeItem("tentacle_user");
    // Sans ce vidage, le cache persisté rejouerait les données du compte mort
    // sur l'écran de connexion puis au compte suivant.
    queryClient.clear();
    setSessionExpired(true);
    notifyUserChange();
  };

  /** Le jeton à soumettre au verdict, ou `null` quand un cookie s'en charge.
   *
   *  `client.getToken()` d'abord — c'est la valeur vive ; le stockage n'est
   *  qu'un repli pour le tout premier appel, avant que le client n'ait été
   *  réhydraté au démarrage. */
  const jetonDeSession = () =>
    client.useCredentials ? null : (client.getToken() ?? storage.getItem("tentacle_token"));

  /** Vrai UNIQUEMENT si l'expiration est confirmée : deux refus explicites
   *  espacés de 5 s. Tout le reste conserve la session — un verdict « ok », un
   *  backend injoignable, un Jellyfin en redémarrage.
   *
   *  Factorisé pour que TOUS les chemins de déconnexion passent par la même
   *  règle. Le retour de focus s'en dispensait et purgeait sur un seul 401,
   *  alors que le commentaire de ce fichier promettait l'inverse. */
  const expirationConfirmee = async (): Promise<boolean> => {
    for (let attempt = 0; attempt < CONFIRM_ATTEMPTS; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, CONFIRM_DELAY_MS));
      const verdict = await revalidateSession(jetonDeSession());
      if (verdict === "ok") {
        client.resetAuthState();
        return false;
      }
      if (verdict === "unreachable") return false; // panne passagère : on garde la session
    }
    return true;
  };

  client.setOnAuthExpired(async () => {
    if (await expirationConfirmee()) endSession();
  });

  // Revalidation au retour sur l'onglet. C'est le vrai filet : indépendante du
  // compteur de 401, elle constate l'expiration dès que l'utilisateur revient,
  // avant qu'il ne tombe sur une page vide. Et comme chaque passage refait
  // glisser le cookie, la session ne meurt pas tant qu'il revient — symétrique
  // du réveil `AppState "active"` du mobile.
  let lastFocusCheck = 0;
  const onFocus = () => {
    if (document.visibilityState === "hidden") return;
    if (!storage.getItem("tentacle_user")) return; // déjà déconnecté : rien à valider
    const now = Date.now();
    if (now - lastFocusCheck < FOCUS_THROTTLE_MS) return;
    lastFocusCheck = now;
    void expirationConfirmee().then((expiree) => {
      if (expiree) endSession();
    });
  };
  document.addEventListener("visibilitychange", onFocus);
  window.addEventListener("focus", onFocus);

  setInterval(() => { void revalidateSession(jetonDeSession()); }, PROACTIVE_INTERVAL_MS);
}
