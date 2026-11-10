/**
 * LABO DES FICHES — `/dev/fiches/*`, paquets de développement seulement ; absent des paquets
 * livrés et du client LG.
 *
 * Les VRAIS écrans de l'axe « fiches » de la refonte de nov. 2026 — bibliothèque et ses
 * filtres, fiche d'un film, d'une série, d'une collection, personne, recherche, Ma liste, Mes
 * favoris — rendus sans serveur : un client Jellyfin dont les réponses viennent d'une
 * bibliothèque de démonstration (`labServer.ts`), et son propre cache de requêtes. Le banc
 * `apps/web/bench/fiches/` les capture au Chrome sans tête, en sombre et en clair.
 *
 * Les filtres d'une bibliothèque vivent dans l'adresse : `library/films?genres=g-thriller&status=IsUnplayed`
 * ouvre la grille filtrée. `?etat=loading|error` simule l'attente ou la panne.
 */

import { useState, type ReactNode } from "react";
import { Link, Route, Routes, useSearchParams } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { JellyfinClientContext, TentacleConfigContext } from "@tentacle-tv/api-client";

import { Favorites } from "../../pages/Favorites";
import { Library } from "../../pages/Library";
import { MediaDetail } from "../../pages/MediaDetail";
import { Person } from "../../pages/Person";
import { Search } from "../../pages/Search";
import { Watchlist } from "../../pages/Watchlist";
import { installLabBackend } from "./labBackend";
import { LabClient, MemoryStorage } from "./labClient";
import { LAB_COLLECTION_ID, LAB_SERIES_ID } from "./labData";
import { personId } from "./labItems";
import { setLabState, type LabState } from "./labServer";

const SCENES: ReadonlyArray<[label: string, path: string]> = [
  ["Bibliothèque de films", "library/films"],
  ["… trois filtres actifs", "library/films?genres=g-thriller,g-drame&status=IsUnplayed&rating=7.5&sort=CommunityRating&order=desc"],
  ["… filtrée à zéro", "library/films?genres=g-western&fav=1"],
  ["… en chargement", "library/films?etat=loading"],
  ["Bibliothèque vide", "library/vide"],
  ["Bibliothèque de séries", "library/series"],
  ["Fiche d'un film", "media/sintel"],
  ["Fiche d'une série", `media/${LAB_SERIES_ID}`],
  ["Fiche d'une collection", `media/${LAB_COLLECTION_ID}`],
  ["Fiche en chargement", "media/sintel?etat=loading"],
  ["Fiche en échec", "media/inconnu"],
  ["Personne", `person/${personId("Cary Grant")}`],
  ["Recherche — résultats", "search?q=s"],
  ["Recherche — aucun résultat", "search?q=zzz"],
  ["Recherche — vide", "search"],
  ["Ma liste", "watchlist"],
  ["Mes favoris", "favorites"],
];

/** La place de la coquille (`AppLayout`, axe accueil) : la marge de la barre du haut, sans la barre. */
function Shell({ children }: { children: ReactNode }) {
  return <div className="lg-page min-h-screen bg-surface-0 pt-[68px]">{children}</div>;
}

function LabIndex() {
  return (
    <div className="mx-auto flex min-h-screen max-w-[720px] flex-col gap-6 bg-surface-0 px-6 py-12 text-content-primary">
      <div className="flex flex-col gap-2">
        <span className="ui-eyebrow">Labo · refonte de nov. 2026</span>
        <h1 className="text-display-3">Les fiches</h1>
        <p className="max-w-[65ch] text-sm text-content-tertiary">
          Les vrais écrans, sur une bibliothèque de démonstration (films libres de Blender, classiques du domaine public). Rien ne part au réseau.
        </p>
      </div>
      <nav className="ui-panel flex flex-col p-2">
        {SCENES.map(([label, path]) => (
          <Link key={path} to={path} className="ui-menu-item">{label}</Link>
        ))}
      </nav>
    </div>
  );
}

const STATES: readonly LabState[] = ["ready", "loading", "error"];

export function FichesLab({ backend = false }: { backend?: boolean }) {
  const [params] = useSearchParams();
  const asked = params.get("etat") as LabState | null;
  // Posé PENDANT le rendu : la première requête d'un écran part dès son montage.
  setLabState(asked && STATES.includes(asked) ? asked : "ready");
  if (backend) installLabBackend();

  const [client] = useState(() => new LabClient());
  const [config] = useState(() => ({ storage: new MemoryStorage(), uuid: { randomUUID: () => "lab-device" } }));
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5 * 60_000, refetchOnWindowFocus: false } } }));

  return (
    <QueryClientProvider client={queryClient}>
      <TentacleConfigContext.Provider value={config}>
        <JellyfinClientContext.Provider value={client}>
          <Routes>
            <Route index element={<LabIndex />} />
            <Route path="library/:libraryId" element={<Shell><Library /></Shell>} />
            <Route path="media/:itemId" element={<MediaDetail />} />
            <Route path="person/:personId" element={<Person />} />
            <Route path="search" element={<Shell><Search /></Shell>} />
            <Route path="watchlist" element={<Shell><Watchlist /></Shell>} />
            <Route path="favorites" element={<Shell><Favorites /></Shell>} />
          </Routes>
        </JellyfinClientContext.Provider>
      </TentacleConfigContext.Provider>
    </QueryClientProvider>
  );
}
