import { HeartIcon as PhosphorHeart } from "@phosphor-icons/react/dist/csr/Heart";

/**
 * La pastille de filtre des barres d'outils (statut, favoris, étapes, genres…), partagée avec
 * `FilterMenu` — cf. `CHIP_BASE`, réexporté par `LibraryFilters` (la cible webOS le lit de là).
 *
 * Refonte de nov. 2026 : c'est la pilule du socle (`.btn .btn-sm`), en deux états.
 *  - au repos, `.btn-soft` : un remplissage neutre, sans liseré ni ombre ;
 *  - posée, `.btn-accent` : le fond doux de la teinte franche, son texte à l'accent. Plus de
 *    dégradé de marque ni d'anneau violet : l'accent ne dit qu'un état ACTIF.
 *
 * Ces pastilles vivent DANS le panneau d'outils (opaque) ou sur la page, jamais à même une
 * image : le remplissage translucide s'y lit dans les deux thèmes. La pression (97 %, 120 ms),
 * le survol et le focus viennent de `.btn`.
 */
export const CHIP_BASE = "lg-chip btn btn-sm";
const CHIP_IDLE = "btn-soft";
const CHIP_ON = "lg-chip-on btn-accent";

/**
 * `accent` est gardé pour ses appelants : le rose des favoris et le violet des statuts sont
 * désormais la MÊME teinte franche — deux couleurs d'état sur une barre se lisaient comme deux
 * familles de filtres.
 */
export function chipCls(active: boolean, _accent: "violet" | "rose" = "violet"): string {
  return `${CHIP_BASE} ${active ? CHIP_ON : CHIP_IDLE}`;
}

/** Le cœur des favoris : au trait au repos, plein une fois posé. */
export function HeartIcon({ filled }: { filled: boolean }) {
  return <PhosphorHeart size={14} weight={filled ? "fill" : "bold"} aria-hidden />;
}

/** Les statuts de visionnage proposés en accès direct. */
export const STATUS_QUICK = [
  { value: null, key: "allFilter" },
  { value: "IsUnplayed", key: "unwatched" },
  { value: "IsResumable", key: "inProgress" },
] as const;
