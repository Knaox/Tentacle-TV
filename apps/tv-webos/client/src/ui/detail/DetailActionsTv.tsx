import type { MediaItem } from "@tentacle-tv/shared";
import { DetailActions as WebActions } from "@/components/detail/DetailActions";
import { useMarker } from "../marker";
import { ENTRY_ATTRIBUTE } from "../../focus/zones";

interface DetailActionsProps {
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
export function DetailActions({ item }: DetailActionsProps) {
  const block = useMarker<HTMLDivElement>(markDetail);

  return (
    <div ref={block}>
      <WebActions item={item} />
    </div>
  );
}

/** Idempotent : n'écrit que si la cible a changé, et ne laisse jamais deux marques. */
function markDetail(block: HTMLElement): void {
  const column = block.parentElement;
  if (column && column.getAttribute("data-tv-zone") !== "actions-fiche") {
    column.setAttribute("data-tv-zone", "actions-fiche");
  }

  const first = block.querySelector<HTMLElement>("button, a[href]");
  const holder = column ?? block;
  const current = holder.querySelector<HTMLElement>(`[${ENTRY_ATTRIBUTE}]`);
  if (current === first) return;

  current?.removeAttribute(ENTRY_ATTRIBUTE);
  first?.setAttribute(ENTRY_ATTRIBUTE, "");
}
