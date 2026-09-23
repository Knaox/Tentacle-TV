import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import {
  JellyfinClientContext,
  TentacleConfigContext,
  WebStorageAdapter,
  WebUuidGenerator,
  type JellyfinClient,
} from "@tentacle-tv/api-client";
import { initI18n } from "@tentacle-tv/shared";
import { LibraryGrid } from "@/components/LibraryGrid";
import { installFocusEngine } from "../client/src/focus/engine";
import { primeFocus } from "../client/src/focus/entry";
import "@/index.css";
import "../client/src/styles/tv.css";

/**
 * Le module de `harness-library.html`.
 *
 * `useUserId` lit l'identité dans le stockage local de l'origine. Le harnais
 * n'y écrit un identifiant inventé que si la place est libre, et le retire en
 * partant : une session réelle ouverte sur le même serveur de développement
 * reste intacte. Aucun jeton : la doublure du client n'en demande pas.
 */
const USER_KEY = "tentacle_user";
if (localStorage.getItem(USER_KEY) == null) {
  localStorage.setItem(USER_KEY, JSON.stringify({ Id: "harness-user" }));
  addEventListener("pagehide", () => localStorage.removeItem(USER_KEY));
}
initI18n({ lng: "fr" });

/** Une affiche au dégradé de la marque, sans réseau. */
const POSTER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b21b6"/><stop offset="1" stop-color="#db2777"/></linearGradient></defs><rect width="200" height="300" fill="url(#g)"/></svg>',
  );

const MOVIES = Array.from({ length: 36 }, (_, i) => ({
  Id: `harness-movie-${i + 1}`,
  Name: `Film ${i + 1}`,
  Type: "Movie",
  ProductionYear: 1990 + i,
  CommunityRating: 5 + (i % 5),
  ImageTags: { Primary: "harness" },
  PrimaryImageAspectRatio: 2 / 3,
  UserData: {},
}));

const GENRES = ["Action", "Animation", "Aventure", "Comédie", "Crime", "Drame", "Horreur", "Romance"].map(
  (name, i) => ({ Id: `harness-genre-${i}`, Name: name }),
);

/** La doublure : les deux requêtes de la grille, et des affiches locales. */
const client = {
  async fetch(url: string) {
    if (url.startsWith("/Genres")) return { Items: GENRES };
    if (url.includes("/Items?ParentId=")) return { Items: MOVIES, TotalRecordCount: MOVIES.length };
    throw new Error(`harnais : requête non servie ${url}`);
  },
  getImageUrl: () => POSTER,
} as unknown as JellyfinClient;

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <TentacleConfigContext.Provider value={{ storage: new WebStorageAdapter(), uuid: new WebUuidGenerator() }}>
      <JellyfinClientContext.Provider value={client}>
        <MemoryRouter initialEntries={["/library/harness"]}>
          <main style={{ paddingTop: 40 }}>
            <LibraryGrid libraryId="harness" libraryName="Films" />
          </main>
        </MemoryRouter>
      </JellyfinClientContext.Provider>
    </TentacleConfigContext.Provider>
  </QueryClientProvider>,
);

installFocusEngine();
// Le moteur pose le focus d'arrivée une fois la grille servie par la doublure.
setTimeout(() => primeFocus(), 800);
