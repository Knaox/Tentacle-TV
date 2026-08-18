import type { ComponentProps } from "react";
import type { HeroIndicators as JaugeWeb } from "@/components/hero/HeroIndicators";

/**
 * Le contrat vient de l'original, il n'est pas récrit.
 *
 * Il l'était, et il avait divergé sans bruit : ce composant lisait `index` là
 * où la bannière passe `activeIndex`. Aucune pastille n'était donc jamais
 * active, et la jauge de progression ne se remplissait pas. Rien ne pouvait le
 * signaler — la substitution est un greffon Vite, et `tsc` type-vérifie
 * l'appelant contre le vrai composant.
 *
 * Importer le type de l'original ferme cette porte : l'import est effacé à la
 * compilation, donc il ne déclenche pas la substitution, mais `tsc` le résout
 * par l'alias `@/*` et vérifie l'accord. Une propriété renommée dans `apps/web`
 * casse désormais le typecheck, pas la dalle.
 */
type ProprietesJauge = ComponentProps<typeof JaugeWeb>;

/**
 * Les indicateurs de la bannière, en lecture seule.
 *
 * Sur le web, chaque pastille est un bouton : on clique celle qu'on veut. Sur
 * un téléviseur, ce sont cinq cibles de quatre pixels de haut posées sur le
 * trajet du D-pad, entre la bannière et la première rangée — il faudrait les
 * traverser une par une pour descendre, et viser une pastille n'apporte rien
 * qu'un appui sur gauche ou droite ne fasse déjà.
 *
 * Elles restent affichées : elles disent combien de mises en avant existent et
 * où l'on en est, ce qui est toute leur utilité ici. Elles ne sont simplement
 * plus des boutons.
 *
 * Les flèches de défilement disparaissent de même — elles n'étaient montées
 * qu'au survol, qui n'existe pas sur une dalle.
 *
 * Le remplissage de la pastille active est une transition de largeur et non
 * une animation continue : rien ne tourne en boucle tant que la bannière ne
 * change pas.
 */
export function HeroIndicators({ count, activeIndex, durationMs }: ProprietesJauge) {
  if (count <= 1) return null;

  return (
    <div
      className="absolute bottom-6 right-6 z-10 flex items-center gap-2 md:bottom-10 md:right-10"
      aria-hidden
    >
      {Array.from({ length: count }, (_, position) => (
        <span
          key={position}
          className="block h-1 overflow-hidden rounded-full transition-all duration-500"
          style={{
            width: position === activeIndex ? 44 : 14,
            background:
              position === activeIndex
                ? "linear-gradient(90deg, var(--brand), var(--brand-accent))"
                : "var(--on-media-muted)",
            boxShadow:
              position === activeIndex ? "0 0 14px rgba(var(--brand-rgb), 0.6)" : undefined,
            // `durationMs` est facultatif chez l'original : sans lui, la
            // pastille prend sa largeur à la durée de la classe, pas en
            // « undefinedms ».
            transitionDuration:
              position === activeIndex && durationMs ? `${durationMs}ms` : undefined,
          }}
        />
      ))}
    </div>
  );
}
