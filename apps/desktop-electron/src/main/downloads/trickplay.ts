/**
 * Tuiles trickplay — l'aperçu au survol de la barre de progression.
 *
 * Manifeste : `item.Trickplay[mediaSourceId][width]`, qui exige
 * `fields=Trickplay` sur l'item. Nombre de planches, vérifié dans la source de
 * Jellyfin v10.11 : `ceil(ThumbnailCount / (TileWidth × TileHeight))`.
 *
 * Les planches passent par la route trickplay DÉDIÉE du backend et sont
 * enregistrées sous `meta/<item>/trickplay/<width>/<index>.jpg`, avec un
 * résumé `trickplay.json` que le lecteur consomme tel quel.
 *
 * Portage de `apps/desktop/src-tauri/src/downloads/trickplay.rs`.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { MAX_TILE_BYTES, type FetchBytes } from "./fetcher";
import { asInteger, asRecord, field } from "./json";
import { mediaFileExists, safeJoin } from "./paths";

/**
 * Sérialisé en PascalCase pour coller au type partagé `TrickplayInfo`
 * (`packages/shared`) — le lecteur le consomme sans conversion.
 */
export interface TrickplayInfo {
  Width: number;
  Height: number;
  TileWidth: number;
  TileHeight: number;
  ThumbnailCount: number;
  Interval: number;
}

interface LocalTrickplay {
  mediaSourceId: string;
  width: number;
  info: TrickplayInfo;
}

/** Largeur visée : l'aperçu fait environ 320 px de large dans l'interface. */
const LARGEUR_CIBLE = 320;

/** Garde-fou : au-delà, le manifeste ment ou l'item est aberrant. */
const PLANCHES_MAX = 10_000;

/**
 * Marqueur « le serveur n'a pas de trickplay pour cet item ».
 *
 * Sans lui, la réparation redemandait `Items/<id>?fields=Trickplay` pour CHAQUE
 * item complet, à CHAQUE démarrage : un film dont la bibliothèque ne génère pas
 * de planches n'en aura jamais, et la requête repartait à vie. Une bibliothèque
 * peut cependant se mettre à en produire — le marqueur périme donc.
 *
 * Un fichier plutôt qu'une colonne : la base est PARTAGÉE avec l'app Tauri, et
 * monter `PRAGMA user_version` la rendrait illisible pour elle. Ce fichier-ci
 * lui est simplement invisible : elle ne lit que des noms précis.
 */
const MARQUEUR = "trickplay.none";

/** Au-delà, on redemande au serveur. */
export const RECONTROLE_APRES_MS = 30 * 24 * 60 * 60 * 1000;

function infoFromValue(value: unknown): TrickplayInfo | null {
  const positif = (key: string): number | null => {
    const n = asInteger(field(value, key));
    return n !== null && n > 0 ? n : null;
  };
  const width = asInteger(field(value, "Width"));
  const height = asInteger(field(value, "Height"));
  const tileWidth = positif("TileWidth");
  const tileHeight = positif("TileHeight");
  const thumbnailCount = positif("ThumbnailCount");
  const interval = positif("Interval");
  if (
    width === null ||
    height === null ||
    tileWidth === null ||
    tileHeight === null ||
    thumbnailCount === null ||
    interval === null
  ) {
    return null;
  }
  return {
    Width: width,
    Height: height,
    TileWidth: tileWidth,
    TileHeight: tileHeight,
    ThumbnailCount: thumbnailCount,
    Interval: interval,
  };
}

/** Largeur la plus proche de la cible, pour la source demandée. */
export function pickWidth(
  manifest: unknown,
  mediaSourceId: string,
): { mediaSourceId: string; width: number; info: TrickplayInfo } | null {
  const parSource = asRecord(manifest);
  if (parSource === null) return null;

  // La source demandée d'abord ; à défaut la première — un manifeste ne porte
  // qu'une source dans l'immense majorité des cas.
  const cle = mediaSourceId in parSource ? mediaSourceId : Object.keys(parSource)[0];
  if (cle === undefined) return null;
  const largeurs = asRecord(parSource[cle]);
  if (largeurs === null) return null;

  let meilleur: { width: number; info: TrickplayInfo } | null = null;
  for (const [brut, valeur] of Object.entries(largeurs)) {
    const width = Number.parseInt(brut, 10);
    if (!Number.isFinite(width)) continue;
    const info = infoFromValue(valeur);
    if (info === null) continue;
    const plusProche =
      meilleur === null ||
      Math.abs(width - LARGEUR_CIBLE) < Math.abs(meilleur.width - LARGEUR_CIBLE);
    if (plusProche) meilleur = { width, info };
  }
  return meilleur === null ? null : { mediaSourceId: cle, ...meilleur };
}

