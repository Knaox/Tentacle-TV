/**
 * La carte d'un titre HORS bibliothèque : l'affiche (ou ses initiales), la
 * pastille que le plugin a choisie, le titre et sa petite ligne. Un clic mène
 * à la page du plugin qui montre le titre (`item.href`).
 *
 * Elle occupe toute la largeur que son parent lui donne : la grille des
 * résultats comme une rangée d'affiches décident de la taille, pas elle.
 */

import { memo } from "react";
import { useNavigate } from "react-router-dom";
import type { ExternalSearchItem } from "@tentacle-tv/shared";
import { ExternalBadge, ExternalPoster } from "./ExternalVisuals";

export const ExternalResultCard = memo(function ExternalResultCard({ item }: { item: ExternalSearchItem }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(item.href)}
      className="group/x block w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
    >
      <div className="relative">
        <ExternalPoster item={item} className="aspect-[2/3] w-full rounded-md" />
        {item.badge !== null && <ExternalBadge badge={item.badge} className="absolute left-2 top-2" />}
      </div>
      <p className="mt-2 truncate text-sm font-medium text-content-primary group-hover/x:text-[var(--brand-light)]">{item.title}</p>
      {item.subtitle !== null && <p className="truncate text-xs text-content-quaternary">{item.subtitle}</p>}
    </button>
  );
});
