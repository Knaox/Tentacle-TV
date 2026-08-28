/**
 * Photographie d'un item au moment du téléchargement : DTO Jellyfin, images,
 * tuiles trickplay et segments, rangés sous `meta/<itemId>/`.
 *
 * Tout passe par le PROXY Tentacle avec le jeton en en-tête, jamais en query.
 * Tout est best-effort : un échec d'image ne bloque jamais le transfert du
 * média, et `images_state` garde la trace de ce qui a réussi.
 *
 * Portage de la moitié « téléchargement » de
 * `apps/desktop/src-tauri/src/downloads/meta.rs`.
 */

import type { DatabaseSync } from "node:sqlite";
import * as episodeNumbers from "./episodeNumbers";
import { MAX_JSON_BYTES, type FetchBytes } from "./fetcher";
import { asArray, asString, field, parseJson } from "./json";
import { markSnapshotDone, saveBytes, setLibraryId, type MetaSpec } from "./meta";
import * as segments from "./segments";
import { firstMediaSourceId } from "./store";
import * as trickplay from "./trickplay";

/**
 * Champs demandés sur l'item.
 *
 * Alignés sur `useMediaItem` : en lecture locale, ce snapshot REMPLACE le DTO
 * serveur — d'où `Chapters` pour le saut d'intro et `Overview` pour la fiche.
 * Pas d'`EnableUserData` : figée au téléchargement, la progression serait
 * périmée, et elle vit de toute façon dans `playback_state`.
 */
const CHAMPS_ITEM =
  "Overview,Genres,Taglines,MediaSources,MediaStreams,People,Studios,ProviderIds," +
  "Chapters,ParentId,Trickplay,RemoteTrailers,SeriesId,SeasonId,Status";

/**
 * Récupère et enregistre le snapshot complet.
 *
 * Le résumé de ce qui a réussi est écrit dans `item_meta.images_state`, et la
 * version de contenu posée en même temps : c'est elle qui dit à la réparation
 * qu'un item est à re-photographier.
 */
export async function snapshot(
  fetchBytes: FetchBytes,
  db: DatabaseSync,
  serverUrl: string,
  root: string,
  spec: MetaSpec,
  nowMs: number,
): Promise<void> {
  const base = `${serverUrl}/api/jellyfin`;
  const dir = `meta/${spec.itemId}`;
  const reussis: string[] = [];

  const itemJson = await recupererJson(
    fetchBytes,
    `${base}/Items/${spec.itemId}?fields=${CHAMPS_ITEM}`,
    root,
    `${dir}/item.json`,
  );
  if (itemJson !== null) reussis.push("item");

  if (spec.seriesId !== null) {
    const ok = await recupererJson(fetchBytes, `${base}/Items/${spec.seriesId}`, root, `${dir}/series.json`);
    if (ok !== null) reussis.push("series");
  }
  if (spec.seasonId !== null) {
    const ok = await recupererJson(fetchBytes, `${base}/Items/${spec.seasonId}`, root, `${dir}/season.json`);
    if (ok !== null) reussis.push("season");
  }

  if (itemJson !== null) {
    // Le DTO fraîchement récupéré fait autorité sur les numéros. La mise en
    // file les pose déjà ; ceci répare un enqueue d'avant le schéma v5.
    episodeNumbers.apply(db, spec.itemId, itemJson);

    const mediaSourceId = firstMediaSourceId(db, spec.itemId) ?? spec.itemId;
    const planches = await trickplay.download(
      fetchBytes,
      serverUrl,
      root,
      spec.itemId,
      mediaSourceId,
      parseJson(itemJson),
      nowMs,
    );
    if (planches > 0) reussis.push("trickplay");
  }

  // L'affiche vient de l'item, mais la bannière et le logo de la SÉRIE pour un
  // épisode : c'est ce qui rend la fiche cohérente hors ligne.
  const visuel = spec.seriesId ?? spec.itemId;
  const images: ReadonlyArray<readonly [string, string, string]> = [
    [
      `${base}/Items/${spec.itemId}/Images/Primary?maxWidth=600&quality=90&format=Jpg`,
      `${dir}/primary.jpg`,
      "primary",
    ],
    [
      `${base}/Items/${visuel}/Images/Backdrop?maxWidth=1280&quality=90&format=Jpg`,
      `${dir}/backdrop.jpg`,
      "backdrop",
    ],
    [`${base}/Items/${visuel}/Images/Logo?maxWidth=800&format=Png`, `${dir}/logo.png`, "logo"],
  ];
  for (const [url, rel, nom] of images) {
    const bytes = await fetchBytes(url, MAX_JSON_BYTES);
    if (bytes !== null && bytes.byteLength > 0 && saveBytes(root, rel, bytes)) reussis.push(nom);
  }

  if (spec.seriesId !== null) {
    const url = `${base}/Items/${spec.seriesId}/Images/Primary?maxWidth=600&quality=90&format=Jpg`;
    const bytes = await fetchBytes(url, MAX_JSON_BYTES);
    if (bytes !== null && saveBytes(root, `${dir}/series-primary.jpg`, bytes)) {
      reussis.push("seriesPrimary");
    }
  }

  if (await poserBibliotheque(fetchBytes, db, base, spec.itemId)) reussis.push("library");
  // Les segments viennent du résolveur du backend, pas du proxy Jellyfin.
  if (await segments.fetchAndSave(fetchBytes, serverUrl, root, spec.itemId)) {
    reussis.push("segments");
  }

  markSnapshotDone(db, spec.itemId, JSON.stringify({ ok: reussis }), nowMs);
}

/** Récupère un JSON et l'enregistre. Rend les octets, ou `null`. */
async function recupererJson(
  fetchBytes: FetchBytes,
  url: string,
  root: string,
  rel: string,
): Promise<Uint8Array | null> {
  const bytes = await fetchBytes(url, MAX_JSON_BYTES);
  if (bytes === null) return null;
  return saveBytes(root, rel, bytes) ? bytes : null;
}

/**
 * Bibliothèque de l'item, par ses ancêtres.
 *
 * Le `CollectionFolder` de PREMIER niveau, donc le dernier en remontant la
 * liste : c'est lui qui porte les préférences de pistes par bibliothèque, et
 * elles doivent fonctionner hors ligne.
 */
async function poserBibliotheque(
  fetchBytes: FetchBytes,
  db: DatabaseSync,
  base: string,
  itemId: string,
): Promise<boolean> {
  const bytes = await fetchBytes(`${base}/Items/${itemId}/Ancestors`, MAX_JSON_BYTES);
  if (bytes === null) return false;
  const ancetres = asArray(parseJson(bytes));
  if (ancetres === null) return false;

  for (const ancetre of [...ancetres].reverse()) {
    if (asString(field(ancetre, "Type")) !== "CollectionFolder") continue;
    const id = asString(field(ancetre, "Id"));
    if (id === null) continue;
    setLibraryId(db, itemId, id);
    return true;
  }
  return false;
}
