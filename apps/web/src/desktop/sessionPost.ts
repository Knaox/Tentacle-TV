/**
 * Télémétrie de lecture postée par la couche NATIVE.
 *
 * # Pourquoi elle ne peut pas partir de la page
 *
 * Ces appels visent Jellyfin EN DIRECT, et c'est délibéré : le proxy
 * `/api/jellyfin` remplace le jeton de l'utilisateur par la clé admin, et sans
 * contexte utilisateur Jellyfin 10.11 ne sait plus à qui attribuer le
 * playstate. Passer par le proxy, c'est perdre la position de reprise.
 *
 * Or la page vit sous une origine de schéma applicatif (`tentacle://app`).
 * Aucun serveur Jellyfin n'a de raison de l'autoriser : le préflight échoue,
 * `playbackTransport` marque la voie directe morte, et TOUTE la session bascule
 * sur le proxy — sans rien casser à l'écran, et sans plus rien enregistrer.
 *
 * Le processus principal, lui, n'est pas soumis au CORS. Aucune configuration
 * à demander aux serveurs des utilisateurs, et rien de desserré côté page —
 * contrairement à l'injection d'en-têtes CORS, qui ouvrirait la lecture des
 * réponses cross-origin aux greffons.
 */

import { invoke } from "./bridge";
import { desktopKind } from "./detect";

/**
 * La coquille sait-elle poster elle-même ?
 *
 * Tauri répond NON, et c'est correct : son origine est une origine HTTP
 * ordinaire, que la configuration CORS d'un Jellyfin peut couvrir. Le `fetch`
 * de la page y fonctionne, il n'y a rien à contourner.
 */
export function supportsNativeSessionPost(): boolean {
  return (
    desktopKind() === "electron" &&
    (window.tentacle?.capabilities.includes("jellyfin_session_post") ?? false)
  );
}

/**
 * Poste et rend le statut HTTP.
 *
 * ⚠️ Un échec doit LEVER, jamais rendre un statut inventé : l'appelant
 * distingue un 401 — qui demande un jeton frais — d'une panne de transport, qui
 * fait basculer sur le proxy. Rendre `0` ou `500` sur une coupure réseau
 * condamnerait la voie directe pour toute la session.
 */
export async function nativeSessionPost(
  baseUrl: string,
  path: string,
  token: string,
  authHeader: string,
  body: string,
): Promise<number> {
  const { status } = await invoke<{ status: number }>("jellyfin_session_post", {
    baseUrl,
    path,
    token,
    authHeader,
    body,
  });
  return status;
}
