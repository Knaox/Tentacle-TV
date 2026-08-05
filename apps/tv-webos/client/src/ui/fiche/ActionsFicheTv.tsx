import type { MediaItem } from "@tentacle-tv/shared";
import { DetailActions as ActionsWeb } from "@/components/detail/DetailActions";
import { useMarqueur } from "../marqueur";
import { ATTRIBUT_ENTREE } from "../../focus/zones";

interface ProprietesActionsFiche {
  item: MediaItem;
}

/**
 * Le bloc d'actions de la fiche, déclaré comme ZONE et désignant son entrée.
 *
 * L'enveloppe ne change rien au rendu — l'original garde ses mutations, ses
 * libellés de reprise, son ordre — elle pose deux marques que le moteur lit à
 * l'arrivée. Descendre depuis « Retour » ou les infos techniques atterrit
 * ainsi sur le premier bouton du bloc, plus jamais sur la bande-annonce ou une
 * pastille ronde que l'ordonnée désignait.
 *
 * **La cible d'entrée est l'ORDRE DU DOCUMENT, pas un jeton de style.** On
 * s'appuyait sur `cta-primary`, la classe du bouton principal ; c'est un choix
 * du système de design, qui peut être renommé sans que personne pense au
 * téléviseur, et qui n'existe pas sur une fiche sans lecture — une collection,
 * une série entièrement vue. Le premier bouton, lui, est toujours là et se
 * trouve être « Lecture » quand elle existe. La cascade de `zones.ts` garde
 * `cta-primary` en second rang : cette marque-ci passe avant.
 *
 * Le marquage se fait par observation : le bouton de lecture arrive avec
 * l'état de visionnage, la bande-annonce avec le sien, plusieurs rendus après
 * celui-ci et sans que l'enveloppe soit re-rendue.
 */
export function DetailActions({ item }: ProprietesActionsFiche) {
  const zone = useMarqueur<HTMLDivElement>(designerEntree);

  return (
    <div data-tv-zone="actions-fiche" ref={zone}>
      <ActionsWeb item={item} />
    </div>
  );
}

/** Idempotent : n'écrit que si la cible a changé, et ne laisse jamais deux marques. */
function designerEntree(zone: HTMLElement): void {
  const premier = zone.querySelector<HTMLElement>("button, a[href]");
  const actuel = zone.querySelector<HTMLElement>(`[${ATTRIBUT_ENTREE}]`);
  if (actuel === premier) return;

  actuel?.removeAttribute(ATTRIBUT_ENTREE);
  premier?.setAttribute(ATTRIBUT_ENTREE, "");
}
