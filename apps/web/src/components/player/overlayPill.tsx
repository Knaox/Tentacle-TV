/**
 * LE vocabulaire des surfaces posées sur la vidéo — deux pièces, une seule
 * définition.
 *
 * La pilule de saut (`SkipSegmentButton`) et la fiche « à suivre »
 * (`UpNextCard`) sont le MÊME objet à deux tailles : un aplat blanc opaque, du
 * noir dessus, et le temps qui reste montré par un voile qui balaye l'action.
 * Elles avaient chacune leur dessin — la fiche gardait un halo de marque et une
 * barre en dégradé lumineux quand la pilule était déjà passée au sobre —, et
 * les deux se retrouvaient à l'écran au même moment, à trente pixels l'une de
 * l'autre. Ce fichier existe pour que ça ne puisse plus diverger.
 *
 * Les deux pièces suivent la règle de coût du dépôt : `transform` et `opacity`,
 * jamais une couleur ni une largeur qui s'anime — ces surfaces flottent
 * au-dessus d'une vidéo EN LECTURE, dont l'arrière-plan change vingt-quatre à
 * soixante fois par seconde.
 */

import { useEffect, useState } from "react";

/**
 * Le voile de survol d'une surface — posé en permanence, révélé en OPACITÉ.
 *
 * Jamais une `background-color` qui s'anime : elle repeint à chaque image, là
 * où le calque, lui, se compose (règle de `cards.css`, mesurée là-bas). C'est
 * aussi ce qui remplace `--cta-primary-bg-hover` sur ces surfaces : ce blanc à
 * 85 % d'alpha rendait la moitié survolée TRANSLUCIDE, et l'image de la vidéo
 * passait au travers.
 */
export function Veil({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 bg-black/[0.07] opacity-0 transition-opacity duration-150 motion-reduce:transition-none ${className}`}
    />
  );
}

/**
 * Le temps qui reste, montré plutôt que lu — un voile qui BALAYE l'action.
 *
 * C'était une glissière de deux pixels posée à `bottom-0`. Invisible, et pour
 * une raison de géométrie : dans un conteneur `rounded-full` de 44 px, le bas
 * de la forme est un point — une bande horizontale y est rognée sur presque
 * toute sa longueur, et il n'en restait qu'un éclat au centre. Aucun réglage
 * d'opacité n'y pouvait rien.
 *
 * Le voile, lui, occupe toute la hauteur : le rayon ne le rogne plus, et il se
 * lit d'un coup d'œil sans rien ajouter à l'objet. Il reste SOBRE — dix pour
 * cent de noir sur blanc, assez pour marquer une frontière franche, trop peu
 * pour entamer le contraste du libellé (noir sur blanc, 16:1 par-dessus).
 *
 * ⚠️ Une seule transition qui court sur TOUTE la durée, armée au montage — et
 * surtout pas une transformée recalculée à chaque battement du réducteur. Le
 * décompte bat à 250 ms : une transition d'une seconde relancée quatre fois par
 * seconde ne finit jamais son trajet et donne une barre qui traîne derrière le
 * chiffre. Le composant ne doit donc PAS être remonté par une `key` qui suit
 * les secondes ; il se remonte quand le décompte se réarme, et lui seul.
 *
 * `scaleX` et rien d'autre : animer `width` repeindrait la surface à chaque
 * image. Sous « animations réduites », il disparaît — le libellé, qui décompte
 * en toutes lettres, fait seul le travail.
 */
export function Sweep({ durationMs }: { durationMs: number }) {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setGone(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <span
      aria-hidden="true"
      className="absolute inset-0 origin-left bg-black/10 transition-transform ease-linear motion-reduce:hidden"
      style={{
        transitionDuration: `${String(durationMs)}ms`,
        transform: `scaleX(${gone ? 1 : 0})`,
      }}
    />
  );
}
