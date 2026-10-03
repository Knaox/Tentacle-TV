import type { BlockingId, RecommendationId } from "@tentacle-tv/shared";

/**
 * Ce que chaque entrée de la vue d'ensemble dit et propose, en logique pure :
 * ses clés i18n (espace `adminOverview` — la variante d'abord, l'identifiant
 * ensuite) et son UNIQUE action.
 *
 * - `link` : la page qui règle le problème, son champ ciblé par l'ancre ;
 * - `anchor` : une carte de cette page (la mise à jour du serveur) ;
 * - `toggle` : l'entrée se déplie sur ses gestes (les réglages de Jellyfin).
 */

export type EntryId = BlockingId | RecommendationId;

export type EntryAction =
  | { kind: "link"; to: string; label: string }
  | { kind: "anchor"; target: string; label: string }
  | { kind: "toggle"; label: string; hideLabel: string };

export const ENTRY_ACTION: Record<EntryId, EntryAction> = {
  jellyfinNotConfigured: { kind: "link", to: "/admin/services#jellyfin", label: "configure" },
  jellyfinUnreachable: { kind: "link", to: "/admin/services#jellyfin", label: "entry_jellyfinUnreachable_action" },
  jellyfinKeyRejected: { kind: "link", to: "/admin/services#jellyfin", label: "entry_jellyfinKeyRejected_action" },
  databaseDown: { kind: "link", to: "/admin/services#database", label: "entry_databaseDown_action" },
  jellyfinIncompatible: { kind: "link", to: "/admin/services#compat", label: "entry_jellyfinIncompatible_action" },
  serverUpdateRequired: { kind: "anchor", target: "server-update", label: "entry_serverUpdateRequired_action" },
  publicUrl: { kind: "link", to: "/admin/services#publicurl", label: "configure" },
  tmdbKey: { kind: "link", to: "/admin/metadata", label: "configure" },
  jellyfin: { kind: "toggle", label: "entry_jellyfin_action", hideLabel: "entry_jellyfin_hideAction" },
  directPlay: { kind: "link", to: "/admin/services#directstreaming", label: "configure" },
};

/** Les clés d'une partie de l'entrée (`title`, `body`, `details`), la plus précise d'abord. */
export function entryKeys(id: EntryId, variant: string | null, part: "title" | "body" | "details"): string[] {
  return variant ? [`entry_${id}_${variant}_${part}`, `entry_${id}_${part}`] : [`entry_${id}_${part}`];
}

/** Les entrées dont le détail n'est qu'une phrase de l'espace `adminOverview`. */
const TEXT_DETAILS: ReadonlySet<EntryId> = new Set<EntryId>([
  "jellyfinNotConfigured",
  "jellyfinUnreachable",
  "jellyfinKeyRejected",
  "databaseDown",
  "jellyfinIncompatible",
  "serverUpdateRequired",
  "tmdbKey",
]);

/**
 * Ce qui se replie sous « Détails » : une phrase, les adresses sondées (lien
 * public, lecture directe), ou rien — l'entrée groupée de Jellyfin se déplie
 * par son action même.
 */
export function detailsKind(id: EntryId): "text" | "links" | "none" {
  if (TEXT_DETAILS.has(id)) return "text";
  return id === "publicUrl" || id === "directPlay" ? "links" : "none";
}
