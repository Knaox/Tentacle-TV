// Où le banc range son état et ses preuves.
//   BANC_STATE : Jellyfin jetable (jf/), base du backend (data/), profils (home-*).
//   BANC_OUT   : les captures et relevés, dans un dossier DATÉ et visible
//                (jamais la Corbeille, jamais le dépôt).
import { mkdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// Hors du dossier temporaire partagé : un nom fixe y serait préparé d'avance par un autre compte (CodeQL
// js/insecure-temporary-file). Les recettes le donnent de toute façon (README : ~/Library/Caches).
export const STATE = process.env.BANC_STATE ?? path.join(os.homedir(), "Library", "Caches", "tentacle-lg-banc");
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
const ROOT_OUT = process.env.BANC_OUT ?? path.join(os.homedir(), "Pictures/tentacle-banc-liquid-glass");

export function outDir(label) {
  const dir = path.join(ROOT_OUT, `${stamp}-${label}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export const SERVER = `http://127.0.0.1:${process.env.BANC_PORT_BACKEND ?? 3107}`;
export const JELLYFIN = "http://127.0.0.1:18307";

/** Comptes du Jellyfin jetable (mots de passe générés par jellyfin.sh, jamais imprimés). */
export function account(name) {
  const file = name === "admin" ? "admin-password" : "knaoxtest-password";
  return { username: name, password: readFileSync(path.join(STATE, "jf", file), "utf8").trim() };
}

/** Identifiant Jellyfin d'un titre par son nom (clé d'API du Jellyfin jetable). */
export async function itemId(name, type = "Movie,Series,Episode") {
  const key = readFileSync(path.join(STATE, "jf/api-key"), "utf8").trim();
  const url = `${JELLYFIN}/Items?Recursive=true&IncludeItemTypes=${type}&SearchTerm=${encodeURIComponent(name)}&api_key=${key}`;
  const body = await (await fetch(url)).json();
  const hit = body.Items.find((i) => i.Name === name) ?? body.Items[0];
  if (!hit) throw new Error(`titre introuvable : ${name}`);
  return hit.Id;
}

/**
 * Remet à zéro l'état de lecture du compte de test (positions, « vu ») : sans
 * cela, les lectures d'une cellule ajoutent « Reprendre » à l'accueil de la
 * suivante, et la comparaison au pixel ne vaut plus rien.
 */
export async function resetPlayback(name = "Knaoxtest") {
  const key = readFileSync(path.join(STATE, "jf/api-key"), "utf8").trim();
  const users = await (await fetch(`${JELLYFIN}/Users?api_key=${key}`)).json();
  const user = users.find((u) => u.Name === name);
  if (!user) return 0;
  const touched = await (await fetch(
    `${JELLYFIN}/Items?Recursive=true&userId=${user.Id}&Filters=IsResumable&IncludeItemTypes=Movie,Episode&api_key=${key}`,
  )).json();
  const played = await (await fetch(
    `${JELLYFIN}/Items?Recursive=true&userId=${user.Id}&Filters=IsPlayed&IncludeItemTypes=Movie,Episode&api_key=${key}`,
  )).json();
  const ids = new Set([...touched.Items, ...played.Items].map((i) => i.Id));
  for (const id of ids) {
    await fetch(`${JELLYFIN}/UserItems/${id}/UserData?userId=${user.Id}&api_key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ PlaybackPositionTicks: 0, Played: false, PlayCount: 0, LastPlayedDate: null }),
    });
  }
  return ids.size;
}
