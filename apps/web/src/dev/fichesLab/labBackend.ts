/**
 * Le backend Tentacle FACTICE du labo, pour le BANC seulement (`apps/web/bench/fiches/`) : les
 * crochets qui parlent au backend (`/api/config`, préférences, notes, recherche…) passent par
 * `fetch`, pas par le client Jellyfin. Installé à la demande (`<FichesLab backend />`) ; dans
 * l'application de développement, ces requêtes vont au vrai serveur et rien n'est détourné.
 *
 * Une route inconnue répond 404 et le dit en console : la fonction qui en dépend se tait,
 * comme face à un serveur qui ne la connaît pas.
 */

import { SERVER_CAPABILITY_KEYS } from "@tentacle-tv/shared";
import { labBrowse, labPersonCredits, labSearch, labSearchDiscover, labSearchEpisodes } from "./labSearch";

type Answer = unknown | undefined;

function answer(url: URL, method: string): Answer {
  const p = url.pathname.replace(/^.*?\/api\//, "/api/");
  if (method !== "GET") return {};
  if (p === "/api/config") {
    return {
      version: "1.41.0",
      brandName: "Tentacle TV",
      features: { downloads: false, demo: false, family: { enabled: false } },
      // Sans le catalogue de bandes-annonces du serveur : la fiche suit `RemoteTrailers` de
      // Jellyfin (la règle d'avant), que le serveur factice sait donner.
      capabilities: SERVER_CAPABILITY_KEYS.filter((key) => !key.startsWith("trailers.")),
    };
  }
  if (p === "/api/config/autoplay") return { maxResumePct: 90 };
  if (p === "/api/plugins/active") return [];
  if (p === "/api/health") return { status: "ok" };
  // Ce que la session peut faire : tout, en session personnelle (rien d'affiché sans le droit).
  if (p === "/api/account/abilities") {
    return {
      session: "personal", administrator: false, playback: true, keepOffline: false, watchTogether: "full", publicSharing: true,
      deleteTitles: true, tickets: true, extensions: true, manageAccount: true, pairDevices: true, push: false, invites: false,
    };
  }
  if (p === "/api/watch-together/access") return { access: "full" };
  if (p === "/api/share/access") return { publicSharing: true };
  if (p === "/api/reco/people") return { people: [] };
  // Le droit de supprimer des titres : la bibliothèque montre son mode sélection.
  if (p === "/api/library/deletion/rights") return { everywhere: true, libraryIds: [] };
  if (p === "/api/ratings") return [];
  if (p.startsWith("/api/ratings/")) return { rating: null };
  if (p === "/api/trailers/readiness") return { ready: true };
  if (p.startsWith("/api/preferences/hints")) return { dismissed: [] };
  if (p.startsWith("/api/preferences")) return {};
  if (p === "/api/search") return labSearch(url.searchParams);
  if (p === "/api/search/episodes") return labSearchEpisodes(url.searchParams);
  if (p === "/api/search/discover") return labSearchDiscover();
  if (p === "/api/search/genre" || p === "/api/search/studio") {
    return labBrowse(p.endsWith("genre") ? "genre" : "studio", url.searchParams.get("name") ?? "");
  }
  const person = /^\/api\/search\/person\/([^/]+)$/.exec(p);
  if (person) return labPersonCredits(decodeURIComponent(person[1]!));
  return undefined;
}

let installed = false;

export function installLabBackend(): void {
  if (installed) return;
  installed = true;
  const real = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.href);
    if (!url.pathname.includes("/api/")) return real(input, init);
    const method = (init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET")).toUpperCase();
    const body = answer(url, method);
    if (body === undefined) {
      console.warn(`[labo fiches] backend sans réponse : ${method} ${url.pathname}${url.search}`);
      return new Response("{}", { status: 404, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  };
}
