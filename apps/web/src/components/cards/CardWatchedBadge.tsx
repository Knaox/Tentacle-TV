import { CardStatusMarkers } from "./CardStatusMarkers";

/**
 * Coche « vu » seule, posée dans l'angle d'une vignette — pour les surfaces
 * qui n'ont pas les autres états sous la main (catalogue hors ligne).
 *
 * C'est la pastille d'états des cartes en ligne, réduite à sa coche : les deux
 * catalogues montrent la MÊME marque, et elle ne peut plus dériver — c'est
 * déjà arrivé quand le disque blanc était recopié ailleurs.
 */

interface CardWatchedBadgeProps {
  /** Conservé pour les appelants ; le libellé vient désormais de l'espace `cards`. */
  label?: string;
}

const WATCHED_ONLY = ["watched"] as const;

export function CardWatchedBadge(_props: CardWatchedBadgeProps) {
  return <CardStatusMarkers statuses={WATCHED_ONLY} />;
}