/** Nombre de planches, arrondi AU SUPÉRIEUR. */
export function tileCount(info: TrickplayInfo): number {
  const parPlanche = info.TileWidth * info.TileHeight;
  if (parPlanche <= 0) return 0;
  return Math.ceil(info.ThumbnailCount / parPlanche);
}

/**
 * Télécharge le manifeste puis toutes les planches manquantes.
 *
 * `itemJson` = octets de l'`item.json` déjà récupéré, avec `fields=Trickplay`.
 * Retourne le nombre de planches disponibles à la fin. Best-effort et
 * idempotent : ce qui est déjà là est compté sans être retéléchargé.
 *
 * Les trois sorties précoces posent le marqueur `trickplay.none` : à ce
 * stade la source a répondu, et sa réponse dit qu'il n'y a rien à prendre.
 * Un échec de planche, lui, ne le pose pas — c'est du réseau.
 */
export async function download(
  fetchBytes: FetchBytes,
  serverUrl: string,
  root: string,
  itemId: string,
  mediaSourceId: string,
  itemJson: unknown,
  nowMs: number,
): Promise<number> {
  const manifest = field(itemJson, "Trickplay");
  if (manifest === null || manifest === undefined) {
    markNone(root, itemId, nowMs);
    return 0;
  }

  const choix = pickWidth(manifest, mediaSourceId);
  if (choix === null) {
    markNone(root, itemId, nowMs);
    return 0;
  }
  const planches = tileCount(choix.info);
  if (planches <= 0 || planches > PLANCHES_MAX) {
    markNone(root, itemId, nowMs);
    return 0;
  }

  const dossier = `meta/${itemId}/trickplay/${choix.width}`;
  let obtenues = 0;
  for (let index = 0; index < planches; index += 1) {
    let target: string;
    try {
      target = safeJoin(root, `${dossier}/${index}.jpg`);
    } catch {
      continue;
    }
    if (existsSync(target)) {
      obtenues += 1;
      continue;
    }

    const url =
      `${serverUrl}/api/jellyfin/items/${itemId}/trickplay/${choix.width}/${index}.jpg` +
      `?mediaSourceId=${choix.mediaSourceId}`;
    const bytes = await fetchBytes(url, MAX_TILE_BYTES);
    if (bytes === null || bytes.byteLength === 0) continue;

    try {
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, bytes);
      obtenues += 1;
    } catch {
      // Une planche manquante dégrade l'aperçu, elle ne casse rien.
    }
  }

  if (obtenues > 0) {
    // Un marqueur d'un passage précédent n'a plus lieu d'être : la
    // bibliothèque s'est mise à générer des planches depuis.
    oublierMarqueur(root, itemId);
    const resume: LocalTrickplay = {
      mediaSourceId: choix.mediaSourceId,
      width: choix.width,
      info: choix.info,
    };
    try {
      writeFileSync(safeJoin(root, `meta/${itemId}/trickplay.json`), JSON.stringify(resume));
    } catch {
      // Sans résumé, le lecteur retombe sur l'aperçu serveur : pas bloquant.
    }
  }
  return obtenues;
}

/** Le manifeste trickplay local est-il déjà là ? */
export function exists(root: string, itemId: string): boolean {
  return mediaFileExists(root, `meta/${itemId}/trickplay.json`);
}

function marqueurPath(root: string, itemId: string): string | null {
  try {
    return safeJoin(root, `meta/${itemId}/${MARQUEUR}`);
  } catch {
    return null;
  }
}

/**
 * Note que le serveur ne propose PAS de trickplay pour cet item.
 *
 * Posé uniquement quand la source a répondu et n'a rien à offrir — jamais sur
 * un échec réseau, sans quoi une coupure passagère priverait l'item d'aperçu
 * pour un mois.
 */
export function markNone(root: string, itemId: string, nowMs: number): void {
  const cible = marqueurPath(root, itemId);
  if (cible === null) return;
  try {
    mkdirSync(path.dirname(cible), { recursive: true });
    writeFileSync(cible, String(nowMs));
  } catch {
    // Sans marqueur, on redemandera : c'est le comportement d'avant, pas une panne.
  }
}

/** Item constaté sans trickplay, et depuis moins d'un mois ? */
export function noneRecently(root: string, itemId: string, nowMs: number): boolean {
  const cible = marqueurPath(root, itemId);
  if (cible === null) return false;
  try {
    const pose = Number.parseInt(readFileSync(cible, "utf8"), 10);
    return Number.isFinite(pose) && nowMs - pose < RECONTROLE_APRES_MS;
  } catch {
    return false;
  }
}

function oublierMarqueur(root: string, itemId: string): void {
  const cible = marqueurPath(root, itemId);
  if (cible === null) return;
  try {
    rmSync(cible, { force: true });
  } catch {
    // Un marqueur qui traîne à côté d'un trickplay.json présent est inerte :
    // `exists()` est consulté en premier.
  }
}
