import type { QueryClient } from "@tanstack/react-query";
import {
  attachQueryPersister,
  hydrateQueryClient,
  HOME_PERSIST_WHITELIST,
  RECO_PAGE_KEY,
  WATCH_PROVIDERS_KEY,
  recoFilterKey,
} from "@tentacle-tv/api-client";
import type { PersisterOptions } from "@tentacle-tv/api-client";
import { readRecoFilterMirror } from "./recoFilterStorage";

/**
 * La persistance du cache de requêtes, sortie de `main.tsx` telle quelle.
 *
 * Cold start instantané : hydrate le cache depuis localStorage avant le premier
 * render — la home affichera ses données précédentes pendant que les refetchs
 * arrière-plan se déclenchent (le WebSocket pousse les vrais nouveaux ajouts).
 *
 * Rien ici ne dépend de l'ordre des amorces, sinon d'un `QueryClient` déjà
 * construit : `main.tsx` l'appelle une fois, après l'avoir fabriqué.
 */

const persistStorage = {
  getItem: (k: string) => localStorage.getItem(k),
  setItem: (k: string, v: string) => localStorage.setItem(k, v),
  removeItem: (k: string) => localStorage.removeItem(k),
};

/**
 * Le compte qui a produit le cache.
 *
 * Le cache est étiqueté à son nom, et n'est rendu qu'à lui. Sans cette
 * étiquette, un admin sorti du mode impersonation retrouvait les reprises de
 * lecture de l'autre : la sauvegarde sur `pagehide` réécrivait le cache en
 * mémoire — celui de l'usurpé — juste après l'effacement, pendant la
 * navigation de sortie.
 */
function cacheOwner(): string | null {
  try {
    const raw = localStorage.getItem("tentacle_user");
    if (!raw) return null;
    const id = (JSON.parse(raw) as { Id?: unknown }).Id;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

/** Hydrate le client depuis le disque, puis y sauvegarde ce qu'il apprend. */
export function installQueryPersistence(queryClient: QueryClient): void {
  const owner = cacheOwner();
  // La page de recommandations et l'annuaire des plateformes survivent au
  // rechargement comme les hubs de l'accueil : la page se rend d'un coup depuis
  // le disque, puis se revalide en silence. Seules la page « all » et celle du
  // filtre sauvegardé sont gardées (pas chaque combinaison essayée) ; ~150 Ko
  // par page — le plafond passe à 3 Mo (celui de 2 Mo est la borne de tvOS,
  // sans objet ici : localStorage en offre au moins 5).
  const whitelist = [...HOME_PERSIST_WHITELIST, RECO_PAGE_KEY, WATCH_PROVIDERS_KEY[0]] as const;
  const savedRecoFilterKey = recoFilterKey(readRecoFilterMirror(owner));
  const persistOptions: PersisterOptions = {
    whitelist,
    owner,
    maxBytes: 3 * 1024 * 1024,
    shouldPersist: (key) => key[0] !== RECO_PAGE_KEY || key[1] === "all" || key[1] === savedRecoFilterKey,
  };
  void hydrateQueryClient(queryClient, persistStorage, persistOptions);
  attachQueryPersister(queryClient, persistStorage, persistOptions);
}
