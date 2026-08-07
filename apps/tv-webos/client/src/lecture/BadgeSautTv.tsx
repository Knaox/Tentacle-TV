import { useEffect, useRef, useState } from "react";
import { SkipBadge as BadgeWeb, type SkipFlash } from "@/components/SkipBadge";
import { cumuler, FENETRE_CUMUL_MS, type CumulSauts } from "./cumulSauts";

/**
 * Le badge de saut, cumulatif.
 *
 * **On enveloppe, on ne recopie pas.** Le dessin du client web convient tel
 * quel — pilule du côté du saut, flèches, chiffres en chasse fixe. Ce qui
 * manque est ailleurs : sur un téléviseur, on n'appuie pas une fois sur « +30 »,
 * on appuie trois fois de suite pour passer une scène. Le badge du web repart
 * de zéro à chaque appui et affiche trois fois « +30 s » — l'utilisateur doit
 * faire l'addition lui-même, ce qui est précisément ce qu'un badge existe pour
 * éviter. L'Apple TV cumule : +30, +60, +90.
 *
 * L'arithmétique elle-même vit dans `cumulSauts.ts` : c'est la seule chose du
 * badge qui puisse se tromper, et la seule qu'on puisse vérifier sans écran.
 *
 * **Pourquoi un minuteur à nous.** Le client web efface son éclair au bout
 * d'une seconde ; on ignore cet effacement et on tient notre propre échéance,
 * sans quoi le badge disparaîtrait cinq cents millisecondes avant la fin de la
 * fenêtre de cumul — donc pendant qu'il est encore possible d'y ajouter.
 */

export function SkipBadge({ flash }: { flash: SkipFlash | null }) {
  const [cumul, setCumul] = useState<SkipFlash | null>(null);
  const dernier = useRef<CumulSauts | null>(null);

  useEffect(() => {
    // Le `null` du web est son effacement à lui : il ne nous concerne pas.
    if (!flash) return;

    const memoire = cumuler(dernier.current, flash.delta, Date.now());
    dernier.current = memoire;
    setCumul({ delta: memoire.total, id: flash.id });
  }, [flash]);

  useEffect(() => {
    if (!cumul) return;
    const minuteur = setTimeout(() => setCumul(null), FENETRE_CUMUL_MS);
    return () => clearTimeout(minuteur);
  }, [cumul]);

  return <BadgeWeb flash={cumul} />;
}
