/**
 * Ressources locales (affiches, méta JSON, tuiles trickplay, sous-titres)
 * servies à la page sous une troisième origine du schéma applicatif.
 *
 * # Ce que ça remplace
 *
 * Côté Tauri, un SERVEUR HTTP loopback complet (`downloads/localserver.rs`) :
 * port éphémère, jeton aléatoire vérifié à chaque requête, en-tête CORS, un
 * thread, et un entitlement réseau sous Mac App Store. Il existait parce que le
 * protocole asset de Tauri est buggé et ignoré en développement.
 *
 * Electron n'a pas ce problème : `protocol.handle` est déjà en service et sert
 * déjà deux origines. Une troisième, `tentacle://local`, remplace tout cela —
 * et supprime au passage la surface d'attaque qu'est un port ouvert sur la
 * machine, que n'importe quel autre processus local peut atteindre.
 *
 * # Pourquoi il n'y a plus de jeton
 *
 * Le jeton protégeait le PORT, pas les fichiers : sur loopback, tout processus
 * local pouvait frapper le serveur. Une origine de schéma privilégié n'est
 * atteignable que depuis nos propres pages — le contrôle est structurel, il n'y
 * a plus rien à deviner. La constante ci-dessous ne subsiste que pour le
 * contrat de la page.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { safeJoin } from "./downloads/paths";

/** Hôte réservé aux ressources locales, distinct de l'application. */
export const LOCAL_HOST = "local";

/**
 * Jeton vestigial.
 *
 * ⚠️ Il doit rester NON VIDE : `apps/web/src/downloads/localFiles.ts` teste
 * `base?.base && base?.token` et prendrait une chaîne vide pour un échec —
 * aucune affiche locale ne s'afficherait plus, sans le moindre message. C'est
 * le seul rôle qui lui reste, et c'est ce qui évite de toucher `apps/web`.
 */
export const LOCAL_ASSET_TOKEN = "local";

/**
 * Types servis, liste FERMÉE.
 *
 * Un média ne transite JAMAIS par la webview : il est lu par mpv, depuis son
 * chemin absolu. Ouvrir `.mkv` ici ferait passer des gigaoctets par le pont
 * pour rien.
 */
const MIME: Readonly<Record<string, string>> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".json": "application/json",
  ".srt": "text/plain; charset=utf-8",
  ".vtt": "text/plain; charset=utf-8",
  ".ass": "text/plain; charset=utf-8",
  ".ssa": "text/plain; charset=utf-8",
};

/** Type d'une ressource, ou `null` si elle n'est pas au menu. */
export function mimeFor(rel: string): string | null {
  return MIME[path.extname(rel).toLowerCase()] ?? null;
}

/**
 * Sert une ressource locale.
 *
 * `pathname` n'est PAS décodé : `safeJoin` refuse le moindre `%`, exactement
 * comme le faisait `safe_join` côté Rust. Les noms produits par les
 * téléchargements sont alphanumériques par construction — un `%` ne peut donc
 * venir que d'une tentative d'encoder autre chose.
 */
export async function serveLocalAsset(
  request: Request,
  pathname: string,
  root: string,
  appOrigin: string,
): Promise<Response> {
  if (request.method !== "GET") return new Response("methode refusee", { status: 405 });

  const rel = pathname.replace(/^\/+/, "");
  const mime = mimeFor(rel);
  if (mime === null) return new Response("type non servi", { status: 404 });

  // `Uint8Array.from` et non le `Buffer` rendu par `readFile` : le `Response`
  // de l'exécution est celui de Node, mais ses TYPES viennent de la lib DOM,
  // dont le `BodyInit` exige une vue sur un vrai `ArrayBuffer` — là où un
  // `Buffer` est typé sur `ArrayBufferLike`, qui couvre aussi la mémoire
  // partagée. La copie porte sur quelques centaines de kilo-octets.
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = Uint8Array.from(await readFile(safeJoin(root, rel)));
  } catch {
    // Chemin refusé ou fichier absent : la page n'a rien à en tirer de plus
    // qu'une absence, et distinguer les deux renseignerait sur l'arborescence.
    return new Response("introuvable", { status: 404 });
  }

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Cache-Control": "public, max-age=86400",
      // L'application et les ressources locales sont deux ORIGINES distinctes
      // du même schéma : sans cet en-tête, les `<img>` passeraient mais tout
      // `fetch()` serait bloqué — c'est ce qui faisait échouer trickplay.json
      // et item.json en silence côté Tauri.
      "Access-Control-Allow-Origin": appOrigin,
    },
  });
}
