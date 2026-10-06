// Les DONNÉES du faux backend : l'instantané du banc UI (compte de test, figé
// par son empreinte — jamais la bibliothèque vivante), et ce que les jeux des
// domaines y retouchent. Remises à la base avant chaque démarrage à froid :
// un scénario ne voit que la base et les jeux qu'il déclare.
//
// L'API que reçoivent les jeux (`scenarios/<domaine>/fixtures.mjs`) est celle
// de l'objet rendu par `createDataset` : voir `docs/tv-navigation/banc.md`.
import fs from "node:fs";
import path from "node:path";

const clone = (value) => structuredClone(value);
const clean = (name) => String(name ?? "").replace(/^‎/, "").trim();

/** Les modes par défaut : un serveur sain, Vigie actif et IMMOBILE (rien n'avance). */
export const DEFAULT_MODES = Object.freeze({
  health: "up", // up | down (connexion refusée) | mute (aucune réponse) | error (500)
  vigie: "on", // on | off | blocked | old | noorigin (voir live-requests)
  vigieScenario: "still", // still | live | empty
  demandes: "off", // on : un titre absent s'offre à la demande
  trailers: "ready", // ready | broken (la résolution échoue)
  slowResumeMs: "0", // > 0 : la reprise et « À suivre » répondent en retard (un serveur lent : l'accueil attend son héros)
  // Le mode du héros servi par la mise en page de l'accueil (resume | random | reco | fixed). L'instantané
  // porte celui du serveur relevé (« reco ») ; les références ont été enregistrées quand la TV l'ignorait
  // — en reprise, de fait : c'est le mode du banc, sauf jeu contraire (`base/heros-reco`).
  heroMode: "resume",
});

