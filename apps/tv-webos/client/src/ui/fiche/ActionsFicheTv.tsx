import type { MediaItem } from "@tentacle-tv/shared";
import { DetailActions as ActionsWeb } from "@/components/detail/DetailActions";

interface ProprietesActionsFiche {
  item: MediaItem;
}

/**
 * Le bloc d'actions de la fiche, déclaré comme ZONE.
 *
 * L'enveloppe ne change rien au rendu — l'original garde ses mutations, ses
 * libellés de reprise, son ordre — elle pose le marqueur `data-tv-zone` que le
 * moteur lit à l'arrivée : descendre depuis « Retour » ou les infos techniques
 * atterrit sur l'appel à l'action principal (« Lecture », « Reprendre »,
 * reconnu par son jeton `cta-primary`), plus jamais sur le trailer ou une
 * pastille ronde que l'ordonnée désignait. La destination se résout à chaque
 * appui : le bouton de lecture arrive quand l'état de visionnage arrive, et
 * une fiche qui n'en a pas — collection, série terminée — entre par son
 * premier bouton.
 *
 * C'est l'import de l'original par son remplacement, sous la garde d'identité
 * de `config/substitutionModules.ts`.
 */
export function DetailActions({ item }: ProprietesActionsFiche) {
  return (
    <div data-tv-zone="actions-fiche">
      <ActionsWeb item={item} />
    </div>
  );
}
