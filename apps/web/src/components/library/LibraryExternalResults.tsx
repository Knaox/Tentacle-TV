/**
 * Chercher dans une bibliothèque, et trouver aussi ce qu'elle n'a PAS : sous
 * la grille (ou sous « aucun résultat »), les plugins qui savent chercher
 * rangent ce qu'ils trouvent — du même type que la bibliothèque, un film dans
 * « Films », une série dans « Séries ».
 *
 * Rien sans plugin actif et configuré, rien sans recherche en cours : la
 * grille reste la seule chose à l'écran tant qu'on ne cherche pas.
 */

import { useMemo } from "react";
import type { MediaItem } from "@tentacle-tv/shared";
import { ExternalSections } from "../search/external/ExternalSections";
import { useExternalSearch } from "../search/external/useExternalSearch";
import type { ExternalKind } from "../search/external/pluginSearch";

function kindOf(collectionType: string | undefined): ExternalKind | null {
  if (collectionType === "movies") return "movie";
  if (collectionType === "tvshows") return "series";
  return null;
}

export function LibraryExternalResults({ search, collectionType, items, show }: {
  /** La recherche stabilisée (celle qui interroge le serveur). */
  search: string;
  collectionType: string | undefined;
  /** Ce que la bibliothèque a rendu pour cette recherche. */
  items: readonly MediaItem[];
  /** Faux tant que la grille charge encore des pages : on ne s'intercale pas. */
  show: boolean;
}) {
  const kind = kindOf(collectionType);
  const external = useExternalSearch(search, { kind, limit: 12, enabled: search.trim().length >= 2 });
  const owned = useMemo(() => items.map((item) => ({ name: item.Name, year: item.ProductionYear ?? null })), [items]);
  if (!show || !external.available) return null;
  return (
    <div className="px-4 pb-10 md:px-8">
      <ExternalSections external={external} library={owned} kind={kind} className="mt-8" />
    </div>
  );
}
