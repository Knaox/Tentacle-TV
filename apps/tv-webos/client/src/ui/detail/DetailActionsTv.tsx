import type { MediaItem } from "@tentacle-tv/shared";
import { DetailActions as ActionsWeb } from "@/components/detail/DetailActions";
import { useMarqueur } from "../marker";
import { ATTRIBUT_ENTREE } from "../../focus/zones";

interface ProprietesActionsFiche {
  item: MediaItem;
}

/**
 * Le bloc d'actions de la fiche : il déclare la zone et désigne son entrée.
 *
 * La zone se pose sur la COLONNE D'INFOS — le parent que la page rend autour
 * du titre, du synopsis et des actions — et non plus sur le seul bloc
 * d'actions. La différence se joue au premier appui : depuis « Retour », la
 * première bande rencontrée est le petit « Voir plus » du synopsis, hors du
 * bloc d'actions ; zone étroite, la redirection ne s'appliquait pas et le
 * focus s'y arrêtait. Zone élargie, toute entrée dans la colonne — par
 * Retour, par les extras en remontant — vise « Lecture », et « Voir plus »
 * reste servi par la circulation INTERNE (« haut » depuis « Lecture »), que
 * la garde anti-piège ne redirige jamais : le synopsis se déplie toujours.
 *
 * **La cible d'entrée reste l'ordre du document DANS le bloc d'actions.** On
 * s'appuyait sur `cta-primary`, la classe du bouton principal ; c'est un
 * choix du système de design, qui peut être renommé sans que personne pense
 * au téléviseur, et qui n'existe pas sur une fiche sans lecture — une
 * collection, une série entièrement vue. Le premier bouton du bloc, lui, est
 * toujours là et se trouve être « Lecture » quand elle existe. Chercher dans
 * la colonne entière désignerait le lien de série ou « Voir plus » : le
 * marqueur se résout sur le sous-arbre du bloc, jamais au-delà.
 *
 * Le marquage se fait par observation : le bouton de lecture arrive avec
 * l'état de visionnage, la bande-annonce avec le sien, plusieurs rendus après
 * celui-ci et sans que l'enveloppe soit re-rendue.
 */
export function DetailActions({ item }: ProprietesActionsFiche) {
  const bloc = useMarqueur<HTMLDivElement>(marquerLaFiche);

  return (
    <div ref={bloc}>
      <ActionsWeb item={item} />
    </div>
  );
}

/** Idempotent : n'écrit que si la cible a changé, et ne laisse jamais deux marques. */
function marquerLaFiche(bloc: HTMLElement): void {
  const colonne = bloc.parentElement;
  if (colonne && colonne.getAttribute("data-tv-zone") !== "actions-fiche") {
    colonne.setAttribute("data-tv-zone", "actions-fiche");
  }

  const premier = bloc.querySelector<HTMLElement>("button, a[href]");
  const porteur = colonne ?? bloc;
  const actuel = porteur.querySelector<HTMLElement>(`[${ATTRIBUT_ENTREE}]`);
  if (actuel === premier) return;

  actuel?.removeAttribute(ATTRIBUT_ENTREE);
  premier?.setAttribute(ATTRIBUT_ENTREE, "");
}
