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

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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
 */
export async function download(
  fetchBytes: FetchBytes,
  serverUrl: string,
  root: string,
  itemId: string,
  mediaSourceId: string,
  itemJson: unknown,
): Promise<number> {
  const manifest = field(itemJson, "Trickplay");
  if (manifest === null || manifest === undefined) return 0;

  const choix = pickWidth(manifest, mediaSourceId);
  if (choix === null) return 0;
  const planches = tileCount(choix.info);
  if (planches <= 0 || planches > PLANCHES_MAX) return 0;

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
