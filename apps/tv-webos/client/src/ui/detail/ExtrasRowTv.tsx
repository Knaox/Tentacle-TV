import { ExtrasRow as RangeeWeb } from "@/components/detail/ExtrasRow";
import type { ComponentProps } from "react";
import { useMarqueur } from "../marker";

/**
 * La rangée des extras, confinée comme une piste.
 *
 * L'original fait défiler ses tuiles dans un `HorizontalScrollRow`, dont le
 * conteneur porte un `tabIndex` — une grande cible sans anneau que
 * `sansEnveloppes` doit neutraliser à chaque recensement — et qu'aucun
 * marqueur ne désigne comme piste : « droite » en bout de rangée partait vers
 * ce que la géométrie trouvait, et le confinement horizontal ne s'appliquait
 * pas.
 *
 * L'enveloppe pose `data-tv-piste` sur ce conteneur et retire sa focusabilité.
 * Par observation et non par effet simple : les tuiles arrivent avec les
 * données — l'original rend `null` tant qu'il n'a rien — sans que cette
 * enveloppe ne re-rende.
 */
export function ExtrasRow(proprietes: ComponentProps<typeof RangeeWeb>) {
  const cadre = useMarqueur<HTMLDivElement>((racine) => {
    const scroller = racine.querySelector<HTMLElement>('[role="group"][tabindex]');
    if (!scroller || scroller.hasAttribute("data-tv-piste")) return;
    scroller.setAttribute("data-tv-piste", "");
    scroller.setAttribute("tabindex", "-1");
  });

  return (
    <div ref={cadre}>
      <RangeeWeb {...proprietes} />
    </div>
  );
}
