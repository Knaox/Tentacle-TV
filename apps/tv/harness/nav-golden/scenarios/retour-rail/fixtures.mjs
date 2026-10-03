/**
 * Les jeux de données du domaine « retour-rail » (T4), au format du banc
 * nav-golden : `retour-rail/<nom>` dans `start.fixtures`. Chaque jeu retouche
 * le faux backend après sa remise à la base (`server/dataset.mjs`).
 */

/** Les films du banc : les bibliothèques de plus en reprennent le catalogue (une grille, pas une page vide). */
const FILMS = "db4c1708cbb5dd1676284a40f2950aba";

/** Une bibliothèque de plus : son identifiant (32 caractères), son nom, les films du banc. */
const extraLibrary = (index, items) => ({
  id: `rr${String(index).padStart(30, "0")}`,
  name: `Bibliothèque ${index + 4}`,
  collectionType: "movies",
  items,
});

/**
 * Une filmographie (personne), un genre ou un studio parcourus
 * (`/api/search/person/<id>`, `/api/search/genre|studio?name=`, réponse
 * `SearchBrowseResponse`) : les douze premiers films du banc. Le faux backend
 * de base n'en sert pas — la page d'une personne serait vide, sans affiche à
 * ouvrir.
 */
function browseRoute(data) {
  data.route("GET", /^\/api\/search\/(person|genre|studio)(\/|\?|$)/, (req, res, { url, json }) => {
    const items = (data.snapshot.catalog[FILMS] ?? []).slice(0, 12).map((id) => data.item(id)).filter(Boolean);
    const kind = /\/api\/search\/(person|genre|studio)/.exec(url.pathname)?.[1];
    const id = kind === "person" ? decodeURIComponent(url.pathname.split("/").pop() ?? "") : "";
    const name = url.searchParams.get("name");
    json(res, 200, {
      person: kind === "person" ? { id, name: "Personne du banc", imageTag: null, roles: ["Actor"], count: items.length, score: 1 } : null,
      genre: kind === "genre" ? name : null,
      studio: kind === "studio" ? name : null,
      items: items.map((item) => ({ item, match: { field: kind === "person" ? "people" : kind }, score: 1 })),
      total: items.length,
    });
  });
}

export default {
  filmographies: {
    description: "la page d'une personne, d'un genre ou d'un studio montre les douze premiers films du banc",
    apply: browseRoute,
  },
  "24-bibliotheques": {
    description: "24 bibliothèques : les 3 du banc, puis 21 (« Bibliothèque 4 » à « Bibliothèque 24 ») qui reprennent les films — la liste du rail défile",
    apply: (data) => {
      const items = data.snapshot.catalog[FILMS] ?? [];
      data.setLibraries([...data.libraries(), ...Array.from({ length: 21 }, (_, index) => extraLibrary(index, items))]);
    },
  },
};
