import { useEffect, useState } from "react";
import { SkipBadge as BadgeWeb, type SkipFlash } from "@/components/SkipBadge?original";
import { FENETRE_CUMUL_MS } from "./cumulSauts";

/**
 * Le badge de saut, tenu le temps qu'on puisse encore y ajouter.
 *
 * **On enveloppe, on ne recopie pas.** Le dessin du client web convient tel
 * quel — pilule du côté du saut, flèches, chiffres en chasse fixe.
 *
 * **Le badge ne compte plus, il affiche.** Il additionnait autrefois les sauts
 * successifs, parce que le web repart de zéro à chaque appui — trois fois
 * « +30 s » là où l'Apple TV annonce +30, +60, +90. Mais cette addition-là ne
 * vivait que dans le badge, et le DÉPLACEMENT, lui, n'en savait rien : `skipBy`
 * calcule sa cible depuis la position réelle de la vidéo, qui ne bouge pas
 * entre deux appuis enchaînés. Le badge promettait quatre-vingt-dix secondes
 * quand le lecteur n'en passait que trente.
 *
 * Le cumul est donc remonté d'un cran, là où le saut se demande
 * (`ControlesTv`) : ce qui arrive ici est déjà le total, et l'afficher suffit.
 *
 * **Pourquoi un minuteur à nous.** Le client web efface son éclair au bout
 * d'une seconde ; on ignore cet effacement et on tient notre propre échéance,
 * sans quoi le badge disparaîtrait cinq cents millisecondes avant la fin de la
 * fenêtre de cumul — donc pendant qu'il est encore possible d'y ajouter.
 */

export function SkipBadge({ flash }: { flash: SkipFlash | null }) {
  const [tenu, setTenu] = useState<SkipFlash | null>(null);

  useEffect(() => {
    // Le `null` du web est son effacement à lui : il ne nous concerne pas.
    if (flash) setTenu(flash);
  }, [flash]);

  useEffect(() => {
    if (!tenu) return;
    const minuteur = setTimeout(() => setTenu(null), FENETRE_CUMUL_MS);
    return () => clearTimeout(minuteur);
  }, [tenu]);

  return <BadgeWeb flash={tenu} />;
}
