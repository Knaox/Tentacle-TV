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
const TARGET_WIDTH = 320;

/** Garde-fou : au-delà, le manifeste ment ou l'item est aberrant. */
const MAX_SHEETS = 10_000;

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
const MARKER = "trickplay.none";

/** Au-delà, on redemande au serveur. */
export const RECHECK_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

function infoFromValue(value: unknown): TrickplayInfo | null {
  const positive = (key: string): number | null => {
    const n = asInteger(field(value, key));
    return n !== null && n > 0 ? n : null;
  };
  const width = asInteger(field(value, "Width"));
  const height = asInteger(field(value, "Height"));
  const tileWidth = positive("TileWidth");
  const tileHeight = positive("TileHeight");
  const thumbnailCount = positive("ThumbnailCount");
  const interval = positive("Interval");
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
  const bySource = asRecord(manifest);
  if (bySource === null) return null;

  // La source demandée d'abord ; à défaut la première — un manifeste ne porte
  // qu'une source dans l'immense majorité des cas.
  const key = mediaSourceId in bySource ? mediaSourceId : Object.keys(bySource)[0];
  if (key === undefined) return null;
  const widths = asRecord(bySource[key]);
  if (widths === null) return null;

  let best: { width: number; info: TrickplayInfo } | null = null;
  for (const [raw, value] of Object.entries(widths)) {
    const width = Number.parseInt(raw, 10);
    if (!Number.isFinite(width)) continue;
    const info = infoFromValue(value);
    if (info === null) continue;
    const closest =
      best === null ||
      Math.abs(width - TARGET_WIDTH) < Math.abs(best.width - TARGET_WIDTH);
    if (closest) best = { width, info };
  }
  return best === null ? null : { mediaSourceId: key, ...best };
}

/** Nombre de planches, arrondi AU SUPÉRIEUR. */
export function tileCount(info: TrickplayInfo): number {
  const perSheet = info.TileWidth * info.TileHeight;
  if (perSheet <= 0) return 0;
  return Math.ceil(info.ThumbnailCount / perSheet);
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

  const choice = pickWidth(manifest, mediaSourceId);
  if (choice === null) {
    markNone(root, itemId, nowMs);
    return 0;
  }
  const sheets = tileCount(choice.info);
  if (sheets <= 0 || sheets > MAX_SHEETS) {
    markNone(root, itemId, nowMs);
    return 0;
  }

  const folder = `meta/${itemId}/trickplay/${choice.width}`;
  let fetched = 0;
  for (let index = 0; index < sheets; index += 1) {
    let target: string;
    try {
      target = safeJoin(root, `${folder}/${index}.jpg`);
    } catch {
      continue;
    }
    if (existsSync(target)) {
      fetched += 1;
      continue;
    }

    const url =
      `${serverUrl}/api/jellyfin/items/${itemId}/trickplay/${choice.width}/${index}.jpg` +
      `?mediaSourceId=${choice.mediaSourceId}`;
    const bytes = await fetchBytes(url, MAX_TILE_BYTES);
    if (bytes === null || bytes.byteLength === 0) continue;

    try {
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, bytes);
      fetched += 1;
    } catch {
      // Une planche manquante dégrade l'aperçu, elle ne casse rien.
    }
  }

  if (fetched > 0) {
    // Un marqueur d'un passage précédent n'a plus lieu d'être : la
    // bibliothèque s'est mise à générer des planches depuis.
    forgetMarker(root, itemId);
    const resume: LocalTrickplay = {
      mediaSourceId: choice.mediaSourceId,
      width: choice.width,
      info: choice.info,
    };
    try {
      writeFileSync(safeJoin(root, `meta/${itemId}/trickplay.json`), JSON.stringify(resume));
    } catch {
      // Sans résumé, le lecteur retombe sur l'aperçu serveur : pas bloquant.
    }
  }
  return fetched;
}

/** Le manifeste trickplay local est-il déjà là ? */
export function exists(root: string, itemId: string): boolean {
  return mediaFileExists(root, `meta/${itemId}/trickplay.json`);
}

function markerPath(root: string, itemId: string): string | null {
  try {
    return safeJoin(root, `meta/${itemId}/${MARKER}`);
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
  const target = markerPath(root, itemId);
  if (target === null) return;
  try {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, String(nowMs));
  } catch {
    // Sans marqueur, on redemandera : c'est le comportement d'avant, pas une panne.
  }
}

/** Item constaté sans trickplay, et depuis moins d'un mois ? */
export function noneRecently(root: string, itemId: string, nowMs: number): boolean {
  const target = markerPath(root, itemId);
  if (target === null) return false;
  try {
    const writtenAt = Number.parseInt(readFileSync(target, "utf8"), 10);
    return Number.isFinite(writtenAt) && nowMs - writtenAt < RECHECK_AFTER_MS;
  } catch {
    return false;
  }
}

function forgetMarker(root: string, itemId: string): void {
  const target = markerPath(root, itemId);
  if (target === null) return;
  try {
    rmSync(target, { force: true });
  } catch {
    // Un marqueur qui traîne à côté d'un trickplay.json présent est inerte :
    // `exists()` est consulté en premier.
  }
}
