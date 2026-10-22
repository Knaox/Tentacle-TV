/**
 * L'adresse d'un serveur, telle que la page la passe au processus principal.
 *
 * ⚠️ `z.string().url()` accepte tout ce que `new URL()` analyse — `file:`,
 * `data:`, notre propre `tentacle:`. Or le principal, lui, n'est soumis ni au
 * CORS ni au bac à sable : une adresse `file:` lui ferait lire le disque pour
 * le compte de la page. Un serveur Tentacle ou Jellyfin se joint en HTTP ou en
 * HTTPS, et rien d'autre — HTTP simple compris, cas légitime d'une adresse du
 * réseau local.
 */

import { z } from "zod";

/** `true` pour une URL absolue `http:` ou `https:`, sans identifiants. */
export function isHttpUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  return (url.protocol === "http:" || url.protocol === "https:") && url.username === "" && url.password === "";
}

/** Schéma zod de cette règle. */
export const HTTP_URL = z.string().refine(isHttpUrl, "adresse http(s) attendue");