export function loadSnapshot(dir) {
  const file = path.join(dir, "snapshot.json");
  if (!fs.existsSync(file)) throw new Error(`instantané absent : ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/**
 * Le jeu de données courant. `base` : l'instantané lu une fois ; chaque
 * `reset()` en repart (copie profonde). Les écritures de l'app (favori, vu,
 * Ma liste, note) s'y appliquent : l'écran suivant les relit, comme sur un
 * vrai serveur.
 */
export function createDataset(base, { port }) {
  const data = { snapshot: null, modes: null, ratings: [], routes: [], applied: [] };

  data.reset = () => {
    data.snapshot = clone(base);
    data.modes = { ...DEFAULT_MODES };
    data.ratings = clone(base.ratingRows ?? []);
    data.routes = [];
    data.applied = [];
    data.extraDetail = {};
  };

  // ─── Lecture ───────────────────────────────────────────────────────────────
  data.item = (id) => data.snapshot.items[id]?.item ?? null;
  data.itemsOf = (ids) => (ids ?? []).map(data.item).filter(Boolean);
  data.list = (name) => data.itemsOf(data.snapshot.lists[name]);
  data.clean = clean;
  data.poster = (id) => `http://localhost:${port}/img/${id}/Primary`;
  data.detail = (id) => data.extraDetail[id] ?? data.snapshot.detail?.[id] ?? null;
  data.libraries = () => data.snapshot.libraries ?? [];

  // ─── Retouches (jeux des domaines) ─────────────────────────────────────────
  /** Fusionne `patch` dans l'item `id` (champs Jellyfin bruts). */
  data.patchItem = (id, patch) => {
    const item = data.item(id);
    if (!item) throw new Error(`item inconnu de l'instantané : ${id}`);
    Object.assign(item, clone(patch));
    return item;
  };
  data.setUserData = (id, patch) => {
    const item = data.item(id);
    if (!item) throw new Error(`item inconnu de l'instantané : ${id}`);
    item.UserData = { ...(item.UserData ?? {}), ...patch };
    return item.UserData;
  };
  /** Un item NOUVEAU (copie d'un item existant retouchée) : `{ from, id, ...champs }`. */
  data.addItem = ({ from, id, images, ...fields }) => {
    const source = data.snapshot.items[from];
    if (!source) throw new Error(`item modèle inconnu : ${from}`);
    data.snapshot.items[id] = { item: { ...clone(source.item), ...clone(fields), Id: id }, images: images ?? source.images };
    return data.snapshot.items[id].item;
  };
  /**
   * Remplace une liste de l'instantané (`resume`, `nextUp`, `latest`, `watchlist`,
   * `favorites`, `movies`…). Ma liste et les favoris se lisent, comme chez
   * Jellyfin, sur les drapeaux des items (`Likes`, `IsFavorite`) : les poser
   * ici les met à jour, pour tous les items.
   */
  data.setList = (name, ids) => {
    data.snapshot.lists[name] = [...ids];
    const flag = { watchlist: "Likes", favorites: "IsFavorite" }[name];
    if (!flag) return;
    for (const entry of Object.values(data.snapshot.items)) {
      const on = ids.includes(entry.item.Id);
      if (on || entry.item.UserData?.[flag]) entry.item.UserData = { ...(entry.item.UserData ?? {}), [flag]: on ? true : flag === "Likes" ? null : false };
    }
  };
  /**
   * Remplace les bibliothèques (ordre de `/Views`, donc du rail) :
   * `[{ id, name, collectionType, items? }]` — `items` : leurs titres (ids de l'instantané).
   */
  data.setLibraries = (libraries) => {
    data.snapshot.libraries = libraries.map(({ id, name, collectionType }) => ({ id, name, collectionType }));
    for (const lib of libraries) {
      data.snapshot.catalog[lib.id] = [...(lib.items ?? data.snapshot.catalog[lib.id] ?? [])];
      data.snapshot.latestByLibrary[lib.id] = data.snapshot.catalog[lib.id].slice(0, 12);
    }
  };
  /** Une note du compte (1 à 10, 1 = une demi-étoile) sur un item qui a un identifiant TMDB. */
  data.rate = (id, score) => {
    const item = data.item(id);
    const tmdbId = Number(item?.ProviderIds?.Tmdb);
    if (!tmdbId) throw new Error(`item sans identifiant TMDB, donc non notable : ${id}`);
    const mediaType = item.Type === "Series" ? "series" : "movie";
    data.ratings = data.ratings.filter((row) => !(row.mediaType === mediaType && row.tmdbId === tmdbId));
    data.ratings.push(ratingRow({ mediaType, tmdbId, score, jellyfinItemId: id }));
  };
  /** Rend un titre NON notable : plus aucun identifiant TMDB. */
  data.makeUnratable = (id) => {
    const item = data.item(id);
    if (!item) throw new Error(`item inconnu de l'instantané : ${id}`);
    item.ProviderIds = Object.fromEntries(Object.entries(item.ProviderIds ?? {}).filter(([key]) => key.toLowerCase() !== "tmdb"));
  };
  /** Une route du faux backend, propre à ce jeu : `(method, /regex/, handler(req, res, ctx))`. */
  data.route = (method, pattern, handler) => {
    data.routes.push({ method: method.toUpperCase(), pattern, handler });
  };
  /** Une fiche (similaires, bonus, bandes-annonces, saga) pour un item : `{ similar: [ids], saga… }`. */
  data.setDetail = (id, detail) => {
    data.extraDetail[id] = { ...(data.snapshot.detail?.[id] ?? {}), ...clone(detail) };
  };

  data.reset();
  return data;
}

let ratingSeq = 0;
/** Une ligne de `/api/ratings`, telle que le backend la rend. */
export function ratingRow({ mediaType, tmdbId, score, jellyfinItemId = null, seasonNumber = 0, episodeNumber = 0 }) {
  ratingSeq += 1;
  return {
    id: `banc-${ratingSeq}`, mediaType, tmdbId: Number(tmdbId), jellyfinItemId, seasonNumber, episodeNumber,
    score: Number(score), syncStatus: "disabled", updatedAt: "2026-10-01T12:00:00.000Z",
  };
}
