// Les jeux de données du domaine « ecrans » (T7) : ce que la base du banc ne
// sert pas (Parcourir, les épisodes de la recherche, la connexion du
// jumelage) et les états d'écran à provoquer (une fiche en erreur ou lente,
// une page lente, des Favoris vides, une grande bibliothèque). Voir README.md.

const FILM = "fcfbd7a81518be2f40de85b0d1ccd46f"; // Les Évadés
const FILMS = "db4c1708cbb5dd1676284a40f2950aba"; // la bibliothèque « Films »

/**
 * Une réponse LENTE : assez pour que l'état de chargement soit relevé à coup
 * sûr, même sous charge (l'entrée est relevée après 1,5 s d'immobilité, ou
 * 10 s sans focus), et en deçà du délai d'abandon du client (30 s).
 */
const SLOW_MS = 20_000;

const itemPath = (id) => new RegExp(`^/api/jellyfin/(?:Users/[^/]+/)?Items/${id}$`, "i");
const later = (ms, run) => setTimeout(run, ms);

/** Une réponse de Parcourir (`/api/search/person|genre|studio`), dans l'ordre des ids. */
function browse(data, ids, extra) {
  const items = data.itemsOf(ids).map((item) => ({ item, match: { field: "name", text: item.Name }, score: 1 }));
  return { person: null, genre: null, studio: null, ...extra, items, total: items.length };
}

/** La filmographie d'une personne : ses titres de l'instantané (`credits`). */
function personBrowse(data, personId) {
  const person = data.item(personId);
  const ids = data.snapshot.credits?.[personId] ?? [];
  const hit = { id: personId, name: person?.Name ?? "", imageTag: person?.ImageTags?.Primary ?? null, roles: [], count: ids.length, score: 1 };
  return browse(data, ids, { person: hit });
}

/** Les titres d'un genre, parmi les films et séries de l'instantané. */
function genreBrowse(data, name) {
  const ids = Object.values(data.snapshot.items)
    .map((entry) => entry.item)
    .filter((item) => (item.Type === "Movie" || item.Type === "Series") && (item.Genres ?? []).includes(name))
    .sort((a, b) => data.clean(a.Name).localeCompare(data.clean(b.Name)) || a.Id.localeCompare(b.Id))
    .map((item) => item.Id);
  return browse(data, ids, { genre: name });
}

/** Parcourir et les épisodes de la recherche, servis (la base ne les a pas). */
function searchRoutes(data, { personDelayMs = 0 } = {}) {
  data.route("GET", /^\/api\/search\/person\/[^/]+$/, (req, res, { url, json }) => {
    const id = decodeURIComponent(url.pathname.split("/").pop());
    later(personDelayMs, () => json(res, 200, personBrowse(data, id)));
  });
  data.route("GET", /^\/api\/search\/genre$/, (req, res, { url, json }) => json(res, 200, genreBrowse(data, url.searchParams.get("name") ?? "")));
  data.route("GET", /^\/api\/search\/studio$/, (req, res, { url, json }) => json(res, 200, browse(data, [], { studio: url.searchParams.get("name") ?? "" })));
  data.route("GET", /^\/api\/search\/episodes$/, (req, res, { url, json }) => json(res, 200, { query: url.searchParams.get("q") ?? "", episodes: [] }));
}

/**
 * Le MOTEUR de la recherche, comme le serveur le rend (`searchService.ts`,
 * `respond`) : les films et séries dont le nom contient la saisie, trouvés
 * par leur titre (`match`, que l'écran lit), le meilleur en tête et retiré de
 * sa catégorie, chaque catégorie bornée à `limit`, les totaux entiers. La
 * recherche de la base (`server/tentacle.mjs`) rend ses résultats sans
 * `match` ni borne : l'écran plante à leur arrivée.
 */
function searchEngine(data, q, limit) {
  const term = q.trim().toLowerCase();
  const hits = Object.values(data.snapshot.items)
    .map((entry) => entry.item)
    .filter((item) => (item.Type === "Movie" || item.Type === "Series") && term && data.clean(item.Name).toLowerCase().includes(term))
    .sort((a, b) => data.clean(a.Name).localeCompare(data.clean(b.Name)) || a.Id.localeCompare(b.Id))
    .map((item) => ({ item, match: { field: "title" }, score: 1 }));
  const top = hits[0] ? { kind: "item", hit: hits[0] } : null;
  const rest = hits.slice(1);
  const of = (type, list) => list.filter((hit) => hit.item.Type === type);
  return {
    query: q, ready: true, tookMs: 1, correction: null, partial: false, top,
    movies: of("Movie", rest).slice(0, limit), series: of("Series", rest).slice(0, limit), collections: [],
    people: [], genres: [], studios: [],
    totals: { movies: of("Movie", hits).length, series: of("Series", hits).length, collections: 0, people: 0 },
  };
}

export default {
  "moteur-recherche": {
    description: "la recherche répond comme le moteur du serveur (titres trouvés par leur nom, `match`, bornée à `limit`) ; Parcourir et les épisodes (aucun) comme « recherche »",
    apply: (data) => {
      searchRoutes(data);
      data.route("GET", /^\/api\/search$/, (req, res, { url, json }) =>
        json(res, 200, searchEngine(data, url.searchParams.get("q") ?? "", Number(url.searchParams.get("limit") ?? 6))));
    },
  },
  recherche: {
    description: "Parcourir (personne, genre, studio) et les épisodes de la recherche (aucun)",
    apply: (data) => searchRoutes(data),
  },
  "parcourir-lent": {
    description: "comme « recherche », la filmographie d'une personne répond après 20 s",
    apply: (data) => searchRoutes(data, { personDelayMs: SLOW_MS }),
  },
  "fiche-en-erreur": {
    description: "la fiche de « Les Évadés » répond 500",
    apply: (data) => data.route("GET", itemPath(FILM), (req, res, { json }) => json(res, 500, { error: "banc : fiche en erreur" })),
  },
  "fiche-lente": {
    description: "la fiche de « Les Évadés » répond après 20 s",
    apply: (data) => data.route("GET", itemPath(FILM), (req, res, { json }) => later(SLOW_MS, () => json(res, 200, data.item(FILM)))),
  },
  "favoris-vides": {
    description: "aucun favori",
    apply: (data) => data.setList("favorites", []),
  },
  jumelage: {
    description: "sans session : la connexion par identifiants est refusée (401) ; rien n'est relayé nulle part",
    apply: (data) => data.route("POST", /^\/api\/auth\/login$/, (req, res, { json }) => json(res, 401, { error: "Identifiants invalides" })),
  },
  "grande-bibliotheque": {
    description: "« Films » porte 1 200 titres (copies des films de l'instantané, identifiants neufs)",
    apply: (data) => {
      const models = (data.snapshot.catalog[FILMS] ?? []).filter((id) => data.item(id)?.Type === "Movie");
      const ids = [];
      for (let index = 0; index < 1200; index++) {
        const from = models[index % models.length];
        const id = `e7${index.toString(16).padStart(30, "0")}`;
        const source = data.item(from);
        data.addItem({ from, id, Name: `${data.clean(source.Name)} ${Math.floor(index / models.length) + 1}`, SortName: `${String(index).padStart(5, "0")}` });
        ids.push(id);
      }
      data.setLibraries(data.libraries().map((lib) => (lib.id === FILMS ? { ...lib, items: ids } : lib)));
    },
  },
};
